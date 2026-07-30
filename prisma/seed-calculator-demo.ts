/**
 * Демонстрационные калькуляторы — для локальной разработки и публичного
 * staging-стенда. Изолированы от основного production seed.
 *
 * Гарантии:
 * - работает только там, где разрешены демо-цены: development всегда,
 *   staging — при ALLOW_DEMO_PRICING=true, APP_ENV=production — никогда;
 * - CalculatorDefinition и PriceList помечаются isDemo=true;
 * - публикация идёт штатным PublishService (те же проверки, что у боевого
 *   прайса), поэтому ручной SQL для активации демо-прайса не нужен;
 * - LIVE-прайсы (isDemo=false) не изменяются никогда;
 * - идемпотентен: повторный запуск не плодит дубли — прежняя демо-версия
 *   архивируется, создаётся следующая версия (@@unique([code, version])).
 *
 * Цены — ДЕМОНСТРАЦИОННЫЕ (из прототипа frontend), не production-прайс.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PublishService } from '../src/calculator/publish.service';
import { resolveAppEnv } from '../src/config/configuration';
import { demoPricingAllowedFor } from '../src/config/pricing-environment.service';
import type { PrismaService } from '../src/database/prisma.service';
import { makePricingEnv } from '../src/config/testing/pricing-environment.stub';
import { bannerDefinitionCreate, bannerDemoPriceRulesCreate } from './demo/banner-demo';
import { leafletsDefinitionCreate, leafletsDemoPriceRulesCreate } from './demo/leaflets-demo';
import { photoPrintDefinitionCreate, photoPrintDemoPriceRulesCreate } from './demo/photo-print-demo';
import { TIER_SPECS, tierDefinitionCreate, tierDemoPriceRulesCreate } from './demo/tier-calculators-demo';
import { AREA_SPECS, ROLLUP_SPEC, areaDefinitionCreate, areaDemoPriceRulesCreate, rollupDefinitionCreate, rollupDemoPriceRulesCreate } from './demo/metric-calculators-demo';
import { DOCUMENT_SPECS } from './demo/document-calculators-demo';
import { SOUVENIR_SPECS } from './demo/souvenir-calculators-demo';

const prisma = new PrismaClient();

/**
 * Идемпотентность с учётом DB-триггеров неизменяемости: опубликованные строки
 * нельзя удалять — прежнюю ACTIVE демо-версию архивируем (единственный
 * допустимый переход), DRAFT-черновики удаляем. Реальные (isDemo=false)
 * определения того же code не трогаются никогда. Возвращает следующий
 * свободный номер версии для нового демо-определения.
 */
async function resetDemoDefinitions(code: string): Promise<number> {
  const existingDemos = await prisma.calculatorDefinition.findMany({
    where: { code, isDemo: true, status: { not: 'ARCHIVED' } },
    include: { priceLists: { where: { status: { not: 'ARCHIVED' } } } },
  });
  for (const demo of existingDemos) {
    if (demo.status === 'DRAFT') {
      await prisma.calculatorDefinition.delete({ where: { id: demo.id } });
      continue;
    }
    // Прайсы архивируются вместе с определением, иначе после каждого запуска
    // копились бы ACTIVE-прайсы предыдущих демо-версий.
    for (const priceList of demo.priceLists) {
      if (priceList.status === 'ACTIVE') {
        await prisma.priceList.update({ where: { id: priceList.id }, data: { status: 'ARCHIVED' } });
      } else {
        await prisma.priceList.delete({ where: { id: priceList.id } });
      }
    }
    await prisma.calculatorDefinition.update({ where: { id: demo.id }, data: { status: 'ARCHIVED' } });
  }
  const maxVersion = (
    await prisma.calculatorDefinition.aggregate({ where: { code }, _max: { version: true } })
  )._max.version;
  return (maxVersion ?? 0) + 1;
}


/**
 * Публикация демо-данных штатным путём: те же проверки схем, диапазонов и
 * периодов, что и у боевого прайса. Ручной SQL для активации не нужен.
 */
async function publishDemo(definitionId: string, priceLists: { id: string }[]): Promise<void> {
  await publisher.publishDefinition(definitionId);
  for (const priceList of priceLists) {
    await publisher.publishPriceList(priceList.id);
  }
}

