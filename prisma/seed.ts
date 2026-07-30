import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { ROLE_CODES } from '../src/common/constants/roles.constant';

const DEFAULT_SEED_ADMIN_PASSWORD = 'ChangeMe123!';

const prisma = new PrismaClient();

const ROLES: { code: string; name: string; isSystem: boolean }[] = [
  { code: ROLE_CODES.SUPER_ADMIN, name: 'Супер-администратор', isSystem: true },
  { code: ROLE_CODES.ADMIN, name: 'Администратор', isSystem: true },
  { code: ROLE_CODES.MANAGER, name: 'Менеджер', isSystem: false },
  { code: ROLE_CODES.CONTENT_MANAGER, name: 'Контент-менеджер', isSystem: false },
  { code: ROLE_CODES.CUSTOMER, name: 'Клиент', isSystem: true },
];

const PERMISSIONS: { code: string; description: string }[] = [
  { code: 'catalog.manage', description: 'Управление категориями и услугами' },
  { code: 'files.manage', description: 'Управление файлами' },
  { code: 'users.manage', description: 'Управление пользователями и ролями' },
  { code: 'orders.read', description: 'Просмотр любых заказов в админке' },
  { code: 'orders.status.change', description: 'Смена статуса заказа' },
  { code: 'pricing.read', description: 'Просмотр прайсов и dry-run' },
  { code: 'pricing.draft.edit', description: 'Редактирование правил DRAFT-прайса' },
  { code: 'pricing.publish', description: 'Публикация DRAFT-прайса' },
  { code: 'artwork.read', description: 'Просмотр макетов заказов' },
  { code: 'artwork.review', description: 'Проверка макетов (смена статуса)' },
];

/**
 * Назначение permissions ролям (кроме SUPER_ADMIN — он получает все права
 * ниже отдельным циклом). CUSTOMER прав не получает. Менеджер видит прайсы
 * (read/dry-run), но публикует только администратор. Каталогом управляют
 * CONTENT_MANAGER и ADMIN (catalog.manage), но не MANAGER.
 */
const ROLE_PERMISSIONS: { role: string; permissions: string[] }[] = [
  {
    // MANAGER занимается заказами/макетами и НЕ управляет каталогом.
    role: ROLE_CODES.MANAGER,
    permissions: ['orders.read', 'orders.status.change', 'pricing.read', 'artwork.read', 'artwork.review'],
  },
  {
    // CONTENT_MANAGER ведёт контент каталога (категории/услуги/изображения).
    role: ROLE_CODES.CONTENT_MANAGER,
    permissions: ['catalog.manage'],
  },
  {
    role: ROLE_CODES.ADMIN,
    permissions: [
      'catalog.manage',
      'orders.read',
      'orders.status.change',
      'pricing.read',
      'pricing.draft.edit',
      'pricing.publish',
      'artwork.read',
      'artwork.review',
    ],
  },
];

