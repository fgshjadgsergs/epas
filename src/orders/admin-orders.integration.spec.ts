/**
 * Admin Orders API + PermissionsGuard на живом PostgreSQL.
 *
 * Покрывает: seed ролей/прав (идемпотентный), чтение прав из БД, доступ
 * менеджера к чужим заказам, отказ клиенту/контент-менеджеру, фильтры и
 * пагинацию admin-списка, безопасные DTO, смену статуса с actorId, карту
 * переходов, конкурентные PATCH и неизменность клиентского ownership.
 */
import {
  BadRequestException,
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { CalculatorService } from '../calculator/calculator.service';
import { PublishService } from '../calculator/publish.service';
import { CartService } from '../cart/cart.service';
import { OrdersService } from './orders.service';
import { AdminOrdersService } from './admin-orders.service';
import { RolesService } from '../roles/roles.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import type { PrismaService } from '../database/prisma.service';
import type { RequestIdentity } from '../identity/request-identity.service';
import { createDisposableDb, migrateDeploy, type DisposableDb } from '../calculator/testing/integration-db';
import { makePricingEnv } from '../config/testing/pricing-environment.stub';
import { leafletsDefinitionCreate, leafletsDemoPriceRulesCreate } from '../../prisma/demo/leaflets-demo';

jest.setTimeout(240000);

const SLUG = 'listovki';
let keyCounter = 0;
const nextKey = () => `00000000-0000-4000-8000-${String(++keyCounter).padStart(12, '0')}`;

const ROLES = [
  { code: 'SUPER_ADMIN', name: 'Супер-администратор' },
  { code: 'ADMIN', name: 'Администратор' },
  { code: 'MANAGER', name: 'Менеджер' },
  { code: 'CONTENT_MANAGER', name: 'Контент-менеджер' },
  { code: 'CUSTOMER', name: 'Клиент' },
];
const PERMISSIONS = [
  { code: 'catalog.manage' },
  { code: 'files.manage' },
  { code: 'users.manage' },
  { code: 'orders.read' },
  { code: 'orders.status.change' },
];
const ROLE_PERMISSIONS: Record<string, string[]> = {
  MANAGER: ['orders.read', 'orders.status.change'],
  ADMIN: ['orders.read', 'orders.status.change'],
};

/** Мини-версия prisma/seed.ts (роли/права) — идемпотентная, как в проде. */
async function seedRbac(prisma: PrismaClient): Promise<void> {
  for (const role of ROLES) {
    await prisma.role.upsert({ where: { code: role.code }, update: { name: role.name }, create: role });
  }
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({ where: { code: p.code }, update: {}, create: p });
  }
  const superAdmin = await prisma.role.findUniqueOrThrow({ where: { code: 'SUPER_ADMIN' } });
  const all = await prisma.permission.findMany();
  const byCode = new Map(all.map((p) => [p.code, p]));
  for (const p of all) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superAdmin.id, permissionId: p.id } },
      update: {},
      create: { roleId: superAdmin.id, permissionId: p.id },
    });
  }
  for (const [roleCode, codes] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
    for (const code of codes) {
      const permission = byCode.get(code)!;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }
}

function contextFor(userId: string | undefined, required: string[]): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user: userId ? { id: userId } : undefined }) }),
  } as unknown as ExecutionContext;
}