const APP_ENV = resolveAppEnv();
const ALLOW_DEMO_PRICING = (process.env.ALLOW_DEMO_PRICING ?? 'false') === 'true';

/** Публикация демо-данных теми же правилами, что и боевого прайса. */
const publisher = new PublishService(
  prisma as unknown as PrismaService,
  makePricingEnv(APP_ENV, ALLOW_DEMO_PRICING),
);

async function main() {
  if (!demoPricingAllowedFor(APP_ENV, ALLOW_DEMO_PRICING)) {
    throw new Error(
      `seed:calculator-demo запрещён при APP_ENV=${APP_ENV} (ALLOW_DEMO_PRICING=` +
        `${ALLOW_DEMO_PRICING}). Демо-цены допустимы только в development или ` +
        'в staging с ALLOW_DEMO_PRICING=true.',
    );
  }

  console.warn(
    `\n  ⚠  DEMO PRICING ENABLED (APP_ENV=${APP_ENV})\n` +
      '     Загружаются ДЕМОНСТРАЦИОННЫЕ цены. Это не боевой прайс.\n',
  );

  await seedBusinessCardsDemo();
  await seedLeafletsDemo();
  await seedBannersDemo();
  await seedPhotoPrintDemo();
  await seedTierC2Demo();
  await seedMetricC3Demo();
  await seedDocumentC4Demo();
  await seedSouvenirC5Demo();
}

/**
 * Калькуляторы партии C5 (сувениры/текстиль + фотокниги) — на общей
 * TIER-фабрике. Футболки используют MULTI_QTY-параметр размеров (тираж = сумма
 * строк). «Ланьярды/бейджи» отсутствуют в ТЗ → не сидируются (TZ_ABSENT).
 */
async function seedSouvenirC5Demo() {
  await seedTierSpecs(SOUVENIR_SPECS);
}

/**
 * Калькуляторы партии C4 (документы, постпечать, печати/штампы, фото на
 * документы) — на общей TIER-фабрике. Структура — ТЗ_калькуляторы.md; базовые
 * тиражи — ДЕМО. «Пломбираторы» отсутствуют в ТЗ → не сидируются (TZ_ABSENT).
 */
async function seedDocumentC4Demo() {
  await seedTierSpecs(DOCUMENT_SPECS);
}

/**
 * Размерные калькуляторы партии C3: 5 AREA (площадь × ₽/м²) + rollup (TIER,
 * фикс-размеры). Данные — prisma/demo/metric-calculators-demo.ts. Каждая услуга:
 * create DRAFT → publish штатным PublishService → ServiceCalculator binding.
 */
async function seedMetricC3Demo() {
  const jobs = [
    ...AREA_SPECS.map((spec) => ({ code: spec.code, slug: spec.slug, comment: spec.demoComment, def: (v: number) => areaDefinitionCreate(spec, v), rules: () => areaDemoPriceRulesCreate(spec) })),
    { code: ROLLUP_SPEC.code, slug: ROLLUP_SPEC.slug, comment: ROLLUP_SPEC.demoComment, def: rollupDefinitionCreate, rules: rollupDemoPriceRulesCreate },
  ];
  for (const job of jobs) {
    const service = await prisma.service.findUnique({ where: { slug: job.slug } });
    if (!service) {
      console.log(`Услуга "${job.slug}" не найдена — сначала выполните основной \`npm run seed\`.`);
      continue;
    }
    const nextVersion = await resetDemoDefinitions(job.code);
    const definition = await prisma.calculatorDefinition.create({
      data: {
        ...job.def(nextVersion),
        isDemo: true,
        status: 'DRAFT',
        priceLists: {
          create: [{ version: 1, status: 'DRAFT', isDemo: true, currency: 'RUB', comment: `${job.comment} НИКОГДА не активировать в production.`, rules: job.rules() }],
        },
      },
      include: { priceLists: true },
    });
    await publishDemo(definition.id, definition.priceLists);
    await prisma.serviceCalculator.upsert({
      where: { serviceId: service.id },
      update: { definitionId: definition.id, preset: undefined },
      create: { serviceId: service.id, definitionId: definition.id },
    });
    console.log(`Demo calculator seeded: ${job.code} definition=${definition.id} (v${nextVersion}, isDemo=true), price list ACTIVE (demo)`);
  }
}

