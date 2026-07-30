/**
 * Боевой провижн калькуляторов (LIVE). Создаёт все 33 определения из ТЗ как
 * `isDemo=false`, публикует ОПРЕДЕЛЕНИЕ (структуру: параметры/опции/совместимости)
 * и привязывает к услуге — БЕЗ прайс-листа. Цены оператор заводит сам через
 * админку (кнопка «Создать прайс» → правила → публикация).
 *
 * Отличие от seed-calculator-demo.ts:
 * - НЕ выдумывает цены: прайс-лист не создаётся вовсе (0 правил);
 * - работает в production (isDemo=false публикуется в любом окружении);
 * - идемпотентен и БЕЗОПАСЕН: если боевое (isDemo=false) определение с таким
 *   `code` уже есть — пропускает и НЕ трогает введённые оператором цены.
 *
 * Демо-определения (isDemo=true) не затрагиваются.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PublishService } from '../src/calculator/publish.service';
import { resolveAppEnv } from '../src/config/configuration';
import type { PrismaService } from '../src/database/prisma.service';
import { makePricingEnv } from '../src/config/testing/pricing-environment.stub';
import { businessCardsDefinitionCreate } from './demo/business-cards-demo';
import { leafletsDefinitionCreate } from './demo/leaflets-demo';
import { bannerDefinitionCreate } from './demo/banner-demo';
import { photoPrintDefinitionCreate } from './demo/photo-print-demo';
import { TIER_SPECS, tierDefinitionCreate } from './demo/tier-calculators-demo';
import { DOCUMENT_SPECS } from './demo/document-calculators-demo';
import { SOUVENIR_SPECS } from './demo/souvenir-calculators-demo';
import { AREA_SPECS, ROLLUP_SPEC, areaDefinitionCreate, rollupDefinitionCreate } from './demo/metric-calculators-demo';

const prisma = new PrismaClient();
const APP_ENV = resolveAppEnv();
const ALLOW_DEMO_PRICING = (process.env.ALLOW_DEMO_PRICING ?? 'false') === 'true';

// PublishService публикует определение штатным путём (те же проверки схем).
// Для isDemo=false демо-guard неактуален, поэтому провижн работает в production.
const publisher = new PublishService(
  prisma as unknown as PrismaService,
  makePricingEnv(APP_ENV, ALLOW_DEMO_PRICING),
);

type DefFactory = (version: number) => Record<string, unknown>;
interface Job {
  code: string;
  slug: string;
  def: DefFactory;
}

const jobs: Job[] = [
  { code: 'business-cards', slug: 'vizitki', def: businessCardsDefinitionCreate as DefFactory },
  { code: 'leaflets', slug: 'listovki', def: leafletsDefinitionCreate as DefFactory },
  { code: 'banner-print', slug: 'bannery', def: bannerDefinitionCreate as DefFactory },
  { code: 'photo-print', slug: 'fotopechat-na-bumage', def: photoPrintDefinitionCreate as DefFactory },
  ...TIER_SPECS.map((s) => ({ code: s.code, slug: s.slug, def: ((v: number) => tierDefinitionCreate(s, v)) as DefFactory })),
  ...DOCUMENT_SPECS.map((s) => ({ code: s.code, slug: s.slug, def: ((v: number) => tierDefinitionCreate(s, v)) as DefFactory })),
  ...SOUVENIR_SPECS.map((s) => ({ code: s.code, slug: s.slug, def: ((v: number) => tierDefinitionCreate(s, v)) as DefFactory })),
  ...AREA_SPECS.map((s) => ({ code: s.code, slug: s.slug, def: ((v: number) => areaDefinitionCreate(s, v)) as DefFactory })),
  { code: ROLLUP_SPEC.code, slug: ROLLUP_SPEC.slug, def: rollupDefinitionCreate as DefFactory },
];

async function main() {
  console.log(`\n  ⚙  LIVE calculator provisioning (APP_ENV=${APP_ENV})`);
  console.log('     Создаются боевые определения (isDemo=false) без цен. Цены — через админку.\n');

  let created = 0;
  let skipped = 0;
  for (const job of jobs) {
    const service = await prisma.service.findUnique({ where: { slug: job.slug } });
    if (!service) {
      console.log(`  ⚠  Услуга "${job.slug}" не найдена — сначала выполните основной seed.`);
      continue;
    }

    // Идемпотентность: боевое определение уже есть → не трогаем цены оператора.
    const existingLive = await prisma.calculatorDefinition.findFirst({
      where: { code: job.code, isDemo: false, status: { not: 'ARCHIVED' } },
      select: { id: true },
    });
    if (existingLive) {
      skipped++;
      console.log(`  =  ${job.code}: боевое определение уже есть — пропуск`);
      continue;
    }

    const maxVersion = (await prisma.calculatorDefinition.aggregate({ where: { code: job.code }, _max: { version: true } }))._max.version;
    const nextVersion = (maxVersion ?? 0) + 1;

    const definition = await prisma.calculatorDefinition.create({
      data: {
        ...(job.def(nextVersion) as object),
        isDemo: false,
        status: 'DRAFT',
      } as never,
    });

    // Публикуем ТОЛЬКО определение (структуру). Прайс-лист не создаётся —
    // калькулятор будет «расчёт недоступен», пока оператор не опубликует цену.
    await publisher.publishDefinition(definition.id);

    await prisma.serviceCalculator.upsert({
      where: { serviceId: service.id },
      update: { definitionId: definition.id, preset: undefined },
      create: { serviceId: service.id, definitionId: definition.id },
    });

    created++;
    console.log(`  +  ${job.code}: боевое определение создано (v${nextVersion}, isDemo=false, ACTIVE, без прайса) → привязано к ${job.slug}`);
  }

  console.log(`\n  Готово: создано ${created}, пропущено ${skipped}. Всего услуг: ${jobs.length}.`);
  console.log('  Дальше: в админке /admin/pricing откройте калькулятор → «Создать прайс» → правила → Опубликовать.\n');
}

main()
  .catch((error) => {
    console.error(error.message ?? error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
