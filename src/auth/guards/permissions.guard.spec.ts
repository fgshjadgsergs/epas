import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import type { RolesService } from '../../roles/roles.service';

/**
 * PermissionsGuard проверяет права по данным из БД, а не по JWT. Здесь
 * RolesService замокан, чтобы изолировать логику guard; интеграция с реальными
 * ролями/seed покрыта в admin-orders.integration.spec.ts.
 */
function makeContext(required: string[] | undefined, user: unknown): ExecutionContext {
  const handler = () => undefined;
  const cls = class {};
  return {
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  let reflector: Reflector;
  let rolesService: jest.Mocked<Pick<RolesService, 'getUserPermissionCodes'>>;
  let guard: PermissionsGuard;

  beforeEach(() => {
    reflector = new Reflector();
    rolesService = { getUserPermissionCodes: jest.fn() };
    guard = new PermissionsGuard(reflector, rolesService as unknown as RolesService);
  });

  function requireOnHandler(codes: string[]): void {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(codes);
  }

  it('пропускает маршрут без @Permissions()', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    await expect(guard.canActivate(makeContext(undefined, { id: 'u1' }))).resolves.toBe(true);
    expect(rolesService.getUserPermissionCodes).not.toHaveBeenCalled();
  });

  it('пропускает, когда у пользователя есть требуемое право (из БД)', async () => {
    requireOnHandler(['orders.read']);
    rolesService.getUserPermissionCodes.mockResolvedValue(['orders.read', 'orders.status.change']);
    await expect(guard.canActivate(makeContext(['orders.read'], { id: 'mgr' }))).resolves.toBe(true);
    expect(rolesService.getUserPermissionCodes).toHaveBeenCalledWith('mgr');
  });

  it('403, когда права нет', async () => {
    requireOnHandler(['orders.status.change']);
    rolesService.getUserPermissionCodes.mockResolvedValue(['orders.read']);
    await expect(guard.canActivate(makeContext(['orders.status.change'], { id: 'ro' }))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('требует ВСЕ перечисленные права (И-семантика)', async () => {
    requireOnHandler(['orders.read', 'orders.status.change']);
    rolesService.getUserPermissionCodes.mockResolvedValue(['orders.read']);
    await expect(
      guard.canActivate(makeContext(['orders.read', 'orders.status.change'], { id: 'u' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('берёт права из БД, а не из JWT: коды в req.user игнорируются', async () => {
    requireOnHandler(['orders.read']);
    // В "токене" право есть, но в БД — нет: доступ должен быть закрыт.
    rolesService.getUserPermissionCodes.mockResolvedValue([]);
    const user = { id: 'faker', permissions: ['orders.read'] };
    await expect(guard.canActivate(makeContext(['orders.read'], user))).rejects.toThrow(ForbiddenException);
  });

  it('403 при отсутствии user в запросе (fail-closed)', async () => {
    requireOnHandler(['orders.read']);
    await expect(guard.canActivate(makeContext(['orders.read'], undefined))).rejects.toThrow(
      ForbiddenException,
    );
    expect(rolesService.getUserPermissionCodes).not.toHaveBeenCalled();
  });

  it('не раскрывает, какого именно права не хватает', async () => {
    requireOnHandler(['orders.status.change']);
    rolesService.getUserPermissionCodes.mockResolvedValue([]);
    await expect(
      guard.canActivate(makeContext(['orders.status.change'], { id: 'u' })),
    ).rejects.toThrow('Недостаточно прав для выполнения операции');
  });

  it('использует ключ метаданных @Permissions', async () => {
    const spy = jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['orders.read']);
    rolesService.getUserPermissionCodes.mockResolvedValue(['orders.read']);
    await guard.canActivate(makeContext(['orders.read'], { id: 'u' }));
    expect(spy.mock.calls[0][0]).toBe(PERMISSIONS_KEY);
  });
});