/**
 * TIER-калькуляторы партии C2 (data-driven из prisma/demo/tier-calculators-demo.ts).
 * Структура — по ТЗ_калькуляторы.md; базовые тиражи — ДЕМО. Каждая услуга:
 * create DRAFT → publish штатным PublishService → ServiceCalculator binding.
 */
async function seedTierC2Demo() {
  await seedTierSpecs(TIER_SPECS);
}

/** Общий цикл сидирования TIER-спеков (C2 и C4): DRAFT → publish → binding. */
async function seedTierSpecs(specs: typeof TIER_SPECS) {
  for (const spec of specs) {
    const service = await prisma.service.findUnique({ where: { slug: spec.slug } });
    if (!service) {
      console.log(`Услуга "${spec.slug}" не найдена — сначала выполните основной \`npm run seed\`.`);
      continue;
    }

    const nextVersion = await resetDemoDefinitions(spec.code);
    const definition = await prisma.calculatorDefinition.create({
      data: {
        ...tierDefinitionCreate(spec, nextVersion),
        isDemo: true,
        status: 'DRAFT',
        priceLists: {
          create: [
            {
              version: 1,
              status: 'DRAFT', // публикуется ниже через PublishService
              isDemo: true,
              currency: 'RUB',
              comment: `${spec.demoComment} НИКОГДА не активировать в production.`,
              rules: tierDemoPriceRulesCreate(spec),
            },
          ],
        },
      },
      include: { priceLists: true },
    });

    await publishDemo(definition.id, definition.priceLists);

    await prisma.serviceCalculator.upsert({
      where: { serviceId: service.id },
      update: { definitionId: definition.id, preset: undefined },
      create: { serviceId: service.id, definitionId: definition.id },
    });

    console.log(`Demo calculator seeded: ${spec.code} definition=${definition.id} (v${nextVersion}, isDemo=true), price list ACTIVE (demo)`);
  }
}

/** Демо-калькулятор «Фотопечать» (ТЗ п.3.1). Данные — prisma/demo/photo-print-demo.ts. */
async function seedPhotoPrintDemo() {
  const service = await prisma.service.findUnique({ where: { slug: 'fotopechat-na-bumage' } });
  if (!service) {
    console.log('Услуга "fotopechat-na-bumage" не найдена — сначала выполните основной `npm run seed`.');
    return;
  }

  const nextVersion = await resetDemoDefinitions('photo-print');
  const definition = await prisma.calculatorDefinition.create({
    data: {
      ...photoPrintDefinitionCreate(nextVersion),
      isDemo: true,
      status: 'DRAFT',
      priceLists: {
        create: [
          {
            version: 1,
            status: 'DRAFT', // публикуется ниже через PublishService
            isDemo: true,
            currency: 'RUB',
            comment: 'ДЕМО-ПРАЙС фотопечати (цены прототипа frontend). НИКОГДА не активировать в production.',
            rules: photoPrintDemoPriceRulesCreate(),
          },
        ],
      },
    },
    include: { priceLists: true },
  });

  await publishDemo(definition.id, definition.priceLists);

  await prisma.serviceCalculator.upsert({
    where: { serviceId: service.id },
    update: { definitionId: definition.id, preset: undefined },
    create: { serviceId: service.id, definitionId: definition.id },
  });

  console.log(
    `Demo calculator seeded: photo-print definition=${definition.id} (v${nextVersion}, isDemo=true), ` +
      `price list ACTIVE (demo)`,
  );
}

/**
 * Демо-калькулятор «Баннеры» (ТЗ п.4.1, формулы §15.12). Данные — в
 * prisma/demo/banner-demo.ts (общие со сквозным integration-тестом).
 */