describe('Admin Orders + PermissionsGuard (integration)', () => {
  let db: DisposableDb;
  let prisma: PrismaClient;
  let calculator: CalculatorService;
  let publisher: PublishService;
  let cart: CartService;
  let orders: OrdersService;
  let admin: AdminOrdersService;
  let rolesService: RolesService;
  let guard: PermissionsGuard;

  let ownerId: string;
  let managerId: string;
  let adminId: string;
  let customerId: string;
  let contentManagerId: string;

  async function makeUser(email: string, roleCode?: string, isActive = true): Promise<string> {
    const user = await prisma.user.create({ data: { email, passwordHash: 'x', isActive } });
    if (roleCode) {
      const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
      await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    }
    return user.id;
  }

  async function createOrderForOwner(): Promise<string> {
    const identity: RequestIdentity = { userId: ownerId, anonymousSessionId: `sess-${nextKey()}` };
    const confirmed = await calculator.confirmCalculation(
      SLUG,
      { parameters: { qty: 500 } },
      { userId: identity.userId, anonymousSessionId: identity.anonymousSessionId },
    );
    await cart.addItem(identity, confirmed.snapshotId);
    const order = await orders.createOrder(ownerId, {
      contactName: 'Иван Петров',
      contactPhone: '+7 900 123-45-67',
      contactEmail: 'ivan@example.com',
      customerComment: 'позвоните заранее',
      idempotencyKey: nextKey(),
    });
    return order.id;
  }

  /** Требуемые permissions в reflector — как @Permissions() на маршруте. */
  function requirePermissions(codes: string[]): void {
    jest.spyOn(guard['reflector'], 'getAllAndOverride').mockReturnValue(codes);
  }

  beforeAll(async () => {
    db = await createDisposableDb('photo_print_it_admin_orders');
    migrateDeploy(db.url);
    prisma = new PrismaClient({ datasources: { db: { url: db.url } } });
    calculator = new CalculatorService(prisma as unknown as PrismaService, makePricingEnv());
    publisher = new PublishService(prisma as unknown as PrismaService, makePricingEnv());
    cart = new CartService(prisma as unknown as PrismaService, calculator);
    orders = new OrdersService(prisma as unknown as PrismaService, makePricingEnv('staging', true));
    admin = new AdminOrdersService(prisma as unknown as PrismaService);
    rolesService = new RolesService(prisma as unknown as PrismaService);
    guard = new PermissionsGuard(new Reflector(), rolesService);

    await seedRbac(prisma);

    const category = await prisma.category.create({ data: { slug: 'poligrafiya', title: 'Полиграфия' } });
    const service = await prisma.service.create({
      data: { categoryId: category.id, slug: SLUG, title: 'Листовки' },
    });
    const definition = await prisma.calculatorDefinition.create({
      data: {
        ...leafletsDefinitionCreate(1),
        isDemo: true,
        status: 'DRAFT',
        priceLists: {
          create: [
            { version: 1, status: 'DRAFT', isDemo: true, currency: 'RUB', rules: leafletsDemoPriceRulesCreate() },
          ],
        },
      },
      include: { priceLists: true },
    });
    await publisher.publishDefinition(definition.id);
    await publisher.publishPriceList(definition.priceLists[0].id);
    await prisma.serviceCalculator.create({ data: { serviceId: service.id, definitionId: definition.id } });

    ownerId = await makeUser('owner@example.test', 'CUSTOMER');
    managerId = await makeUser('manager@example.test', 'MANAGER');
    adminId = await makeUser('admin@example.test', 'ADMIN');
    customerId = await makeUser('customer@example.test', 'CUSTOMER');
    contentManagerId = await makeUser('content@example.test', 'CONTENT_MANAGER');
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await db?.drop();
  });

  afterEach(() => jest.restoreAllMocks());

  // --- seed / права из БД ----------------------------------------------------

  describe('permissions из БД', () => {
    it('MANAGER имеет orders.read и orders.status.change', async () => {
      const perms = await rolesService.getUserPermissionCodes(managerId);
      expect(perms).toEqual(expect.arrayContaining(['orders.read', 'orders.status.change']));
    });

    it('ADMIN имеет orders.read и orders.status.change', async () => {
      const perms = await rolesService.getUserPermissionCodes(adminId);
      expect(perms).toEqual(expect.arrayContaining(['orders.read', 'orders.status.change']));
    });

    it('SUPER_ADMIN получает все права через seed', async () => {
      const superId = await makeUser('super@example.test', 'SUPER_ADMIN');
      const perms = await rolesService.getUserPermissionCodes(superId);
      expect(perms).toEqual(expect.arrayContaining(PERMISSIONS.map((p) => p.code)));
    });

    it('CUSTOMER не имеет orders-прав', async () => {
      const perms = await rolesService.getUserPermissionCodes(customerId);
      expect(perms).not.toContain('orders.read');
      expect(perms).not.toContain('orders.status.change');
    });

    it('CONTENT_MANAGER не имеет orders-прав', async () => {
      const perms = await rolesService.getUserPermissionCodes(contentManagerId);
      expect(perms).not.toContain('orders.read');
      expect(perms).not.toContain('orders.status.change');
    });

    it('seed идемпотентен: повторный прогон не плодит role_permissions', async () => {
      const before = await prisma.rolePermission.count();
      await seedRbac(prisma);
      await seedRbac(prisma);
      expect(await prisma.rolePermission.count()).toBe(before);
    });
  });

  // --- PermissionsGuard end-to-end (реальный RolesService + БД) ---------------

  describe('PermissionsGuard с реальными правами', () => {
    it('MANAGER проходит orders.read', async () => {
      requirePermissions(['orders.read']);
      await expect(guard.canActivate(contextFor(managerId, ['orders.read']))).resolves.toBe(true);
    });

    it('MANAGER проходит orders.status.change', async () => {
      requirePermissions(['orders.status.change']);
      await expect(guard.canActivate(contextFor(managerId, ['orders.status.change']))).resolves.toBe(true);
    });

    it('CUSTOMER получает 403', async () => {
      requirePermissions(['orders.read']);
      await expect(guard.canActivate(contextFor(customerId, ['orders.read']))).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('CONTENT_MANAGER получает 403', async () => {
      requirePermissions(['orders.read']);
      await expect(guard.canActivate(contextFor(contentManagerId, ['orders.read']))).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('право проверяется по БД: отзыв роли сразу закрывает доступ', async () => {
      const tempId = await makeUser('temp-manager@example.test', 'MANAGER');
      requirePermissions(['orders.read']);
      await expect(guard.canActivate(contextFor(tempId, ['orders.read']))).resolves.toBe(true);

      await prisma.userRole.deleteMany({ where: { userId: tempId } });
      await expect(guard.canActivate(contextFor(tempId, ['orders.read']))).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('JwtStrategy: сессия и isActive/tokenVersion', () => {
    function makeStrategy(): JwtStrategy {
      const config = { get: () => 'test-secret-please-rotate-0123456789ab' } as unknown as ConfigService;
      return new JwtStrategy(config as never, prisma as unknown as PrismaService, rolesService);
    }

    it('отключённый пользователь получает отказ (isActive=false)', async () => {
      const disabledId = await makeUser('disabled@example.test', 'MANAGER', false);
      const strategy = makeStrategy();
      await expect(
        strategy.validate({ sub: disabledId, email: 'disabled@example.test', roles: [], tokenVersion: 0 }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('устаревший tokenVersion отклоняется', async () => {
      const strategy = makeStrategy();
      await expect(
        strategy.validate({ sub: managerId, email: 'manager@example.test', roles: [], tokenVersion: 999 }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // --- admin list / detail ---------------------------------------------------

  describe('admin list / detail', () => {
    it('менеджер видит чужой заказ в списке', async () => {
      const orderId = await createOrderForOwner();
      const list = await admin.listOrders({});
      expect(list.items.some((o) => o.id === orderId)).toBe(true);
    });

    it('пагинация ограничивает размер страницы', async () => {
      const list = await admin.listOrders({ page: 1, pageSize: 1 });
      expect(list.items).toHaveLength(1);
      expect(list.pageSize).toBe(1);
      expect(list.total).toBeGreaterThanOrEqual(1);
    });

    it('сортировка по умолчанию — createdAt desc', async () => {
      await createOrderForOwner();
      const list = await admin.listOrders({ pageSize: 100 });
      const dates = list.items.map((o) => new Date(o.createdAt).getTime());
      expect([...dates].sort((a, b) => b - a)).toEqual(dates);
    });

    it('фильтр по статусу', async () => {
      const list = await admin.listOrders({ status: 'NEW', pageSize: 100 });
      expect(list.items.every((o) => o.status === 'NEW')).toBe(true);
    });

    it('фильтр по дате from в будущем не возвращает заказов', async () => {
      const list = await admin.listOrders({ from: '2999-01-01T00:00:00.000Z' });
      expect(list.items).toHaveLength(0);
    });

    it('поиск по orderNumber', async () => {
      const orderId = await createOrderForOwner();
      const detail = await admin.getOrder(orderId);
      const list = await admin.listOrders({ orderNumber: detail.orderNumber });
      expect(list.items).toHaveLength(1);
      expect(list.items[0].id).toBe(orderId);
    });

    it('поиск по телефону нормализуется по цифрам', async () => {
      await createOrderForOwner();
      const list = await admin.listOrders({ phone: '+7 (900) 123' });
      expect(list.total).toBeGreaterThanOrEqual(1);
      expect(list.items.every((o) => o.status)).toBe(true);
    });

    it('поиск по email без учёта регистра', async () => {
      await createOrderForOwner();
      const list = await admin.listOrders({ email: 'IVAN@example.com' });
      expect(list.total).toBeGreaterThanOrEqual(1);
    });

    it('from > to → 400', async () => {
      await expect(
        admin.listOrders({ from: '2026-08-01T00:00:00.000Z', to: '2026-07-01T00:00:00.000Z' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('detail не раскрывает idempotencyKey и внутренние поля', async () => {
      const orderId = await createOrderForOwner();
      const detail = await admin.getOrder(orderId);
      const keys = Object.keys(detail);
      for (const forbidden of ['idempotencyKey', 'sourceCartId', 'userId', 'itemsSubtotalMinor', 'totalMinor']) {
        expect(keys).not.toContain(forbidden);
      }
      for (const item of detail.items) {
        expect(Object.keys(item)).not.toContain('calculationSnapshotId');
      }
    });

    it('несуществующий заказ → 404', async () => {
      await expect(admin.getOrder('00000000-0000-4000-8000-999999999999')).rejects.toThrow(NotFoundException);
    });

    it('detail отдаёт allowedTransitions с backend (NEW → [CANCELLED])', async () => {
      const orderId = await createOrderForOwner();
      const detail = await admin.getOrder(orderId);
      expect(detail.allowedTransitions).toEqual(['CANCELLED']);
    });

    it('у отменённого заказа нет доступных переходов', async () => {
      const orderId = await createOrderForOwner();
      await admin.changeStatus(orderId, managerId, { status: 'CANCELLED' });
      const detail = await admin.getOrder(orderId);
      expect(detail.allowedTransitions).toEqual([]);
    });

    it('история отдаёт changedBy (только displayName), без UUID сотрудника', async () => {
      const orderId = await createOrderForOwner();
      await admin.changeStatus(orderId, managerId, { status: 'CANCELLED' });
      const detail = await admin.getOrder(orderId);

      // Ручная отмена — только безопасное имя, без id и сырого UUID.
      const cancelled = detail.statusHistory.find((h) => h.toStatus === 'CANCELLED')!;
      expect(cancelled.changedBy).toEqual({ displayName: expect.any(String) });
      for (const entry of detail.statusHistory) {
        // Ни сырого changedByUserId, ни id сотрудника в ответе нет.
        expect(Object.keys(entry)).not.toContain('changedByUserId');
        if (entry.changedBy) {
          expect(Object.keys(entry.changedBy)).toEqual(['displayName']);
          expect(managerId).not.toBe(entry.changedBy.displayName);
        }
      }
    });
  });

  // --- смена статуса ---------------------------------------------------------

  describe('смена статуса', () => {
    it('успешный переход NEW → CANCELLED: статус, actorId и comment записаны', async () => {
      const orderId = await createOrderForOwner();
      const updated = await admin.changeStatus(orderId, managerId, {
        status: 'CANCELLED',
        comment: 'клиент отменил',
      });
      expect(updated.status).toBe('CANCELLED');
      const last = updated.statusHistory.at(-1)!;
      expect(last).toEqual(
        expect.objectContaining({
          fromStatus: 'NEW',
          toStatus: 'CANCELLED',
          changedBy: { displayName: expect.any(String) },
          comment: 'клиент отменил',
        }),
      );
    });

    it('недопустимый переход CANCELLED → NEW → 409', async () => {
      const orderId = await createOrderForOwner();
      await admin.changeStatus(orderId, managerId, { status: 'CANCELLED' });
      await expect(admin.changeStatus(orderId, managerId, { status: 'NEW' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('повтор того же статуса → 409 и НЕ добавляет запись истории', async () => {
      const orderId = await createOrderForOwner();
      await admin.changeStatus(orderId, managerId, { status: 'CANCELLED' });
      const before = (await admin.getOrder(orderId)).statusHistory.length;
      await expect(admin.changeStatus(orderId, managerId, { status: 'CANCELLED' })).rejects.toThrow(
        ConflictException,
      );
      const after = (await admin.getOrder(orderId)).statusHistory.length;
      expect(after).toBe(before);
    });

    it('смена статуса несуществующего заказа → 404', async () => {
      await expect(
        admin.changeStatus('00000000-0000-4000-8000-888888888888', managerId, { status: 'CANCELLED' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('конкурентные PATCH: ровно один успешный, второй — 409 (без lost update)', async () => {
      const orderId = await createOrderForOwner();
      const results = await Promise.allSettled([
        admin.changeStatus(orderId, managerId, { status: 'CANCELLED' }),
        admin.changeStatus(orderId, adminId, { status: 'CANCELLED' }),
      ]);
      const ok = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');
      expect(ok).toHaveLength(1);
      expect(failed).toHaveLength(1);
      // Ровно одна запись об отмене в истории.
      const detail = await admin.getOrder(orderId);
      expect(detail.statusHistory.filter((h) => h.toStatus === 'CANCELLED')).toHaveLength(1);
    });

    it('rollback при ошибке: если переход запрещён, статус и история не меняются', async () => {
      const orderId = await createOrderForOwner();
      await admin.changeStatus(orderId, managerId, { status: 'CANCELLED' });
      const snapshot = await admin.getOrder(orderId);
      await expect(admin.changeStatus(orderId, managerId, { status: 'NEW' })).rejects.toThrow();
      const after = await admin.getOrder(orderId);
      expect(after.status).toBe(snapshot.status);
      expect(after.statusHistory).toHaveLength(snapshot.statusHistory.length);
    });
  });

  // --- ownership клиентского API не изменился ---------------------------------

  describe('клиентский ownership не ослаблен', () => {
    it('владелец видит обновлённый статус через свой getOrder', async () => {
      const orderId = await createOrderForOwner();
      await admin.changeStatus(orderId, managerId, { status: 'CANCELLED' });
      const own = await orders.getOrder(ownerId, orderId);
      expect(own.status).toBe('CANCELLED');
    });

    it('чужой заказ через клиентский getOrder → 404', async () => {
      const orderId = await createOrderForOwner();
      await expect(orders.getOrder(customerId, orderId)).rejects.toThrow(NotFoundException);
    });
  });

  // --- сводный live-сценарий из ТЗ -------------------------------------------

  it('live-сценарий: заказ владельца → менеджер видит и меняет статус → клиент 403 → владелец видит', async () => {
    const orderId = await createOrderForOwner();

    // MANAGER видит в списке и открывает detail.
    const list = await admin.listOrders({ pageSize: 100 });
    expect(list.items.some((o) => o.id === orderId)).toBe(true);
    const detail = await admin.getOrder(orderId);
    expect(detail.id).toBe(orderId);

    // Меняет статус — в истории безопасное имя сотрудника (без id).
    const updated = await admin.changeStatus(orderId, managerId, { status: 'CANCELLED' });
    expect(updated.statusHistory.at(-1)?.changedBy?.displayName).toEqual(expect.any(String));

    // CUSTOMER получает 403 на admin-доступе.
    requirePermissions(['orders.read']);
    await expect(guard.canActivate(contextFor(customerId, ['orders.read']))).rejects.toThrow(
      ForbiddenException,
    );

    // Владелец видит обновлённый статус через своё GET /orders/:id.
    const own = await orders.getOrder(ownerId, orderId);
    expect(own.status).toBe('CANCELLED');
  });
});
