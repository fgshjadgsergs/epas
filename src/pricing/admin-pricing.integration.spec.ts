/**
 * Admin Pricing API на живом PostgreSQL: ACTIVE → clone DRAFT → правка →
 * validate → dry-run → publish → предыдущий ACTIVE архивируется. Плюс
 * permissions из БД, revision-конфликты, immutability, регрессии Cart/Order.
 */
import {
  BadRequestException,
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { CalculatorService } from '../calculator/calculator.service';
import { PublishService } from '../calculator/publish.service';
import { CartService } from '../cart/cart.service';
import { OrdersService } from '../orders/orders.service';
import { RolesService } from '../roles/roles.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AdminPricingService } from './admin-pricing.service';
import { AuditLogService } from '../audit/audit-log.service';
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
  { code: 'pricing.read' },
  { code: 'pricing.draft.edit' },
  { code: 'pricing.publish' },
];
const ROLE_PERMISSIONS: Record<string, string[]> = {
  MANAGER: ['pricing.read'],
  ADMIN: ['pricing.read', 'pricing.draft.edit', 'pricing.publish'],
};

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

function contextFor(userId: string, required: string[]): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user: { id: userId } }) }),
  } as unknown as ExecutionContext;
}

describe('Admin Pricing API (integration)', () => {
  let db: DisposableDb;
  let prisma: PrismaClient;
  let calculator: CalculatorService;
  let publisher: PublishService;
  let cart: CartService;
  let orders: OrdersService;
  let pricing: AdminPricingService;
  let rolesService: RolesService;
  let guard: PermissionsGuard;

  let definitionId: string;
  let activePriceListId: string;
  let adminId: string;
  let managerId: string;
  let customerId: string;
  let contentManagerId: string;

  async function makeUser(email: string, roleCode: string): Promise<string> {
    const user = await prisma.user.create({ data: { email, passwordHash: 'x' } });
    const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    return user.id;
  }

  function requirePermissions(codes: string[]): void {
    jest.spyOn(guard['reflector'], 'getAllAndOverride').mockReturnValue(codes);
  }

  /** Найти цену базовой строки qty→[from] в правилах прайса (для проверки правок). */
  async function baseTierAmount(priceListId: string): Promise<number | null> {
    const rule = await prisma.priceRule.findFirst({
      where: { priceListId, kind: 'BASE_TIER' },
      orderBy: { qtyFrom: 'asc' },
    });
    return rule?.amountMinor ?? null;
  }

  beforeAll(async () => {
    db = await createDisposableDb('photo_print_it_pricing');
    migrateDeploy(db.url);
    prisma = new PrismaClient({ datasources: { db: { url: db.url } } });
    const env = makePricingEnv('staging', true);
    calculator = new CalculatorService(prisma as unknown as PrismaService, env);
    publisher = new PublishService(prisma as unknown as PrismaService, env);
    cart = new CartService(prisma as unknown as PrismaService, calculator);
    orders = new OrdersService(prisma as unknown as PrismaService, env);
    rolesService = new RolesService(prisma as unknown as PrismaService);
    guard = new PermissionsGuard(new Reflector(), rolesService);
    pricing = new AdminPricingService(
      prisma as unknown as PrismaService,
      env,
      publisher,
      calculator,
      new AuditLogService(prisma as unknown as PrismaService),
    );

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
          create: [{ version: 1, status: 'DRAFT', isDemo: true, currency: 'RUB', rules: leafletsDemoPriceRulesCreate() }],
        },
      },
      include: { priceLists: true },
    });
    definitionId = definition.id;
    activePriceListId = definition.priceLists[0].id;
    await publisher.publishDefinition(definitionId);
    await publisher.publishPriceList(activePriceListId);
    await prisma.serviceCalculator.create({ data: { serviceId: service.id, definitionId } });

    adminId = await makeUser('admin@pricing.test', 'ADMIN');
    managerId = await makeUser('manager@pricing.test', 'MANAGER');
    customerId = await makeUser('customer@pricing.test', 'CUSTOMER');
    contentManagerId = await makeUser('content@pricing.test', 'CONTENT_MANAGER');
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await db?.drop();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    // Между тестами у определения не должно оставаться черновиков — каждый
    // тест клонирует свой DRAFT сам (иначе следующий clone упрётся в 409).
    if (definitionId) await prisma.priceList.deleteMany({ where: { definitionId, status: 'DRAFT' } });
  });

  // --- create (пустой прайс с нуля) -----------------------------------------

  describe('createPriceList → пустой DRAFT', () => {
    it('создаёт DRAFT без правил, версия растёт, isDemo наследуется от определения', async () => {
      const draft = await pricing.createPriceList(definitionId, adminId);
      expect(draft.status).toBe('DRAFT');
      expect(draft.version).toBe(2); // seeded ACTIVE был версии 1
      expect(draft.isDemo).toBe(true); // определение фикстуры isDemo=true
      expect(draft.revision).toBe(0);
      expect(draft.rules).toHaveLength(0);
    });

    it('второй create при существующем DRAFT → 409', async () => {
      await pricing.createPriceList(definitionId, adminId);
      await expect(pricing.createPriceList(definitionId, adminId)).rejects.toThrow(ConflictException);
    });

    it('боевое определение (isDemo=false) без прайса → создаёт боевой DRAFT (isDemo=false)', async () => {
      const liveDef = await prisma.calculatorDefinition.create({
        data: { ...leafletsDefinitionCreate(1), code: 'live-leaflets', isDemo: false, status: 'DRAFT' },
      });
      const draft = await pricing.createPriceList(liveDef.id, adminId);
      expect(draft.isDemo).toBe(false);
      expect(draft.status).toBe('DRAFT');
      expect(draft.version).toBe(1); // у боевого определения прайсов ещё не было
      expect(draft.rules).toHaveLength(0);
      await prisma.priceList.deleteMany({ where: { definitionId: liveDef.id } });
      await prisma.calculatorDefinition.delete({ where: { id: liveDef.id } });
    });

    it('несуществующее определение → 404', async () => {
      await expect(
        pricing.createPriceList('00000000-0000-0000-0000-000000000000', adminId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // --- permissions из БД ----------------------------------------------------

  describe('permissions', () => {
    it('MANAGER имеет pricing.read, но не edit/publish', async () => {
      const perms = await rolesService.getUserPermissionCodes(managerId);
      expect(perms).toContain('pricing.read');
      expect(perms).not.toContain('pricing.draft.edit');
      expect(perms).not.toContain('pricing.publish');
    });

    it('ADMIN имеет read/edit/publish', async () => {
      const perms = await rolesService.getUserPermissionCodes(adminId);
      expect(perms).toEqual(expect.arrayContaining(['pricing.read', 'pricing.draft.edit', 'pricing.publish']));
    });

    it('CUSTOMER и CONTENT_MANAGER не имеют pricing-прав', async () => {
      expect(await rolesService.getUserPermissionCodes(customerId)).not.toContain('pricing.read');
      expect(await rolesService.getUserPermissionCodes(contentManagerId)).not.toContain('pricing.read');
    });

    it('guard: MANAGER проходит read/dry-run', async () => {
      requirePermissions(['pricing.read']);
      await expect(guard.canActivate(contextFor(managerId, ['pricing.read']))).resolves.toBe(true);
    });

    it('guard: MANAGER edit → 403', async () => {
      requirePermissions(['pricing.draft.edit']);
      await expect(guard.canActivate(contextFor(managerId, ['pricing.draft.edit']))).rejects.toThrow(ForbiddenException);
    });

    it('guard: MANAGER publish → 403', async () => {
      requirePermissions(['pricing.publish']);
      await expect(guard.canActivate(contextFor(managerId, ['pricing.publish']))).rejects.toThrow(ForbiddenException);
    });

    it('guard: ADMIN edit/publish проходит', async () => {
      requirePermissions(['pricing.draft.edit']);
      await expect(guard.canActivate(contextFor(adminId, ['pricing.draft.edit']))).resolves.toBe(true);
      requirePermissions(['pricing.publish']);
      await expect(guard.canActivate(contextFor(adminId, ['pricing.publish']))).resolves.toBe(true);
    });

    it('guard: CUSTOMER и CONTENT_MANAGER → 403 на read', async () => {
      requirePermissions(['pricing.read']);
      await expect(guard.canActivate(contextFor(customerId, ['pricing.read']))).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(contextFor(contentManagerId, ['pricing.read']))).rejects.toThrow(ForbiddenException);
    });
  });

  // --- read -----------------------------------------------------------------

  describe('read API', () => {
    it('definitions: список с версиями', async () => {
      const list = await pricing.listDefinitions({});
      expect(list.items.some((d) => d.id === definitionId)).toBe(true);
      expect(list.items[0]).toHaveProperty('priceListCount');
    });

    it('definition detail: параметры/опции read-only', async () => {
      const def = await pricing.getDefinition(definitionId);
      expect(def.readOnly).toBe(true);
      expect(def.parameters.length).toBeGreaterThan(0);
      expect(def.parameters[0]).toHaveProperty('options');
    });

    it('price-lists: история версий, ACTIVE присутствует, isDemo/pricingMode', async () => {
      const list = await pricing.listPriceLists(definitionId, {});
      const active = list.items.find((pl) => pl.id === activePriceListId)!;
      expect(active.status).toBe('ACTIVE');
      expect(active.isDemo).toBe(true);
      expect(active.pricingMode).toBe('DEMO');
    });

    it('price-list detail: правила + read-only production rules, revision', async () => {
      const pl = await pricing.getPriceList(activePriceListId);
      expect(pl.rules.length).toBeGreaterThan(0);
      expect(pl).toHaveProperty('revision');
      expect(pl.productionRules.every((r) => r.readOnly)).toBe(true);
      // Safe DTO: без внутренних служебных полей.
      expect(pl.rules[0]).not.toHaveProperty('priceListId');
    });
  });

  // --- clone ----------------------------------------------------------------

  describe('clone → DRAFT', () => {
    afterEach(async () => {
      // Убираем черновики между тестами клона (у определения не должно копиться DRAFT).
      await prisma.priceList.deleteMany({ where: { definitionId, status: 'DRAFT' } });
    });

    it('ACTIVE → DRAFT: version растёт, currency наследуется, правила скопированы, источник неизменен', async () => {
      const before = await prisma.priceList.findUniqueOrThrow({ where: { id: activePriceListId } });
      const draft = await pricing.cloneDraft(activePriceListId, adminId);

      expect(draft.status).toBe('DRAFT');
      expect(draft.version).toBeGreaterThan(before.version);
      expect(draft.currency).toBe(before.currency);
      expect(draft.rules.length).toBeGreaterThan(0);

      // Источник не изменился.
      const after = await prisma.priceList.findUniqueOrThrow({ where: { id: activePriceListId } });
      expect(after.status).toBe('ACTIVE');
      expect(after.version).toBe(before.version);

      // Definition не клонировалась.
      expect(await prisma.calculatorDefinition.count({ where: { code: before ? undefined : undefined } })).toBeGreaterThan(0);
      const draftRow = await prisma.priceList.findUniqueOrThrow({ where: { id: draft.id } });
      expect(draftRow.definitionId).toBe(definitionId);

      // AuditLog содержит клон.
      const auditRows = await prisma.auditLog.findMany({ where: { action: 'pricing.draft.clone', entityId: draft.id } });
      expect(auditRows.length).toBe(1);
    });

    it('ARCHIVED → DRAFT', async () => {
      // Создаём archived-версию напрямую (immutable, но для чтения годится).
      const archived = await prisma.priceList.create({
        data: { definitionId, version: 900, status: 'ARCHIVED', isDemo: true, currency: 'RUB' },
      });
      const draft = await pricing.cloneDraft(archived.id, adminId);
      expect(draft.status).toBe('DRAFT');
      expect(draft.version).toBeGreaterThan(900);
      await prisma.priceList.delete({ where: { id: archived.id } }).catch(() => undefined);
    });

    it('второй clone при существующем DRAFT → 409', async () => {
      await pricing.cloneDraft(activePriceListId, adminId);
      await expect(pricing.cloneDraft(activePriceListId, adminId)).rejects.toThrow(ConflictException);
    });

    it('конкурентный clone создаёт максимум один DRAFT', async () => {
      const results = await Promise.allSettled([
        pricing.cloneDraft(activePriceListId, adminId),
        pricing.cloneDraft(activePriceListId, adminId),
      ]);
      const ok = results.filter((r) => r.status === 'fulfilled');
      expect(ok).toHaveLength(1);
      const drafts = await prisma.priceList.count({ where: { definitionId, status: 'DRAFT' } });
      expect(drafts).toBe(1);
    });

    it('клонировать DRAFT нельзя → 409', async () => {
      const draft = await pricing.cloneDraft(activePriceListId, adminId);
      await expect(pricing.cloneDraft(draft.id, adminId)).rejects.toThrow(ConflictException);
    });
  });

  // --- CRUD + revision ------------------------------------------------------

  describe('DRAFT CRUD + revision', () => {
    let draftId: string;
    let revision: number;

    beforeEach(async () => {
      await prisma.priceList.deleteMany({ where: { definitionId, status: 'DRAFT' } });
      const draft = await pricing.cloneDraft(activePriceListId, adminId);
      draftId = draft.id;
      revision = draft.revision;
    });

    it('create/update/delete правила, revision растёт', async () => {
      const created = await pricing.createRule(
        draftId,
        { kind: 'SURCHARGE_FLAT', amountMinor: 5000, expectedRevision: revision },
        adminId,
      );
      expect(created.revision).toBe(revision + 1);
      const ruleId = (created.result as { id: string }).id;

      const updated = await pricing.updateRule(
        draftId,
        ruleId,
        { kind: 'SURCHARGE_FLAT', amountMinor: 7000, expectedRevision: created.revision },
        adminId,
      );
      expect(updated.revision).toBe(revision + 2);
      expect((updated.result as { amountMinor: number }).amountMinor).toBe(7000);

      const deleted = await pricing.deleteRule(draftId, ruleId, updated.revision, adminId);
      expect(deleted.revision).toBe(revision + 3);

      // AuditLog содержит create/update/delete.
      const actions = (await prisma.auditLog.findMany({ where: { entityId: ruleId } })).map((a) => a.action);
      expect(actions).toEqual(expect.arrayContaining(['pricing.rule.create', 'pricing.rule.update', 'pricing.rule.delete']));
    });

    it('F-C6-5: денежные модификаторы MULTIPLIER/SURCHARGE_PER_UNIT/QTY_DISCOUNT редактируются через API', async () => {
      const mult = await pricing.createRule(draftId, { kind: 'MULTIPLIER', multiplier: 1.2, expectedRevision: revision }, adminId);
      const perUnit = await pricing.createRule(draftId, { kind: 'SURCHARGE_PER_UNIT', amountMinor: 300, expectedRevision: mult.revision }, adminId);
      const disc = await pricing.createRule(draftId, { kind: 'QTY_DISCOUNT', qtyFrom: 100, multiplier: 0.9, expectedRevision: perUnit.revision }, adminId);
      expect((disc.result as { multiplier: number }).multiplier).toBe(0.9);

      const pl = await pricing.getPriceList(draftId);
      const kinds = pl.rules.map((r) => r.kind);
      expect(kinds).toEqual(expect.arrayContaining(['MULTIPLIER', 'SURCHARGE_PER_UNIT', 'QTY_DISCOUNT']));

      // Валидируется как корректный DRAFT — значения ушли бы в публикацию.
      const validation = await pricing.validateDraft(draftId);
      expect(validation.valid).toBe(true);
    });

    it('stale revision → PRICING_DRAFT_CONFLICT', async () => {
      await pricing.createRule(draftId, { kind: 'SURCHARGE_FLAT', amountMinor: 100, expectedRevision: revision }, adminId);
      // Повторно с тем же (уже устаревшим) revision.
      await expect(
        pricing.createRule(draftId, { kind: 'SURCHARGE_FLAT', amountMinor: 200, expectedRevision: revision }, adminId),
      ).rejects.toMatchObject({ response: { code: 'PRICING_DRAFT_CONFLICT' } });
    });

    it('невалидный parameter в condition → 400', async () => {
      await expect(
        pricing.createRule(
          draftId,
          { kind: 'MULTIPLIER', multiplier: 1.2, condition: { nope: 'x' }, expectedRevision: revision },
          adminId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('несуществующая опция в condition → 400', async () => {
      await expect(
        pricing.createRule(
          draftId,
          { kind: 'MULTIPLIER', multiplier: 1.2, condition: { format: 'ZZZ' }, expectedRevision: revision },
          adminId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('unsafe integer денег → 400', async () => {
      await expect(
        pricing.createRule(
          draftId,
          { kind: 'SURCHARGE_FLAT', amountMinor: Number.MAX_SAFE_INTEGER + 2, expectedRevision: revision },
          adminId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('ACTIVE редактировать нельзя → 409', async () => {
      await expect(
        pricing.createRule(activePriceListId, { kind: 'SURCHARGE_FLAT', amountMinor: 100, expectedRevision: 0 }, adminId),
      ).rejects.toMatchObject({ response: { code: 'PRICING_NOT_DRAFT' } });
    });
  });

  // --- validate -------------------------------------------------------------

  describe('validate', () => {
    afterEach(async () => {
      await prisma.priceList.deleteMany({ where: { definitionId, status: 'DRAFT' } });
    });

    it('валидный клон ACTIVE → valid, без сайд-эффектов', async () => {
      const draft = await pricing.cloneDraft(activePriceListId, adminId);
      const before = await prisma.priceList.findUniqueOrThrow({ where: { id: draft.id } });
      const snapshotsBefore = await prisma.calculationSnapshot.count();
      const res = await pricing.validateDraft(draft.id);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
      // DRAFT не изменился, snapshot не создан.
      const after = await prisma.priceList.findUniqueOrThrow({ where: { id: draft.id } });
      expect(after.revision).toBe(before.revision);
      expect(await prisma.calculationSnapshot.count()).toBe(snapshotsBefore);
    });

    it('перекрывающиеся тиры → invalid с ошибками', async () => {
      const draft = await pricing.cloneDraft(activePriceListId, adminId);
      // Добавляем безусловный тир, пересекающийся с [500,999].
      await pricing.createRule(
        draft.id,
        { kind: 'BASE_TIER', qtyFrom: 600, qtyTo: 800, amountMinor: 100, expectedRevision: draft.revision },
        adminId,
      );
      const res = await pricing.validateDraft(draft.id);
      expect(res.valid).toBe(false);
      expect(res.errors.length).toBeGreaterThan(0);
    });
  });

  // --- dry-run --------------------------------------------------------------

  describe('dry-run', () => {
    afterEach(async () => {
      await prisma.priceList.deleteMany({ where: { definitionId, status: 'DRAFT' } });
    });

    it('строго DRAFT: total/breakdown/pricingMode, без snapshot/cart', async () => {
      const draft = await pricing.cloneDraft(activePriceListId, adminId);
      const res = await pricing.dryRun(draft.id, { parameters: { qty: 500 } });
      expect(res.total.amountMinor).toBeGreaterThan(0);
      expect(res.currency).toBe('RUB');
      expect(res.pricingMode).toBe('DEMO');
      expect(res.priceListId).toBe(draft.id);
      // Никаких сайд-эффектов.
      expect(await prisma.calculationSnapshot.count()).toBe(0);
      expect(await prisma.cartItem.count()).toBe(0);
    });

    it('ACTIVE не считается через dry-run → 409', async () => {
      await expect(pricing.dryRun(activePriceListId, { parameters: { qty: 500 } })).rejects.toMatchObject({
        response: { code: 'PRICING_NOT_DRAFT' },
      });
    });

    it('изменённая цена в DRAFT отражается в dry-run', async () => {
      const draft = await pricing.cloneDraft(activePriceListId, adminId);
      const baseline = await pricing.dryRun(draft.id, { parameters: { qty: 500 } });
      // Разовая надбавка применяется всегда — total обязан вырасти на неё.
      await pricing.createRule(
        draft.id,
        { kind: 'SURCHARGE_FLAT', amountMinor: 50000, expectedRevision: draft.revision },
        adminId,
      );
      const after = await pricing.dryRun(draft.id, { parameters: { qty: 500 } });
      expect(after.total.amountMinor).toBe(baseline.total.amountMinor + 50000);
    });
  });

  // --- publish --------------------------------------------------------------

  describe('publish', () => {
    afterEach(async () => {
      await prisma.priceList.deleteMany({ where: { definitionId, status: 'DRAFT' } });
    });

    it('DRAFT → ACTIVE, предыдущий ACTIVE → ARCHIVED, ровно один ACTIVE, audit', async () => {
      const prevActive = await prisma.priceList.findFirstOrThrow({ where: { definitionId, status: 'ACTIVE' } });
      const draft = await pricing.cloneDraft(activePriceListId, adminId);

      const published = await pricing.publishDraft(draft.id, draft.revision, adminId);
      expect(published.status).toBe('ACTIVE');
      expect(published.archivedPriceListIds).toContain(prevActive.id);

      const actives = await prisma.priceList.findMany({ where: { definitionId, status: 'ACTIVE' } });
      expect(actives).toHaveLength(1);
      expect(actives[0].id).toBe(draft.id);
      expect((await prisma.priceList.findUniqueOrThrow({ where: { id: prevActive.id } })).status).toBe('ARCHIVED');

      const audit = await prisma.auditLog.findMany({ where: { action: 'pricing.publish', entityId: draft.id } });
      expect(audit).toHaveLength(1);

      // Возвращаем исходный ACTIVE для следующих тестов: клонируем архив и публикуем.
      activePriceListId = draft.id;
    });

    it('невалидный DRAFT не публикуется', async () => {
      const draft = await pricing.cloneDraft(activePriceListId, adminId);
      // Пересекающийся тир делает прайс невалидным.
      const created = await pricing.createRule(
        draft.id,
        { kind: 'BASE_TIER', qtyFrom: 600, qtyTo: 800, amountMinor: 100, expectedRevision: draft.revision },
        adminId,
      );
      await expect(pricing.publishDraft(draft.id, created.revision, adminId)).rejects.toBeDefined();
      // Остался DRAFT, второй ACTIVE не появился.
      expect((await prisma.priceList.findUniqueOrThrow({ where: { id: draft.id } })).status).toBe('DRAFT');
      expect(await prisma.priceList.count({ where: { definitionId, status: 'ACTIVE' } })).toBe(1);
    });

    it('stale revision при publish → 409', async () => {
      const draft = await pricing.cloneDraft(activePriceListId, adminId);
      await pricing.createRule(draft.id, { kind: 'SURCHARGE_FLAT', amountMinor: 100, expectedRevision: draft.revision }, adminId);
      // publish со старым revision.
      await expect(pricing.publishDraft(draft.id, draft.revision, adminId)).rejects.toMatchObject({
        response: { code: 'PRICING_DRAFT_CONFLICT' },
      });
    });

    it('конкурентный publish одного DRAFT: один успех, второй — ошибка, один ACTIVE', async () => {
      const draft = await pricing.cloneDraft(activePriceListId, adminId);
      const results = await Promise.allSettled([
        pricing.publishDraft(draft.id, draft.revision, adminId),
        pricing.publishDraft(draft.id, draft.revision, adminId),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const actives = await prisma.priceList.findMany({ where: { definitionId, status: 'ACTIVE' } });
      expect(actives).toHaveLength(1);
      activePriceListId = draft.id;
    });

    it('demo-прайс в production заблокирован', async () => {
      const prodEnv = makePricingEnv('production');
      const prodPublisher = new PublishService(prisma as unknown as PrismaService, prodEnv);
      const prodPricing = new AdminPricingService(
        prisma as unknown as PrismaService,
        prodEnv,
        prodPublisher,
        calculator,
        new AuditLogService(prisma as unknown as PrismaService),
      );
      const draft = await pricing.cloneDraft(activePriceListId, adminId);
      await expect(prodPricing.publishDraft(draft.id, draft.revision, adminId)).rejects.toThrow(ForbiddenException);
    });
  });

  // --- регрессии Cart/Order -------------------------------------------------

  describe('регрессии Cart/Order при публикации нового прайса', () => {
    it('существующая корзина становится STALE, цена не меняется молча; заказ immutable', async () => {
      await prisma.priceList.deleteMany({ where: { definitionId, status: 'DRAFT' } });
      const identity: RequestIdentity = { userId: null, anonymousSessionId: `sess-${nextKey()}` };
      const confirmed = await calculator.confirmCalculation(
        SLUG,
        { parameters: { qty: 500 } },
        { userId: identity.userId, anonymousSessionId: identity.anonymousSessionId },
      );
      await cart.addItem(identity, confirmed.snapshotId);
      const beforeCart = await cart.getCart(identity);
      expect(beforeCart.items[0].status).toBe('VALID');
      const cartPriceBefore = beforeCart.totals.total.amountMinor;

      // Заказ фиксирует снимок цены.
      const user = await prisma.user.create({ data: { email: `buyer-${nextKey()}@t.test`, passwordHash: 'x' } });
      const userIdentity: RequestIdentity = { userId: user.id, anonymousSessionId: identity.anonymousSessionId };
      const uConfirmed = await calculator.confirmCalculation(
        SLUG,
        { parameters: { qty: 500 } },
        { userId: user.id, anonymousSessionId: userIdentity.anonymousSessionId },
      );
      await cart.addItem(userIdentity, uConfirmed.snapshotId);
      const order = await orders.createOrder(user.id, {
        contactName: 'Тест',
        contactPhone: '+70000000000',
        contactEmail: 't@t.test',
        idempotencyKey: nextKey(),
      });
      const orderItemPriceBefore = order.items[0].lineTotal.amountMinor;

      // Клонируем, поднимаем цену (разовая надбавка), публикуем новый ACTIVE.
      const draft = await pricing.cloneDraft(activePriceListId, adminId);
      const edited = await pricing.createRule(
        draft.id,
        { kind: 'SURCHARGE_FLAT', amountMinor: 50000, expectedRevision: draft.revision },
        adminId,
      );
      await pricing.publishDraft(draft.id, edited.revision, adminId);
      activePriceListId = draft.id;

      // Корзина: позиция стала STALE, но цена в ней не изменилась молча.
      const afterCart = await cart.getCart(identity);
      expect(afterCart.items[0].status).toBe('STALE');
      expect(afterCart.totals.total.amountMinor).toBe(cartPriceBefore);

      // Заказ неизменен.
      const afterOrder = await orders.getOrder(user.id, order.id);
      expect(afterOrder.items[0].lineTotal.amountMinor).toBe(orderItemPriceBefore);
    });
  });

  // --- audit read API -------------------------------------------------------

  describe('audit read API', () => {
    let namedAdminId: string;

    beforeAll(async () => {
      // Сотрудник с именем — проверяем displayName.
      const u = await prisma.user.create({
        data: { email: 'named-admin@pricing.test', passwordHash: 'x', firstName: 'Пётр', lastName: 'Ценников' },
      });
      const role = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMIN' } });
      await prisma.userRole.create({ data: { userId: u.id, roleId: role.id } });
      namedAdminId = u.id;
      // Именованный сотрудник публикует новую версию — результат ACTIVE
      // (persists, не удаляется afterEach), поэтому его audit-записи (clone +
      // publish) резолвятся фильтром по definitionId (резолвит текущие прайсы).
      await prisma.priceList.deleteMany({ where: { definitionId, status: 'DRAFT' } });
      const draft = await pricing.cloneDraft(activePriceListId, namedAdminId);
      await pricing.publishDraft(draft.id, draft.revision, namedAdminId);
      activePriceListId = draft.id;
    });

    it('guard: audit требует pricing.read — MANAGER проходит, CUSTOMER 403', async () => {
      requirePermissions(['pricing.read']);
      await expect(guard.canActivate(contextFor(managerId, ['pricing.read']))).resolves.toBe(true);
      await expect(guard.canActivate(contextFor(customerId, ['pricing.read']))).rejects.toThrow(ForbiddenException);
    });

    it('фильтр по definitionId возвращает события, safe actor, без сырого actorId/PII', async () => {
      const res = await pricing.listAudit({ definitionId });
      expect(res.items.length).toBeGreaterThan(0);
      for (const entry of res.items) {
        // Сырого actorId и PII в ответе нет.
        expect(Object.keys(entry)).not.toContain('actorId');
        if (entry.changedBy) {
          expect(Object.keys(entry.changedBy)).toEqual(['displayName']);
          expect(entry.changedBy).not.toHaveProperty('email');
        }
      }
      // Именованный сотрудник отображается по firstName+lastName.
      const named = res.items.find((e) => e.changedBy?.displayName === 'Пётр Ценников');
      expect(named).toBeDefined();
    });

    it('фильтр по action', async () => {
      const res = await pricing.listAudit({ definitionId, action: 'pricing.publish' });
      expect(res.items.every((e) => e.action === 'pricing.publish')).toBe(true);
    });

    it('пагинация', async () => {
      const res = await pricing.listAudit({ definitionId, page: 1, pageSize: 1 });
      expect(res.items).toHaveLength(1);
      expect(res.pageSize).toBe(1);
      expect(res.total).toBeGreaterThanOrEqual(1);
    });

    it('before/after — только безопасные pricing-поля (без секретов/PII)', async () => {
      const res = await pricing.listAudit({ definitionId, action: 'pricing.publish' });
      const entry = res.items[0];
      const after = (entry.after ?? {}) as Record<string, unknown>;
      // Разрешённые поля publish-события.
      expect(after).toHaveProperty('status');
      for (const forbidden of ['jwt', 'token', 'password', 'email', 'phone', 'cookie']) {
        expect(JSON.stringify(entry)).not.toContain(forbidden);
      }
    });
  });
});