async function seedBannersDemo() {
  const bannery = await prisma.service.findUnique({ where: { slug: 'bannery' } });
  if (!bannery) {
    console.log('Услуга "bannery" не найдена — сначала выполните основной `npm run seed`.');
    return;
  }

  const nextVersion = await resetDemoDefinitions('banner-print');
  const definition = await prisma.calculatorDefinition.create({
    data: {
      ...bannerDefinitionCreate(nextVersion),
      isDemo: true,
      status: 'DRAFT',
      priceLists: {
        create: [
          {
            version: 1,
            status: 'DRAFT', // публикуется ниже через PublishService
            isDemo: true,
            currency: 'RUB',
            comment:
              'ДЕМО-ПРАЙС баннеров (450 ₽/м² из прототипа, 15 ₽/люверс из примера ТЗ, ' +
              'ставки подшива — demo-допущение). НИКОГДА не активировать в production.',
            rules: bannerDemoPriceRulesCreate(),
          },
        ],
      },
    },
    include: { priceLists: true },
  });

  await publishDemo(definition.id, definition.priceLists);

  await prisma.serviceCalculator.upsert({
    where: { serviceId: bannery.id },
    update: { definitionId: definition.id, preset: undefined },
    create: { serviceId: bannery.id, definitionId: definition.id },
  });

  console.log(
    `Demo calculator seeded: banner-print definition=${definition.id} (v${nextVersion}, isDemo=true), ` +
      `price list ACTIVE (demo)`,
  );
}