async function main() {
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name, isSystem: role.isSystem },
      create: role,
    });
  }

  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { description: permission.description },
      create: permission,
    });
  }

  const superAdminRole = await prisma.role.findUniqueOrThrow({
    where: { code: ROLE_CODES.SUPER_ADMIN },
  });
  const allPermissions = await prisma.permission.findMany();
  const permissionByCode = new Map(allPermissions.map((p) => [p.code, p]));

  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superAdminRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: superAdminRole.id, permissionId: permission.id },
    });
  }

  // Права остальным ролям — идемпотентно (upsert). Отсутствие роли/права в БД
  // означает рассинхрон сидов, поэтому падаем явно, а не молча пропускаем.
  for (const grant of ROLE_PERMISSIONS) {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: grant.role } });
    for (const code of grant.permissions) {
      const permission = permissionByCode.get(code);
      if (!permission) throw new Error(`Permission "${code}" не найдено в PERMISSIONS`);
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@photo-print.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? DEFAULT_SEED_ADMIN_PASSWORD;

  if (process.env.NODE_ENV === 'production' && adminPassword === DEFAULT_SEED_ADMIN_PASSWORD) {
    throw new Error(
      'SEED_ADMIN_PASSWORD должен быть переопределён в production — отказ от использования дефолтного пароля',
    );
  }

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: await argon2.hash(adminPassword),
      firstName: 'Admin',
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: superAdminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: superAdminRole.id },
  });

  const printingCategory = await prisma.category.upsert({
    where: { slug: 'operativnaya-poligrafiya' },
    update: {},
    create: {
      slug: 'operativnaya-poligrafiya',
      title: 'Оперативная полиграфия',
      description: 'Визитки, листовки, буклеты и другая оперативная печать',
      sortOrder: 1,
    },
  });

  const photoCategory = await prisma.category.upsert({
    where: { slug: 'fotopechat' },
    update: {},
    create: {
      slug: 'fotopechat',
      title: 'Фотопечать',
      description: 'Печать фотографий и фотокниг',
      sortOrder: 2,
    },
  });

  await prisma.service.upsert({
    where: { slug: 'vizitki' },
    update: {},
    create: {
      categoryId: printingCategory.id,
      slug: 'vizitki',
      title: 'Визитки',
      shortDescription: 'Печать визиток любым тиражом',
      priceFrom: 990,
      productionTimeFrom: 1,
      sortOrder: 1,
    },
  });

  await prisma.service.upsert({
    where: { slug: 'listovki' },
    update: {},
    create: {
      categoryId: printingCategory.id,
      slug: 'listovki',
      title: 'Листовки',
      shortDescription: 'Печать листовок A6-A4',
      priceFrom: 1490,
      productionTimeFrom: 1,
      sortOrder: 2,
    },
  });

  const wideFormatCategory = await prisma.category.upsert({
    where: { slug: 'shirokoformat' },
    update: {},
    create: {
      slug: 'shirokoformat',
      title: 'Широкоформатная печать',
      description: 'Баннеры, roll-up, интерьерная печать',
      sortOrder: 3,
    },
  });

  await prisma.service.upsert({
    where: { slug: 'bannery' },
    update: {},
    create: {
      categoryId: wideFormatCategory.id,
      slug: 'bannery',
      title: 'Баннеры',
      shortDescription: 'Широкоформатная печать баннеров с люверсами и подшивом',
      priceFrom: 900,
      productionTimeFrom: 1,
      sortOrder: 1,
    },
  });

  await prisma.service.upsert({
    where: { slug: 'fotopechat-na-bumage' },
    update: {},
    create: {
      categoryId: photoCategory.id,
      slug: 'fotopechat-na-bumage',
      title: 'Фотопечать на бумаге',
      shortDescription: 'Печать фотографий разных форматов',
      priceFrom: 9,
      productionTimeFrom: 1,
      sortOrder: 1,
    },
  });

  // --- TIER-услуги партии C2 (структура — ТЗ_калькуляторы.md) --------------
  // Каталог создаётся в production seed; калькуляторы (definition + DEMO-прайс
  // + binding) подключаются отдельной demo-командой seed:calculator-demo,
  // которая не запускается в production. priceFrom НЕ задаём — боевых цен нет.
  const stickersCategory = await prisma.category.upsert({
    where: { slug: 'naklejki' },
    update: {},
    create: { slug: 'naklejki', title: 'Наклейки и этикетки', description: 'Наклейки, стикерпаки, этикетки и бирки', sortOrder: 4 },
  });
  const calendarsCategory = await prisma.category.upsert({
    where: { slug: 'kalendari' },
    update: {},
    create: { slug: 'kalendari', title: 'Календари', description: 'Настенные, настольные и карманные календари', sortOrder: 5 },
  });

  const c2Services = [
    { slug: 'buklety', title: 'Буклеты', short: 'Печать буклетов с фальцовкой', days: 3, cat: printingCategory.id, sort: 3 },
    { slug: 'otkrytki', title: 'Открытки и приглашения', short: 'Печать открыток и приглашений', days: 2, cat: printingCategory.id, sort: 4 },
    { slug: 'sertifikaty', title: 'Сертификаты и дипломы', short: 'Печать сертификатов и дипломов', days: 2, cat: printingCategory.id, sort: 5 },
    { slug: 'menyu', title: 'Меню для ресторанов', short: 'Печать ресторанного меню', days: 4, cat: printingCategory.id, sort: 6 },
    { slug: 'birki-bejdzi-blanki', title: 'Бирки, бейджи, бланки', short: 'Печать бирок, бейджей и бланков', days: 3, cat: printingCategory.id, sort: 7 },
    { slug: 'pechat', title: 'Наклейки и стикерпаки', short: 'Печать наклеек и стикерпаков', days: 1, cat: stickersCategory.id, sort: 1 },
    { slug: 'etiketki', title: 'Этикетки и бирки для одежды', short: 'Печать этикеток и бирок для одежды', days: 2, cat: stickersCategory.id, sort: 2 },
    { slug: 'nastennye', title: 'Настенные перекидные календари', short: 'Печать настенных календарей', days: 5, cat: calendarsCategory.id, sort: 1 },
    { slug: 'nastolnye', title: 'Настольные календари (домик)', short: 'Печать настольных календарей', days: 3, cat: calendarsCategory.id, sort: 2 },
    { slug: 'karmannye', title: 'Карманные календари', short: 'Печать карманных календарей', days: 2, cat: calendarsCategory.id, sort: 3 },
  ];
  for (const s of c2Services) {
    await prisma.service.upsert({
      where: { slug: s.slug },
      update: {},
      create: { categoryId: s.cat, slug: s.slug, title: s.title, shortDescription: s.short, productionTimeFrom: s.days, sortOrder: s.sort },
    });
  }

  // --- Размерные услуги партии C3 (структура — ТЗ_калькуляторы.md) ----------
  // Категории fotopechat/shirokoformat уже созданы выше. priceFrom не задаём.
  const c3Services = [
    { slug: 'postery-i-plakaty', title: 'Постеры и плакаты', short: 'Печать постеров, плакатов, афиш, чертежей', days: 1, cat: photoCategory.id, sort: 2 },
    { slug: 'pechat-na-holste', title: 'Печать на холсте', short: 'Печать на холсте с подрамником', days: 3, cat: photoCategory.id, sort: 3 },
    { slug: 'nakatka-na-penokarton', title: 'Накатка на пенокартон', short: 'Печать с накаткой на пенокартон', days: 2, cat: photoCategory.id, sort: 4 },
    { slug: 'press-wall', title: 'Press Wall / Фотостена', short: 'Печать пресс-волов и фотостен', days: 3, cat: wideFormatCategory.id, sort: 2 },
    { slug: 'interyernaya-pechat', title: 'Интерьерная печать', short: 'Интерьерная широкоформатная печать', days: 2, cat: wideFormatCategory.id, sort: 3 },
    { slug: 'roll-up', title: 'Стенды Roll Up', short: 'Мобильные стенды roll-up', days: 3, cat: wideFormatCategory.id, sort: 4 },
  ];
  for (const s of c3Services) {
    await prisma.service.upsert({
      where: { slug: s.slug },
      update: {},
      create: { categoryId: s.cat, slug: s.slug, title: s.title, shortDescription: s.short, productionTimeFrom: s.days, sortOrder: s.sort },
    });
  }

  // --- Документы, печати/штампы, фото на документы (партия C4) --------------
  // Структура — ТЗ_калькуляторы.md; «пломбираторы» отсутствуют в ТЗ (TZ_ABSENT).
  const documentsCategory = await prisma.category.upsert({
    where: { slug: 'pechat-dokumentov' },
    update: {},
    create: { slug: 'pechat-dokumentov', title: 'Печать документов', description: 'Печать, копирование, ламинирование, брошюровка и переплёт', sortOrder: 6 },
  });
  const stampsCategory = await prisma.category.upsert({
    where: { slug: 'pechati-shtampy' },
    update: {},
    create: { slug: 'pechati-shtampy', title: 'Печати и штампы', description: 'Автоматические штампы, карманные печати и факсимиле', sortOrder: 7 },
  });
  const idPhotoCategory = await prisma.category.upsert({
    where: { slug: 'foto-na-dokumenty' },
    update: {},
    create: { slug: 'foto-na-dokumenty', title: 'Фото на документы', description: 'Фото на документы по типам с фиксированной ценой', sortOrder: 8 },
  });

  const c4Services = [
    { slug: 'pechat-a4-a3', title: 'Печать документов A4/A3', short: 'Печать документов A4/A3 с пороговой ценой за лист', days: 1, cat: documentsCategory.id, sort: 1 },
    { slug: 'kopirovanie-a4-a3', title: 'Копирование A4/A3', short: 'Копирование документов: оригиналы × копии', days: 1, cat: documentsCategory.id, sort: 2 },
    { slug: 'laminirovanie', title: 'Ламинирование', short: 'Ламинирование A6–A3 и «свой размер»', days: 1, cat: documentsCategory.id, sort: 3 },
    { slug: 'broshyurovka', title: 'Брошюровка', short: 'Брошюровка: скрепка, пружина, термопереплёт', days: 1, cat: documentsCategory.id, sort: 4 },
    { slug: 'tvyordyj-pereplet', title: 'Твёрдый переплёт и дипломные работы', short: 'Твёрдый переплёт дипломов, диссертаций, отчётов, книг', days: 2, cat: documentsCategory.id, sort: 5 },
    { slug: 'shtampy-avtomaticheskie', title: 'Автоматические штампы', short: 'Автоматические штампы Trodat / Colop', days: 1, cat: stampsCategory.id, sort: 1 },
    { slug: 'pechati-karmannye', title: 'Карманные печати', short: 'Карманные печати круглые и прямоугольные', days: 1, cat: stampsCategory.id, sort: 2 },
    { slug: 'faksimile', title: 'Факсимиле', short: 'Факсимиле с произвольным размером в границах', days: 1, cat: stampsCategory.id, sort: 3 },
    { slug: 'foto-na-dokumenty', title: 'Фото на документы', short: 'Фото на документы по типам (паспорт, виза и др.)', days: 1, cat: idPhotoCategory.id, sort: 1 },
  ];
  for (const s of c4Services) {
    await prisma.service.upsert({
      where: { slug: s.slug },
      update: {},
      create: { categoryId: s.cat, slug: s.slug, title: s.title, shortDescription: s.short, productionTimeFrom: s.days, sortOrder: s.sort },
    });
  }

  // --- Сувениры/текстиль и фотокниги (партия C5) ----------------------------
  // Структура — ТЗ_калькуляторы.md; «ланьярды/бейджи» отсутствуют в ТЗ (TZ_ABSENT).
  const souvenirsCategory = await prisma.category.upsert({
    where: { slug: 'suveniry' },
    update: {},
    create: { slug: 'suveniry', title: 'Сувениры и текстиль', description: 'Печать на футболках, кружках и шопперах', sortOrder: 9 },
  });
  const photobooksCategory = await prisma.category.upsert({
    where: { slug: 'fotoknigi' },
    update: {},
    create: { slug: 'fotoknigi', title: 'Фотокниги', description: 'Фотокниги LayFlat, Hardcover и Softcover', sortOrder: 10 },
  });

  const c5Services = [
    { slug: 'futbolki', title: 'Печать на футболках', short: 'Печать на футболках, мультиразмер XS–3XL', days: 4, cat: souvenirsCategory.id, sort: 1 },
    { slug: 'kruzhki', title: 'Печать на кружках', short: 'Печать на кружках и термокружках', days: 2, cat: souvenirsCategory.id, sort: 2 },
    { slug: 'shoppery', title: 'Шопперы с логотипом', short: 'Печать на шопперах, от 10 шт.', days: 4, cat: souvenirsCategory.id, sort: 3 },
    { slug: 'fotoknigi', title: 'Фотокниги', short: 'Фотокниги LayFlat, Hardcover, Softcover', days: 5, cat: photobooksCategory.id, sort: 1 },
  ];
  for (const s of c5Services) {
    await prisma.service.upsert({
      where: { slug: s.slug },
      update: {},
      create: { categoryId: s.cat, slug: s.slug, title: s.title, shortDescription: s.short, productionTimeFrom: s.days, sortOrder: s.sort },
    });
  }

  // Демо-калькулятор «Визитки» (isDemo=true, DRAFT-прайс) сюда НЕ входит —
  // Codex review, блок 1: основной production seed не должен создавать/
  // изменять данные калькулятора. Отдельная команда:
  //   npm run seed:calculator-demo
  // (см. prisma/seed-calculator-demo.ts). Она сама отказывается запускаться
  // при NODE_ENV=production.

  console.log('Seed completed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
