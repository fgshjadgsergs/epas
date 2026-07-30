/**
 * Auth security на живом PostgreSQL: refresh только в httpOnly-cookie (не в
 * JSON и не из body), ротация с одноразовостью, logout+очистка cookie, а также
 * авторитет БД у PermissionsGuard (отзыв права действует без нового JWT).
 */
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RolesService } from '../roles/roles.service';
import { PermissionsGuard } from './guards/permissions.guard';
import { REFRESH_COOKIE_NAME } from './refresh-cookie';
import { PERMISSION_CODES } from '../common/constants/permissions.constant';
import type { PrismaService } from '../database/prisma.service';
import { createDisposableDb, migrateDeploy, type DisposableDb } from '../calculator/testing/integration-db';

jest.setTimeout(240000);

const CONFIG: Record<string, unknown> = {
  'jwt.accessSecret': 'test-access-secret',
  'jwt.accessTtl': '15m',
  'jwt.refreshTtl': '30d',
  nodeEnv: 'production', // проверяем production-флаги cookie
  apiPrefix: 'api/v1',
};
const fakeConfig = { get: (key: string) => CONFIG[key] } as never;

/** Мок express-ответа: копит вызовы cookie/clearCookie. */
function mockRes() {
  const cookies: { name: string; value: string; opts: Record<string, unknown> }[] = [];
  const cleared: { name: string; opts: Record<string, unknown> }[] = [];
  const res = {
    cookie: (name: string, value: string, opts: Record<string, unknown>) => cookies.push({ name, value, opts }),
    clearCookie: (name: string, opts: Record<string, unknown>) => cleared.push({ name, opts }),
  } as unknown as Response;
  return { res, cookies, cleared };
}
const reqWithCookie = (raw?: string) =>
  ({ headers: { cookie: raw ? `${REFRESH_COOKIE_NAME}=${raw}` : undefined } }) as unknown as Request;