async function seedBusinessCardsDemo() {
  const vizitki = await prisma.service.findUnique({ where: { slug: 'vizitki' } });
  if (!vizitki) {
    console.log('Услуга "vizitki" не найдена — сначала выполните основной `npm run seed`.');
    return;
  }

  const nextVersion = await resetDemoDefinitions('business-cards');

  // DB-триггеры запрещают вставку дочерних строк в опубликованное определение,
  // поэтому создаём как DRAFT (children вставляются свободно) и публикуем
  // ниже через PublishService — тот же порядок, что у будущего CMS publish-flow.
  const definition = await prisma.calculatorDefinition.create({
    data: {
      code: 'business-cards',
      title: 'Визитки (демо)',
      version: nextVersion,
      isDemo: true,
      status: 'DRAFT',
      pricingMode: 'TIER',
      urlOrder: ['subtype', 'format', 'w', 'h', 'paper', 'coating', 'lacquer', 'foil', 'sides', 'qty', 'express'],
      minQty: 50,
      maxQty: 10000,
      qtyStep: 50,
      defaultQty: 100,
      parameters: {
        create: [
          {
            urlKey: 'subtype',
            label: 'Тип',
            type: 'SEGMENTED',
            sortOrder: 0,
            options: {
              create: [
                { value: 'standard', label: 'Стандартные', isDefault: true, sortOrder: 0 },
                { value: 'lacquer', label: 'С лакировкой', sortOrder: 1 },
                { value: 'foil', label: 'Тиснение фольгой', sortOrder: 2 },
                { value: 'plastic', label: 'Пластиковые', sortOrder: 3 },
              ],
            },
          },
          {
            urlKey: 'format',
            label: 'Формат',
            type: 'SEGMENTED',
            sortOrder: 1,
            options: {
              create: [
                { value: '90x50', label: '90×50', isDefault: true, sortOrder: 0 },
                { value: '85x55', label: '85×55', sortOrder: 1 },
                { value: '90x90', label: '90×90', sortOrder: 2 },
                { value: '55x55', label: '55×55', sortOrder: 3 },
                { value: 'custom', label: 'Свой размер', sortOrder: 4 },
              ],
            },
          },
          {
            urlKey: 'w',
            label: 'Ширина',
            type: 'DIMENSION',
            sortOrder: 2,
            unit: 'мм',
            minValue: 30,
            maxValue: 100,
            stepValue: 1,
            defaultValue: '90',
            visibleIf: { format: 'custom' },
          },
          {
            urlKey: 'h',
            label: 'Высота',
            type: 'DIMENSION',
            sortOrder: 3,
            unit: 'мм',
            minValue: 30,
            maxValue: 100,
            stepValue: 1,
            defaultValue: '50',
            visibleIf: { format: 'custom' },
          },
          {
            urlKey: 'paper',
            label: 'Бумага',
            type: 'SWATCH',
            sortOrder: 4,
            options: {
              create: [
                { value: 'coated-300', label: 'Мелованная 300 г', sortOrder: 0 },
                { value: 'coated-350', label: 'Мелованная 350 г', isDefault: true, sortOrder: 1 },
                { value: 'design', label: 'Дизайнерская', sortOrder: 2 },
              ],
            },
          },
          {
            urlKey: 'coating',
            label: 'Покрытие',
            type: 'SWATCH',
            sortOrder: 5,
            options: {
              create: [
                { value: 'none', label: 'Без покрытия', isDefault: true, sortOrder: 0 },
                { value: 'matte-lam', label: 'Матовая ламинация', sortOrder: 1 },
                { value: 'gloss-lam', label: 'Глянцевая ламинация', sortOrder: 2 },
                { value: 'soft-touch', label: 'Soft Touch', sortOrder: 3 },
                { value: 'uv-gloss', label: 'UV-лак глянец', sortOrder: 4 },
                { value: 'uv-matte', label: 'UV-лак мат', sortOrder: 5 },
              ],
            },
          },
          {
            urlKey: 'lacquer',
            label: 'Вид лака',
            type: 'SEGMENTED',
            sortOrder: 6,
            visibleIf: { subtype: 'lacquer', coating: ['uv-gloss', 'uv-matte'] },
            options: {
              create: [
                { value: 'full', label: 'Сплошной', isDefault: true, sortOrder: 0 },
                { value: 'selective', label: 'Выборочный', sortOrder: 1 },
              ],
            },
          },
          {
            urlKey: 'foil',
            label: 'Цвет фольги',
            type: 'SWATCH',
            sortOrder: 7,
            visibleIf: { subtype: 'foil' },
            options: {
              create: [
                { value: 'gold', label: 'Золото', isDefault: true, sortOrder: 0 },
                { value: 'silver', label: 'Серебро', sortOrder: 1 },
                { value: 'holographic', label: 'Голография', sortOrder: 2 },
              ],
            },
          },
          {
            urlKey: 'sides',
            label: 'Стороны',
            type: 'SEGMENTED',
            sortOrder: 8,
            options: {
              create: [
                { value: 'single', label: '1 сторона', sortOrder: 0 },
                { value: 'double', label: '2 стороны', isDefault: true, sortOrder: 1 },
              ],
            },
          },
          {
            urlKey: 'express',
            label: 'Срочное изготовление',
            type: 'TOGGLE',
            sortOrder: 9,
            isRequired: false,
            defaultValue: '0',
          },
        ],
      },
      compatibilityRules: {
        create: [
          {
            kind: 'DISABLE_OPTIONS',
            when: { subtype: 'standard' },
            target: { param: 'coating', options: ['uv-gloss', 'uv-matte'] },
            message: 'UV-лак недоступен для стандартных визиток',
            sortOrder: 0,
          },
          {
            kind: 'DISABLE_OPTIONS',
            when: { subtype: 'lacquer' },
            target: { param: 'coating', options: ['matte-lam', 'gloss-lam'] },
            message: 'Ламинация недоступна для визиток с лакировкой',
            sortOrder: 1,
          },
          {
            kind: 'DISABLE_OPTIONS',
            when: { subtype: 'foil' },
            target: { param: 'coating', options: ['gloss-lam', 'soft-touch', 'uv-gloss', 'uv-matte'] },
            message: 'Для тиснения доступны только «без покрытия» и матовая ламинация',
            sortOrder: 2,
          },
          {
            kind: 'DISABLE_OPTIONS',
            when: { subtype: 'plastic' },
            target: { param: 'coating', options: ['matte-lam', 'gloss-lam', 'soft-touch', 'uv-gloss', 'uv-matte'] },
            message: 'Покрытия недоступны для пластиковых визиток',
            sortOrder: 3,
          },
          {
            kind: 'HIDE_PARAMS',
            when: { subtype: 'plastic' },
            target: { params: ['paper'] },
            sortOrder: 4,
          },
          {
            kind: 'SET_BOUNDS',
            when: { subtype: 'plastic' },
            target: { param: 'qty', min: 100, step: 100 },
            message: 'Минимальный тираж для пластиковых визиток — 100 шт., шаг 100',
            sortOrder: 5,
          },
          {
            kind: 'MAX_QTY',
            when: { express: '1' },
            target: { maxQty: 1000 },
            message: 'Срочное изготовление — только для тиража до 1 000 шт.',
            sortOrder: 6,
          },
          {
            kind: 'DISABLE_OPTIONS',
            when: { subtype: ['lacquer', 'foil', 'plastic'] },
            target: { param: 'express', options: ['1'] },
            message: 'Срочно — только стандартные визитки с базовой ламинацией',
            sortOrder: 7,
          },
          {
            kind: 'DISABLE_OPTIONS',
            when: { coating: ['soft-touch', 'uv-gloss', 'uv-matte'] },
            target: { param: 'express', options: ['1'] },
            message: 'Срочно — только стандартные визитки с базовой ламинацией',
            sortOrder: 8,
          },
        ],
      },
      upsells: {
        create: [
          { code: 'rounded-corners', label: 'Скруглённые углы', pricing: 'MULTIPLIER', multiplier: 1.1, sortOrder: 0 },
          { code: 'plastic-case', label: 'Кейс для визиток', pricing: 'FLAT', amountMinor: 15000, sortOrder: 1 },
          { code: 'design', label: 'Разработка дизайна', pricing: 'FLAT', amountMinor: 50000, sortOrder: 2 },
          // visibleIf: опция доступна только для пластиковых визиток —
          // демонстрация условной доступности upsell (блок 1 v2).
          {
            code: 'hole',
            label: 'Отверстие под люверс',
            pricing: 'MULTIPLIER',
            multiplier: 1.05,
            visibleIf: { subtype: 'plastic' },
            sortOrder: 3,
          },
        ],
      },
      productionRules: {
        create: [
          { condition: undefined, workingDays: 2, cutoff: '14:00', priority: 0 },
          { condition: { express: '1' }, workingDays: 0, cutoff: '12:00', priority: 10 },
        ],
      },
      priceLists: {
        create: [
          {
            version: 1,
            // Требование 5 (блок 1): демо-прайс — ТОЛЬКО DRAFT. Никогда не ACTIVE
            // из seed-скрипта; активация допустима только явным publish-действием
            // разработчика в dev, и PublishService в любом случае отказывает
            // demo-прайсу в публикации (см. publish.service.ts).
            status: 'DRAFT',
            isDemo: true,
            currency: 'RUB',
            comment:
              'ДЕМО-ПРАЙС для локальной разработки. Цены индикативные (из прототипа frontend). ' +
              'НИКОГДА не активировать в production — PublishService это и так запрещает.',
            rules: {
              create: [
                { kind: 'BASE_TIER', qtyFrom: 50, qtyTo: 99, amountMinor: 1800, sortOrder: 0 },
                { kind: 'BASE_TIER', qtyFrom: 100, qtyTo: 199, amountMinor: 1200, sortOrder: 1 },
                { kind: 'BASE_TIER', qtyFrom: 200, qtyTo: 299, amountMinor: 900, sortOrder: 2 },
                { kind: 'BASE_TIER', qtyFrom: 300, qtyTo: 499, amountMinor: 750, sortOrder: 3 },
                { kind: 'BASE_TIER', qtyFrom: 500, qtyTo: 999, amountMinor: 600, sortOrder: 4 },
                { kind: 'BASE_TIER', qtyFrom: 1000, qtyTo: 1999, amountMinor: 450, sortOrder: 5 },
                { kind: 'BASE_TIER', qtyFrom: 2000, qtyTo: 4999, amountMinor: 360, sortOrder: 6 },
                { kind: 'BASE_TIER', qtyFrom: 5000, qtyTo: 9999, amountMinor: 300, sortOrder: 7 },
                { kind: 'BASE_TIER', qtyFrom: 10000, qtyTo: null, amountMinor: 260, sortOrder: 8 },
                { kind: 'MULTIPLIER', condition: { subtype: 'lacquer' }, multiplier: 1.25, sortOrder: 10 },
                { kind: 'MULTIPLIER', condition: { subtype: 'foil' }, multiplier: 1.4, sortOrder: 11 },
                { kind: 'MULTIPLIER', condition: { subtype: 'plastic' }, multiplier: 1.8, sortOrder: 12 },
                { kind: 'MULTIPLIER', condition: { format: '90x90' }, multiplier: 1.3, sortOrder: 13 },
                { kind: 'MULTIPLIER', condition: { format: '55x55' }, multiplier: 0.85, sortOrder: 14 },
                { kind: 'MULTIPLIER', condition: { format: 'custom' }, multiplier: 1.2, sortOrder: 15 },
                { kind: 'MULTIPLIER', condition: { paper: 'design' }, multiplier: 1.25, sortOrder: 16 },
                { kind: 'MULTIPLIER', condition: { coating: 'matte-lam' }, multiplier: 1.1, sortOrder: 17 },
                { kind: 'MULTIPLIER', condition: { coating: 'gloss-lam' }, multiplier: 1.1, sortOrder: 18 },
                { kind: 'MULTIPLIER', condition: { coating: 'soft-touch' }, multiplier: 1.2, sortOrder: 19 },
                { kind: 'MULTIPLIER', condition: { coating: 'uv-gloss' }, multiplier: 1.25, sortOrder: 20 },
                { kind: 'MULTIPLIER', condition: { coating: 'uv-matte' }, multiplier: 1.25, sortOrder: 21 },
                { kind: 'MULTIPLIER', condition: { lacquer: 'selective' }, multiplier: 1.5, sortOrder: 22 },
                { kind: 'MULTIPLIER', condition: { foil: 'holographic' }, multiplier: 1.2, sortOrder: 23 },
                { kind: 'MULTIPLIER', condition: { sides: 'double' }, multiplier: 1.35, sortOrder: 24 },
                { kind: 'MULTIPLIER', condition: { express: '1' }, multiplier: 1.5, sortOrder: 25 },
              ],
            },
          },
        ],
      },
    },
    include: { priceLists: true },
  });

  await publishDemo(definition.id, definition.priceLists);

  await prisma.serviceCalculator.upsert({
    where: { serviceId: vizitki.id },
    update: { definitionId: definition.id, preset: undefined },
    create: { serviceId: vizitki.id, definitionId: definition.id },
  });

  console.log(
    `Demo calculator seeded: business-cards definition=${definition.id} (v${nextVersion}, isDemo=true), ` +
      `price list ACTIVE (demo)`,
  );
}

