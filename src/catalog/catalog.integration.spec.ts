/**
 * Admin catalog на живом PostgreSQL: permissions (catalog.manage), безопасное
 * удаление категорий, агрегаты, услуги + категория/калькулятор, и инвариант
 * «максимум одно основное изображение» с безопасным DTO.
 */
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { CategoriesService } from './categories/categories.service';
import { ServicesService } from './services/services.service';
import { RolesService } from '../roles/roles.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { PERMISSION_CODES } from '../common/constants/permissions.constant';
import type { PrismaService } from '../database/prisma.service';
import type { StorageService } from '../storage/storage.service';
import type { FilesService } from '../files/files.service';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { createDisposableDb, migrateDeploy, type DisposableDb } from '../calculator/testing/integration-db';

jest.setTimeout(240000);

let seq = 0;
const uid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

const ROLE_PERMISSIONS: Record<string, string[]> = {
  CONTENT_MANAGER: ['catalog.manage'],
  ADMIN: ['catalog.manage', 'orders.read'],
  MANAGER: ['orders.read'],
};

async function seedRbac(prisma: PrismaClient) {
  for (const code of ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CONTENT_MANAGER', 'CUSTOMER']) {
    await prisma.role.upsert({ where: { code }, update: {}, create: { code, name: code } });
  }
  for (const code of ['catalog.manage', 'orders.read']) {
    await prisma.permission.upsert({ where: { code }, update: {}, create: { code } });
  }
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
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user: { id: userId } }) }),
  } as unknown as ExecutionContext;
}