describe('Auth security (integration)', () => {
  let db: DisposableDb;
  let prisma: PrismaClient;
  let controller: AuthController;
  let service: AuthService;
  let roles: RolesService;
  let seq = 0;
  const email = () => `u${++seq}-${Date.now()}@t.test`;

  beforeAll(async () => {
    db = await createDisposableDb('photo_print_it_auth');
    migrateDeploy(db.url);
    prisma = new PrismaClient({ datasources: { db: { url: db.url } } });
    roles = new RolesService(prisma as unknown as PrismaService);
    service = new AuthService(prisma as unknown as PrismaService, new JwtService({}), fakeConfig, roles);
    controller = new AuthController(service, fakeConfig);
    // CUSTOMER-роль нужна register-флоу.
    await prisma.role.upsert({ where: { code: 'CUSTOMER' }, update: {}, create: { code: 'CUSTOMER', name: 'CUSTOMER' } });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await db?.drop();
  });

  // --- cookie / JSON boundary ------------------------------------------------

  it('register: refresh уходит только в httpOnly-cookie, не в JSON', async () => {
    const { res, cookies } = mockRes();
    const body = await controller.register({ email: email(), password: 'secret123' } as never, res);

    expect(body.accessToken).toBeTruthy();
    expect((body as unknown as Record<string, unknown>).refreshToken).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain(cookies[0].value);

    const c = cookies.find((x) => x.name === REFRESH_COOKIE_NAME)!;
    expect(c.opts.httpOnly).toBe(true);
    expect(c.opts.secure).toBe(true); // nodeEnv=production
    expect(c.opts.sameSite).toBe('lax');
    expect(c.opts.path).toBe('/api/v1/auth');
    expect(typeof c.opts.maxAge).toBe('number');
    expect(Array.isArray(body.user.permissions)).toBe(true);
  });

  it('login: тоже ставит cookie и не отдаёт refresh в JSON', async () => {
    const addr = email();
    const reg = mockRes();
    await controller.register({ email: addr, password: 'secret123' } as never, reg.res);
    const { res, cookies } = mockRes();
    const body = await controller.login({ email: addr, password: 'secret123' } as never, res);
    expect((body as unknown as Record<string, unknown>).refreshToken).toBeUndefined();
    expect(cookies.some((c) => c.name === REFRESH_COOKIE_NAME)).toBe(true);
  });

  // --- rotation --------------------------------------------------------------

  it('refresh: только из cookie; ротация делает старый токен непригодным', async () => {
    const reg = mockRes();
    await controller.register({ email: email(), password: 'secret123' } as never, reg.res);
    const oldToken = reg.cookies[0].value;

    const r1 = mockRes();
    const refreshed = await controller.refresh(reqWithCookie(oldToken), r1.res);
    expect(refreshed.accessToken).toBeTruthy();
    const newToken = r1.cookies[0].value;
    expect(newToken).not.toBe(oldToken);

    // Повторное использование уже ротированного токена → 401.
    await expect(controller.refresh(reqWithCookie(oldToken), mockRes().res)).rejects.toBeInstanceOf(UnauthorizedException);
    // Новый токен — рабочий.
    await expect(controller.refresh(reqWithCookie(newToken), mockRes().res)).resolves.toBeTruthy();
  });

  it('refresh без cookie (или из body) → 401', async () => {
    await expect(controller.refresh(reqWithCookie(undefined), mockRes().res)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refresh с неизвестным токеном → 401', async () => {
    await expect(controller.refresh(reqWithCookie('deadbeef'), mockRes().res)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  // --- logout ----------------------------------------------------------------

  it('logout: отзывает refresh, чистит cookie, повторный безопасен', async () => {
    const reg = mockRes();
    await controller.register({ email: email(), password: 'secret123' } as never, reg.res);
    const token = reg.cookies[0].value;

    const out = mockRes();
    await controller.logout(reqWithCookie(token), out.res);
    const cleared = out.cleared.find((c) => c.name === REFRESH_COOKIE_NAME)!;
    expect(cleared.opts.path).toBe('/api/v1/auth');
    expect(cleared.opts.httpOnly).toBe(true);

    // После logout refresh больше не работает; повторный logout не бросает.
    await expect(controller.refresh(reqWithCookie(token), mockRes().res)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.logout(reqWithCookie(token), mockRes().res)).resolves.toBeUndefined();
  });

  // --- DB как авторитет прав -------------------------------------------------

  describe('PermissionsGuard: отзыв права в БД действует без нового JWT', () => {
    const ctx = (userId: string): ExecutionContext =>
      ({
        getHandler: () => () => undefined,
        getClass: () => class {},
        switchToHttp: () => ({ getRequest: () => ({ user: { id: userId } }) }),
      }) as unknown as ExecutionContext;

    it('удаление rolePermission немедленно закрывает доступ', async () => {
      const guard = new PermissionsGuard(new Reflector(), roles);
      jest.spyOn(Reflector.prototype, 'getAllAndOverride').mockReturnValue([PERMISSION_CODES.CATALOG_MANAGE]);

      await prisma.permission.upsert({ where: { code: 'catalog.manage' }, update: {}, create: { code: 'catalog.manage' } });
      const role = await prisma.role.create({ data: { code: `CM_${seq++}`, name: 'cm' } });
      const perm = await prisma.permission.findUniqueOrThrow({ where: { code: 'catalog.manage' } });
      const rp = await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });
      const user = await prisma.user.create({ data: { email: email(), passwordHash: 'x' } });
      await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });

      // Есть право — доступ открыт.
      await expect(guard.canActivate(ctx(user.id))).resolves.toBe(true);
      // Отзываем право в БД — тот же пользователь (тот же JWT) больше не проходит.
      await prisma.rolePermission.delete({ where: { id: rp.id } });
      await expect(guard.canActivate(ctx(user.id))).rejects.toBeInstanceOf(ForbiddenException);

      jest.restoreAllMocks();
    });
  });
});