/**
 * Демо-калькулятор «Листовки» (ТЗ п.1.2). Данные — в prisma/demo/leaflets-demo.ts
 * (общие со сквозным integration-тестом). Тот же lifecycle, что у визиток:
 * DRAFT + children → активация определения; прайс остаётся DRAFT + isDemo.
 */
async function seedLeafletsDemo() {
  const listovki = await prisma.service.findUnique({ where: { slug: 'listovki' } });
  if (!listovki) {
    console.log('Услуга "listovki" не найдена — сначала выполните основной `npm run seed`.');
    return;
  }

  const nextVersion = await resetDemoDefinitions('leaflets');
  const definition = await prisma.calculatorDefinition.create({
    data: {
      ...leafletsDefinitionCreate(nextVersion),
      isDemo: true,
      status: 'DRAFT',
      priceLists: {
        create: [
          {
            version: 1,
            status: 'DRAFT', // публикуется ниже через PublishService
            isDemo: true,
            currency: 'RUB',
            comment:
              'ДЕМО-ПРАЙС листовок для локальной разработки (цены из прототипа frontend). ' +
              'НИКОГДА не активировать в production.',
            rules: leafletsDemoPriceRulesCreate(),
          },
        ],
      },
    },
    include: { priceLists: true },
  });

  await publishDemo(definition.id, definition.priceLists);

  await prisma.serviceCalculator.upsert({
    where: { serviceId: listovki.id },
    update: { definitionId: definition.id, preset: undefined },
    create: { serviceId: listovki.id, definitionId: definition.id },
  });

  console.log(
    `Demo calculator seeded: leaflets definition=${definition.id} (v${nextVersion}, isDemo=true), ` +
      `price list ACTIVE (demo)`,
  );
}

main()
  .catch((error) => {
    console.error(error.message ?? error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