describe('Admin catalog (integration)', () => {
  let db: DisposableDb;
  let prisma: PrismaClient;
  let categories: CategoriesService;
  let services: ServicesService;
  let guard: PermissionsGuard;
  let deleted: string[];

  const user = (roles: string[]): AuthenticatedUser => ({ id: 'u', email: 'e', roles });

  async function makeUser(roleCode: string): Promise<string> {
    const u = await prisma.user.create({ data: { email: `${uid()}@t.test`, passwordHash: 'x' } });
    const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
    await prisma.userRole.create({ data: { userId: u.id, roleId: role.id } });
    return u.id;
  }

  beforeAll(async () => {
    db = await createDisposableDb('photo_print_it_catalog');
    migrateDeploy(db.url);
    prisma = new PrismaClient({ datasources: { db: { url: db.url } } });
    deleted = [];
    const fakeStorage = { deleteObject: async (key: string) => { deleted.push(key); } } as unknown as StorageService;
    // uploadCatalogImage: создаём реальную PUBLIC-строку файла (storage не трогаем).
    const fakeFiles = {
      uploadCatalogImage: async () =>
        prisma.uploadedFile.create({
          data: { originalName: 'card.png', mimeType: 'image/png', size: 10, bucket: 'b', storageKey: `k/${uid()}`, publicUrl: 'http://pub/x.png', status: 'READY', visibility: 'PUBLIC' },
        }),
    } as unknown as FilesService;

    categories = new CategoriesService(prisma as unknown as PrismaService);
    services = new ServicesService(prisma as unknown as PrismaService, fakeStorage, fakeFiles);
    guard = new PermissionsGuard(new Reflector(), new RolesService(prisma as unknown as PrismaService));
    await seedRbac(prisma);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await db?.drop();
  });

  // --- permissions ----------------------------------------------------------

  describe('catalog.manage enforcement', () => {
    const canManage = (userId: string) => {
      jest.spyOn(Reflector.prototype, 'getAllAndOverride').mockReturnValue([PERMISSION_CODES.CATALOG_MANAGE]);
      return guard.canActivate(contextFor(userId));
    };
    afterEach(() => jest.restoreAllMocks());

    it('CONTENT_MANAGER и ADMIN имеют catalog.manage', async () => {
      expect(await canManage(await makeUser('CONTENT_MANAGER'))).toBe(true);
      expect(await canManage(await makeUser('ADMIN'))).toBe(true);
    });
    it('SUPER_ADMIN проходит через grant-all', async () => {
      expect(await canManage(await makeUser('SUPER_ADMIN'))).toBe(true);
    });
    it('MANAGER и CUSTOMER — нет доступа к каталогу', async () => {
      await expect(canManage(await makeUser('MANAGER'))).rejects.toBeInstanceOf(ForbiddenException);
      await expect(canManage(await makeUser('CUSTOMER'))).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // --- categories -----------------------------------------------------------

  describe('categories', () => {
    it('create + duplicate slug конфликт', async () => {
      const c = await categories.create({ slug: `cat-${uid().slice(-6)}`, title: 'Кат' } as never);
      expect(c.isActive).toBe(true);
      await expect(categories.create({ slug: c.slug, title: 'Дубль' } as never)).rejects.toMatchObject({ status: 409 });
    });

    it('findAllForAdmin отдаёт serviceCount', async () => {
      const c = await categories.create({ slug: `cat-cnt-${uid().slice(-6)}`, title: 'С услугами' } as never);
      await services.create({ categoryId: c.id, slug: `svc-${uid().slice(-6)}`, title: 'Услуга' } as never);
      const list = await categories.findAllForAdmin();
      const row = list.find((x) => x.id === c.id);
      expect(row?.serviceCount).toBe(1);
    });

    it('нельзя удалить категорию с услугами', async () => {
      const c = await categories.create({ slug: `cat-del-${uid().slice(-6)}`, title: 'Занята' } as never);
      await services.create({ categoryId: c.id, slug: `svc-del-${uid().slice(-6)}`, title: 'Услуга' } as never);
      await expect(categories.remove(c.id)).rejects.toMatchObject({ status: 400 });
    });

    it('пустую категорию удалить можно', async () => {
      const c = await categories.create({ slug: `cat-empty-${uid().slice(-6)}`, title: 'Пустая' } as never);
      await expect(categories.remove(c.id)).resolves.toBeUndefined();
    });
  });

  // --- services + images ----------------------------------------------------

  describe('services + images', () => {
    async function makeService() {
      const c = await categories.create({ slug: `cat-s-${uid().slice(-6)}`, title: 'Кат' } as never);
      const s = await services.create({ categoryId: c.id, slug: `svc-s-${uid().slice(-6)}`, title: 'Услуга' } as never);
      return s.id;
    }

    it('admin detail: категория и калькулятор (null, если не подключён)', async () => {
      const id = await makeService();
      const detail = await services.findByIdForAdmin(id);
      expect(detail.category.title).toBe('Кат');
      expect(detail.calculator).toBeNull();
    });

    it('первое изображение — основное, второе — нет', async () => {
      const id = await makeService();
      const img1 = await services.addImage(id, {} as never, user(['CONTENT_MANAGER']));
      const img2 = await services.addImage(id, {} as never, user(['CONTENT_MANAGER']));
      expect(img1.isMain).toBe(true);
      expect(img2.isMain).toBe(false);
      // Safe DTO: никаких storage-полей.
      expect(JSON.stringify(img1)).not.toContain('storageKey');
      expect(JSON.stringify(img1)).not.toContain('bucket');
    });

    it('назначение основного снимает флаг с прежнего (единственный isMain)', async () => {
      const id = await makeService();
      const img1 = await services.addImage(id, {} as never, user(['CONTENT_MANAGER']));
      const img2 = await services.addImage(id, {} as never, user(['CONTENT_MANAGER']));
      await services.updateImage(id, img2.id, { isMain: true });
      const detail = await services.findByIdForAdmin(id);
      const mains = detail.images.filter((i) => i.isMain);
      expect(mains).toHaveLength(1);
      expect(mains[0].id).toBe(img2.id);
    });

    it('удаление основного назначает основным следующее', async () => {
      const id = await makeService();
      const img1 = await services.addImage(id, {} as never, user(['CONTENT_MANAGER']));
      const img2 = await services.addImage(id, {} as never, user(['CONTENT_MANAGER']));
      await services.removeImage(id, img1.id);
      const detail = await services.findByIdForAdmin(id);
      expect(detail.images).toHaveLength(1);
      expect(detail.images[0].id).toBe(img2.id);
      expect(detail.images[0].isMain).toBe(true);
      expect(deleted.length).toBeGreaterThan(0); // storage-объект удалён
    });
  });
});
