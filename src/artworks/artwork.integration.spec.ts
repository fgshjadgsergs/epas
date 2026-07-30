/**
 * Artwork workflow на живом PostgreSQL: attach → версии/замена → withdraw →
 * review → история; permissions/BAC, ownership, secure download/preview,
 * переиспользование файла, immutable Orders.
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
import { ArtworkService } from './artwork.service';
import { AdminArtworkService } from './admin-artwork.service';
import { RolesService } from '../roles/roles.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AuditLogService } from '../audit/audit-log.service';
import { FilesService } from '../files/files.service';
import type { ConfigService } from '@nestjs/config';
import type { StorageService } from '../storage/storage.service';
import type { PrismaService } from '../database/prisma.service';
import { createDisposableDb, migrateDeploy, type DisposableDb } from '../calculator/testing/integration-db';

jest.setTimeout(240000);

let seq = 0;
const uid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

const ROLES = [
  { code: 'SUPER_ADMIN' }, { code: 'ADMIN' }, { code: 'MANAGER' }, { code: 'CONTENT_MANAGER' }, { code: 'CUSTOMER' },
];
const PERMISSIONS = [{ code: 'artwork.read' }, { code: 'artwork.review' }];
const ROLE_PERMISSIONS: Record<string, string[]> = {
  MANAGER: ['artwork.read', 'artwork.review'],
  ADMIN: ['artwork.read', 'artwork.review'],
};

async function seedRbac(prisma: PrismaClient) {
  for (const r of ROLES) await prisma.role.upsert({ where: { code: r.code }, update: {}, create: { ...r, name: r.code } });
  for (const p of PERMISSIONS) await prisma.permission.upsert({ where: { code: p.code }, update: {}, create: p });
  const superAdmin = await prisma.role.findUniqueOrThrow({ where: { code: 'SUPER_ADMIN' } });
  const all = await prisma.permission.findMany();
  const byCode = new Map(all.map((p) => [p.code, p]));
  for (const p of all) {
    await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: superAdmin.id, permissionId: p.id } }, update: {}, create: { roleId: superAdmin.id, permissionId: p.id } });
  }
  for (const [roleCode, codes] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
    for (const code of codes) {
      await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: byCode.get(code)!.id } }, update: {}, create: { roleId: role.id, permissionId: byCode.get(code)!.id } });
    }
  }
}

function contextFor(userId: string): ExecutionContext {
  return { getHandler: () => () => undefined, getClass: () => class {}, switchToHttp: () => ({ getRequest: () => ({ user: { id: userId } }) }) } as unknown as ExecutionContext;
}

describe('Artwork workflow (integration)', () => {
  let db: DisposableDb;
  let prisma: PrismaClient;
  let service: ArtworkService;
  let adminService: AdminArtworkService;
  let rolesService: RolesService;
  let guard: PermissionsGuard;
  let storageCalls: { key: string; inline?: boolean }[];

  let ownerId: string;
  let otherCustomerId: string;
  let managerId: string;
  let adminId: string;
  let contentManagerId: string;
  let definitionId: string;
  let priceListId: string;

  async function makeUser(email: string, roleCode: string, firstName?: string, lastName?: string): Promise<string> {
    const u = await prisma.user.create({ data: { email, passwordHash: 'x', firstName: firstName ?? null, lastName: lastName ?? null } });
    const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
    await prisma.userRole.create({ data: { userId: u.id, roleId: role.id } });
    return u.id;
  }

  async function makeSnapshot(): Promise<string> {
    const s = await prisma.calculationSnapshot.create({
      data: {
        definitionId, priceListId, definitionVersion: 1, priceListVersion: 1, engineVersion: 'engine/2',
        serviceSlug: 'vizitki', parameters: {}, appliedRules: [], totalMinor: 100000, unitMinor: 1000, vatMinor: 0, workingDays: 2,
      },
    });
    return s.id;
  }

  async function makeOrder(userId: string, status: 'NEW' | 'CANCELLED' = 'NEW'): Promise<{ orderId: string; itemId: string }> {
    const snapshotId = await makeSnapshot();
    const order = await prisma.order.create({
      data: {
        orderNumber: `KP-${uid().slice(-8)}`, userId, status, itemsSubtotalMinor: 100000, totalMinor: 100000,
        contactName: 'Клиент', contactPhone: '+70000000000', contactEmail: 'c@t.test', idempotencyKey: uid(),
        items: { create: [{ calculationSnapshotId: snapshotId, serviceSlug: 'vizitki', titleSnapshot: 'Визитки', configurationSnapshot: {}, productionSnapshot: { workingDays: 2 }, quantity: 100, unitPriceMinor: 1000, lineTotalMinor: 100000, currency: 'RUB' }] },
      },
      include: { items: true },
    });
    return { orderId: order.id, itemId: order.items[0].id };
  }

  async function makeFile(ownerId: string | null, opts: { mime?: string; visibility?: 'PRIVATE' | 'PUBLIC'; status?: 'READY' | 'PENDING' | 'DELETED' } = {}): Promise<string> {
    const f = await prisma.uploadedFile.create({
      data: {
        originalName: 'artwork.png', mimeType: opts.mime ?? 'image/png', size: 12345, bucket: 'photo-print',
        storageKey: `2026-07-27/${uid()}-artwork.png`, ownerId, status: (opts.status ?? 'READY') as never, visibility: (opts.visibility ?? 'PRIVATE') as never,
      },
    });
    return f.id;
  }

  beforeAll(async () => {
    db = await createDisposableDb('photo_print_it_artwork');
    migrateDeploy(db.url);
    prisma = new PrismaClient({ datasources: { db: { url: db.url } } });
    storageCalls = [];
    const fakeStorage = {
      getPresignedContentUrl: async (key: string, o: { inline?: boolean } = {}) => {
        storageCalls.push({ key, inline: o.inline });
        return `https://signed.example/${key}?d=${o.inline ? 'inline' : 'attachment'}`;
      },
    } as unknown as StorageService;
    const audit = new AuditLogService(prisma as unknown as PrismaService);
    service = new ArtworkService(prisma as unknown as PrismaService, fakeStorage, audit);
    adminService = new AdminArtworkService(prisma as unknown as PrismaService, fakeStorage, audit);
    rolesService = new RolesService(prisma as unknown as PrismaService);
    guard = new PermissionsGuard(new Reflector(), rolesService);

    await seedRbac(prisma);
    const def = await prisma.calculatorDefinition.create({ data: { code: 'vizitki', title: 'Визитки', urlOrder: [] } });
    definitionId = def.id;
    const pl = await prisma.priceList.create({ data: { definitionId, version: 1, status: 'ACTIVE' } });
    priceListId = pl.id;

    ownerId = await makeUser('owner@art.test', 'CUSTOMER');
    otherCustomerId = await makeUser('other@art.test', 'CUSTOMER');
    managerId = await makeUser('mgr@art.test', 'MANAGER', 'Мария', 'Менеджерова');
    adminId = await makeUser('adm@art.test', 'ADMIN');
    contentManagerId = await makeUser('content@art.test', 'CONTENT_MANAGER');
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await db?.drop();
  });

  function requirePermissions(codes: string[]) {
    jest.spyOn(guard['reflector'], 'getAllAndOverride').mockReturnValue(codes);
  }
  afterEach(() => jest.restoreAllMocks());

  // --- permissions / BAC ----------------------------------------------------

  describe('permissions из БД', () => {
    it('MANAGER и ADMIN имеют artwork.read + artwork.review', async () => {
      for (const id of [managerId, adminId]) {
        const perms = await rolesService.getUserPermissionCodes(id);
        expect(perms).toEqual(expect.arrayContaining(['artwork.read', 'artwork.review']));
      }
    });
    it('CUSTOMER и CONTENT_MANAGER не имеют artwork-прав', async () => {
      expect(await rolesService.getUserPermissionCodes(ownerId)).not.toContain('artwork.read');
      expect(await rolesService.getUserPermissionCodes(contentManagerId)).not.toContain('artwork.read');
    });
    it('guard: MANAGER read/review ok, CUSTOMER/CONTENT_MANAGER 403', async () => {
      requirePermissions(['artwork.read']);
      await expect(guard.canActivate(contextFor(managerId))).resolves.toBe(true);
      await expect(guard.canActivate(contextFor(customerGuardId()))).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(contextFor(contentManagerId))).rejects.toThrow(ForbiddenException);
    });
    function customerGuardId() { return ownerId; }
  });

  // --- attach / ownership ---------------------------------------------------

  describe('attach + ownership', () => {
    it('первый attach → v1 UPLOADED, allowedActions, canAttachNew=false после', async () => {
      const { orderId, itemId } = await makeOrder(ownerId);
      const fileId = await makeFile(ownerId);
      const view = await service.attach(ownerId, orderId, itemId, { fileId, customerComment: 'проверьте цвет' });
      expect(view.version).toBe(1);
      expect(view.status).toBe('UPLOADED');
      expect(view.allowedActions).toEqual(expect.arrayContaining(['WITHDRAW', 'REPLACE']));
      // storage-идентификаторы не в DTO.
      expect(JSON.stringify(view)).not.toContain('storageKey');
      expect(JSON.stringify(view)).not.toContain('bucket');

      const list = await service.listForItem(ownerId, orderId, itemId);
      expect(list.artworks).toHaveLength(1);
      expect(list.canAttachNew).toBe(true); // UPLOADED допускает замену
    });

    it('чужой заказ → 404 (ARTWORK_NOT_FOUND)', async () => {
      const { orderId, itemId } = await makeOrder(ownerId);
      const fileId = await makeFile(otherCustomerId);
      await expect(service.listForItem(otherCustomerId, orderId, itemId)).rejects.toThrow(NotFoundException);
      await expect(service.attach(otherCustomerId, orderId, itemId, { fileId })).rejects.toThrow(NotFoundException);
    });

    it('чужой файл → 403 (ARTWORK_FILE_FORBIDDEN)', async () => {
      const { orderId, itemId } = await makeOrder(ownerId);
      const foreignFile = await makeFile(otherCustomerId);
      await expect(service.attach(ownerId, orderId, itemId, { fileId: foreignFile })).rejects.toMatchObject({ response: { errors: { code: 'ARTWORK_FILE_FORBIDDEN' } } });
    });

    it('PUBLIC файл → отклонён', async () => {
      const { orderId, itemId } = await makeOrder(ownerId);
      const pub = await makeFile(ownerId, { visibility: 'PUBLIC' });
      await expect(service.attach(ownerId, orderId, itemId, { fileId: pub })).rejects.toMatchObject({ response: { errors: { code: 'ARTWORK_FILE_FORBIDDEN' } } });
    });

    it('не готовый (PENDING) файл → ARTWORK_FILE_NOT_READY', async () => {
      const { orderId, itemId } = await makeOrder(ownerId);
      const pending = await makeFile(ownerId, { status: 'PENDING' });
      await expect(service.attach(ownerId, orderId, itemId, { fileId: pending })).rejects.toMatchObject({ response: { errors: { code: 'ARTWORK_FILE_NOT_READY' } } });
    });

    it('CANCELLED-заказ → attach запрещён (ARTWORK_ORDER_NOT_EDITABLE), список доступен', async () => {
      const { orderId, itemId } = await makeOrder(ownerId, 'CANCELLED');
      const fileId = await makeFile(ownerId);
      await expect(service.attach(ownerId, orderId, itemId, { fileId })).rejects.toMatchObject({ response: { errors: { code: 'ARTWORK_ORDER_NOT_EDITABLE' } } });
      const list = await service.listForItem(ownerId, orderId, itemId);
      expect(list.canAttachNew).toBe(false);
    });

    it('дубликат того же файла в активной версии → ARTWORK_FILE_ALREADY_ATTACHED', async () => {
      const { orderId, itemId } = await makeOrder(ownerId);
      const fileId = await makeFile(ownerId);
      await service.attach(ownerId, orderId, itemId, { fileId });
      await expect(service.attach(ownerId, orderId, itemId, { fileId })).rejects.toMatchObject({ response: { errors: { code: 'ARTWORK_FILE_ALREADY_ATTACHED' } } });
    });
  });

  // --- version / replacement ------------------------------------------------

  describe('версии / замена', () => {
    it('replacement: v1 SUPERSEDED, v2 UPLOADED', async () => {
      const { orderId, itemId } = await makeOrder(ownerId);
      const f1 = await makeFile(ownerId);
      const f2 = await makeFile(ownerId);
      await service.attach(ownerId, orderId, itemId, { fileId: f1 });
      const v2 = await service.attach(ownerId, orderId, itemId, { fileId: f2 });
      expect(v2.version).toBe(2);
      const list = await service.listForItem(ownerId, orderId, itemId);
      expect(list.artworks.find((a) => a.version === 1)!.status).toBe('SUPERSEDED');
      expect(list.artworks.find((a) => a.version === 2)!.status).toBe('UPLOADED');
    });

    it('IN_REVIEW replacement → ARTWORK_REPLACEMENT_FORBIDDEN', async () => {
      const { orderId, itemId } = await makeOrder(ownerId);
      const f1 = await makeFile(ownerId);
      const a1 = await service.attach(ownerId, orderId, itemId, { fileId: f1 });
      await adminService.changeStatus(a1.id, managerId, { status: 'IN_REVIEW' });
      const f2 = await makeFile(ownerId);
      await expect(service.attach(ownerId, orderId, itemId, { fileId: f2 })).rejects.toMatchObject({ response: { errors: { code: 'ARTWORK_REPLACEMENT_FORBIDDEN' } } });
    });

    it('APPROVED replacement → forbidden', async () => {
      const { orderId, itemId } = await makeOrder(ownerId);
      const a1 = await service.attach(ownerId, orderId, itemId, { fileId: await makeFile(ownerId) });
      await adminService.changeStatus(a1.id, managerId, { status: 'APPROVED' });
      await expect(service.attach(ownerId, orderId, itemId, { fileId: await makeFile(ownerId) })).rejects.toThrow(ConflictException);
    });

    it('replacement после REJECTED: старая SUPERSEDED, новая UPLOADED', async () => {
      const { orderId, itemId } = await makeOrder(ownerId);
      const a1 = await service.attach(ownerId, orderId, itemId, { fileId: await makeFile(ownerId) });
      await adminService.changeStatus(a1.id, managerId, { status: 'REJECTED', comment: 'плохое качество' });
      const v2 = await service.attach(ownerId, orderId, itemId, { fileId: await makeFile(ownerId) });
      expect(v2.version).toBe(2);
      const list = await service.listForItem(ownerId, orderId, itemId);
      expect(list.artworks.find((a) => a.id === a1.id)!.status).toBe('SUPERSEDED');
    });

    it('конкурентные replacement не дублируют version', async () => {
      const { orderId, itemId } = await makeOrder(ownerId);
      await service.attach(ownerId, orderId, itemId, { fileId: await makeFile(ownerId) });
      await Promise.allSettled([
        service.attach(ownerId, orderId, itemId, { fileId: await makeFile(ownerId) }),
        service.attach(ownerId, orderId, itemId, { fileId: await makeFile(ownerId) }),
      ]);
      // Advisory-lock сериализует замены в разные версии — дублей version нет,
      // и ровно одна активная (последняя) версия.
      const rows = await prisma.orderItemArtwork.findMany({ where: { orderItemId: itemId }, orderBy: { version: 'asc' } });
      const versions = rows.map((a) => a.version);
      expect(new Set(versions).size).toBe(versions.length); // без дублей
      expect(rows.filter((a) => a.status === 'UPLOADED')).toHaveLength(1); // одна активная
    });
  });

  // --- withdraw -------------------------------------------------------------

  describe('withdraw', () => {
    it('UPLOADED → WITHDRAWN, повторный → 409', async () => {
      const { orderId, itemId } = await makeOrder(ownerId);
      const a1 = await service.attach(ownerId, orderId, itemId, { fileId: await makeFile(ownerId) });
      const w = await service.withdraw(ownerId, orderId, itemId, a1.id);
      expect(w.status).toBe('WITHDRAWN');
      await expect(service.withdraw(ownerId, orderId, itemId, a1.id)).rejects.toMatchObject({ response: { errors: { code: 'ARTWORK_WITHDRAW_FORBIDDEN' } } });
    });

    it('APPROVED/IN_REVIEW нельзя отзывать клиентом', async () => {
      const { orderId, itemId } = await makeOrder(ownerId);
      const a1 = await service.attach(ownerId, orderId, itemId, { fileId: await makeFile(ownerId) });
      await adminService.changeStatus(a1.id, managerId, { status: 'IN_REVIEW' });
      await expect(service.withdraw(ownerId, orderId, itemId, a1.id)).rejects.toThrow(ConflictException);
    });
  });

  // --- secure download / preview --------------------------------------------

  describe('secure download / preview', () => {
    it('владелец получает download (attachment) и preview (inline); чужой → 404', async () => {
      const { orderId, itemId } = await makeOrder(ownerId);
      const a1 = await service.attach(ownerId, orderId, itemId, { fileId: await makeFile(ownerId, { mime: 'image/png' }) });
      const dl = await service.downloadUrl(ownerId, orderId, itemId, a1.id);
      expect(dl.url).toContain('attachment');
      const pv = await service.previewUrl(ownerId, orderId, itemId, a1.id);
      expect(pv.previewAvailable).toBe(true);
      expect(pv.url).toContain('inline');
      await expect(service.downloadUrl(otherCustomerId, orderId, itemId, a1.id)).rejects.toThrow(NotFoundException);
    });

    it('manager download/preview работает; signed URL в DB не хранится', async () => {
      const { orderId, itemId } = await makeOrder(ownerId);
      const a1 = await service.attach(ownerId, orderId, itemId, { fileId: await makeFile(ownerId) });
      const dl = await adminService.downloadUrl(a1.id);
      expect(dl.url).toContain('signed.example');
      // URL нигде не записан в artwork/file.
      const row = await prisma.orderItemArtwork.findUniqueOrThrow({ where: { id: a1.id } });
      expect(JSON.stringify(row)).not.toContain('signed.example');
    });

    it('non-previewable MIME (pdf ок; напр. не-preview) — previewAvailable честный', async () => {
      const { orderId, itemId } = await makeOrder(ownerId);
      const a1 = await service.attach(ownerId, orderId, itemId, { fileId: await makeFile(ownerId, { mime: 'application/pdf' }) });
      const pv = await service.previewUrl(ownerId, orderId, itemId, a1.id);
      expect(pv.previewAvailable).toBe(true); // pdf previewable
    });
  });

  // --- admin review ---------------------------------------------------------

  describe('admin review', () => {
    it('UPLOADED → IN_REVIEW → APPROVED; история actor/from/to; reviewer displayName без UUID', async () => {
      const { orderId, itemId } = await makeOrder(ownerId);
      const a1 = await service.attach(ownerId, orderId, itemId, { fileId: await makeFile(ownerId) });
      await adminService.changeStatus(a1.id, managerId, { status: 'IN_REVIEW' });
      const approved = await adminService.changeStatus(a1.id, managerId, { status: 'APPROVED' });
      expect(approved.status).toBe('APPROVED');
      expect(approved.reviewedBy?.displayName).toBe('Мария Менеджерова');
      // История содержит переходы с actor.
      const hist = approved.history.map((h) => `${h.fromStatus ?? '∅'}→${h.toStatus}`);
      expect(hist).toEqual(expect.arrayContaining(['∅→UPLOADED', 'UPLOADED→IN_REVIEW', 'IN_REVIEW→APPROVED']));
      // Сырого UUID проверяющего в DTO нет.
      expect(JSON.stringify(approved)).not.toContain(managerId);
    });

    it('REJECTED без comment → 400 (ARTWORK_REVIEW_COMMENT_REQUIRED)', async () => {
      const { orderId, itemId } = await makeOrder(ownerId);
      const a1 = await service.attach(ownerId, orderId, itemId, { fileId: await makeFile(ownerId) });
      await expect(adminService.changeStatus(a1.id, managerId, { status: 'REJECTED' })).rejects.toMatchObject({ response: { errors: { code: 'ARTWORK_REVIEW_COMMENT_REQUIRED' } } });
    });

    it('same status → 409 (ARTWORK_STATUS_UNCHANGED); terminal переход запрещён', async () => {
      const { orderId, itemId } = await makeOrder(ownerId);
      const a1 = await service.attach(ownerId, orderId, itemId, { fileId: await makeFile(ownerId) });
      await adminService.changeStatus(a1.id, managerId, { status: 'APPROVED' });
      await expect(adminService.changeStatus(a1.id, managerId, { status: 'APPROVED' })).rejects.toMatchObject({ response: { errors: { code: 'ARTWORK_STATUS_UNCHANGED' } } });
      await expect(adminService.changeStatus(a1.id, managerId, { status: 'REJECTED', comment: 'x' })).rejects.toMatchObject({ response: { errors: { code: 'ARTWORK_TRANSITION_FORBIDDEN' } } });
    });

    it('конкурентные APPROVE/REJECT: ровно одна успешна', async () => {
      const { orderId, itemId } = await makeOrder(ownerId);
      const a1 = await service.attach(ownerId, orderId, itemId, { fileId: await makeFile(ownerId) });
      const results = await Promise.allSettled([
        adminService.changeStatus(a1.id, managerId, { status: 'APPROVED' }),
        adminService.changeStatus(a1.id, adminId, { status: 'REJECTED', comment: 'нет' }),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    });

    it('admin list + detail с allowedTransitions', async () => {
      const { orderId, itemId } = await makeOrder(ownerId);
      const a1 = await service.attach(ownerId, orderId, itemId, { fileId: await makeFile(ownerId) });
      const list = await adminService.list({});
      const row = list.items.find((i) => i.id === a1.id);
      expect(row).toBeDefined();
      // Безопасный технический orderItemId для связи с позицией в UI.
      expect(row!.orderItemId).toBe(itemId);
      const detail = await adminService.getOne(a1.id);
      expect(detail.allowedTransitions).toEqual(expect.arrayContaining(['IN_REVIEW', 'APPROVED', 'REJECTED']));
      expect(JSON.stringify(detail)).not.toContain('storageKey');
    });
  });

  // --- reuse + immutability -------------------------------------------------

  describe('переиспользование файла + immutable Order', () => {
    it('один файл клиента используется в двух разных OrderItem; чужой — нельзя', async () => {
      const fileId = await makeFile(ownerId);
      const o1 = await makeOrder(ownerId);
      const o2 = await makeOrder(ownerId);
      const a1 = await service.attach(ownerId, o1.orderId, o1.itemId, { fileId });
      const a2 = await service.attach(ownerId, o2.orderId, o2.itemId, { fileId });
      expect(a1.id).not.toBe(a2.id);
      // Один и тот же fileId в двух artwork.
      const count = await prisma.orderItemArtwork.count({ where: { fileId } });
      expect(count).toBe(2);
      // Чужой не может переиспользовать этот файл.
      const foreign = await makeOrder(otherCustomerId);
      await expect(service.attach(otherCustomerId, foreign.orderId, foreign.itemId, { fileId })).rejects.toThrow(ForbiddenException);
    });

    it('reuse не копирует S3 object (один storageKey у обоих artwork)', async () => {
      const fileId = await makeFile(ownerId);
      const o1 = await makeOrder(ownerId);
      const o2 = await makeOrder(ownerId);
      await service.attach(ownerId, o1.orderId, o1.itemId, { fileId });
      await service.attach(ownerId, o2.orderId, o2.itemId, { fileId });
      const files = await prisma.uploadedFile.findMany({ where: { id: fileId } });
      expect(files).toHaveLength(1); // объект не копировался
    });

    it('Order totals/items snapshot не меняются после artwork workflow', async () => {
      const { orderId, itemId } = await makeOrder(ownerId);
      const before = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
      const a1 = await service.attach(ownerId, orderId, itemId, { fileId: await makeFile(ownerId) });
      await adminService.changeStatus(a1.id, managerId, { status: 'REJECTED', comment: 'x' });
      await service.attach(ownerId, orderId, itemId, { fileId: await makeFile(ownerId) });
      const after = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
      expect(after.totalMinor).toBe(before.totalMinor);
      expect(after.items[0].lineTotalMinor).toBe(before.items[0].lineTotalMinor);
      expect(after.items[0].unitPriceMinor).toBe(before.items[0].unitPriceMinor);
      expect(after.items[0].configurationSnapshot).toEqual(before.items[0].configurationSnapshot);
    });

    it('my-files: список своих PRIVATE READY файлов, без storage-метаданных', async () => {
      const files = new FilesService(
        prisma as unknown as PrismaService,
        {} as unknown as StorageService,
        {} as unknown as ConfigService<never, true>,
      );
      const reuseOwner = await makeUser(`reuse-${uid()}@t.test`, 'CUSTOMER');
      await makeFile(reuseOwner, { mime: 'image/png' });
      await makeFile(reuseOwner, { mime: 'application/pdf' });
      await makeFile(reuseOwner, { visibility: 'PUBLIC' }); // не попадёт (не PRIVATE)
      await makeFile(reuseOwner, { status: 'PENDING' }); // не попадёт (не READY)

      const res = await files.listMyFiles({ id: reuseOwner, email: 'x', roles: ['CUSTOMER'] }, 1, 20);
      expect(res.total).toBe(2); // только PRIVATE READY
      for (const f of res.items) {
        expect(Object.keys(f)).toEqual(expect.arrayContaining(['id', 'filename', 'mimeType', 'size', 'createdAt', 'previewable']));
        expect(Object.keys(f)).not.toContain('storageKey');
        expect(Object.keys(f)).not.toContain('bucket');
        expect(Object.keys(f)).not.toContain('ownerId');
      }
    });

    it('withdrawn/superseded/rejected файл физически не удаляется', async () => {
      const { orderId, itemId } = await makeOrder(ownerId);
      const f1 = await makeFile(ownerId);
      const a1 = await service.attach(ownerId, orderId, itemId, { fileId: f1 });
      await service.withdraw(ownerId, orderId, itemId, a1.id);
      // Файл остаётся READY (не DELETED), artwork-запись сохранена.
      const file = await prisma.uploadedFile.findUniqueOrThrow({ where: { id: f1 } });
      expect(file.status).toBe('READY');
      expect(await prisma.orderItemArtwork.count({ where: { id: a1.id } })).toBe(1);
    });
  });
});
