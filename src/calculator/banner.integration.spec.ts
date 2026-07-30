/**
 * Сквозной тест «Баннеров» на живом PostgreSQL: publish demo-данных →
 * definition DTO → calculate → confirm → snapshot, parity по суммам,
 * derived-метрикам, normalized input и applied rules.
 */
import { UnprocessableEntityException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CalculatorService } from './calculator.service';
import { PublishService } from './publish.service';
import type { PrismaService } from '../database/prisma.service';
import { createDisposableDb, migrateDeploy, type DisposableDb } from './testing/integration-db';
import { bannerDefinitionCreate, bannerDemoPriceRulesCreate } from '../../prisma/demo/banner-demo';
import { makePricingEnv } from '../config/testing/pricing-environment.stub';

jest.setTimeout(180000);

const SLUG = 'bannery';

describe('Баннеры: сквозной flow на живой БД (integration)', () => {
  let db: DisposableDb;
  let prisma: PrismaClient;
  let calculator: CalculatorService;
  let publisher: PublishService;
  let priceListId: string;

  beforeAll(async () => {
    db = await createDisposableDb('photo_print_it_ban');
    migrateDeploy(db.url);
    prisma = new PrismaClient({ datasources: { db: { url: db.url } } });
    calculator = new CalculatorService(prisma as unknown as PrismaService, makePricingEnv());
    publisher = new PublishService(prisma as unknown as PrismaService, makePricingEnv());

    const category = await prisma.category.create({ data: { slug: 'shirokoformat', title: 'Широкоформат' } });
    const service = await prisma.service.create({
      data: { categoryId: category.id, slug: SLUG, title: 'Баннеры' },
    });
    const definition = await prisma.calculatorDefinition.create({
      data: {
        ...bannerDefinitionCreate(1),
        isDemo: true,
        status: 'DRAFT',
        priceLists: {
          create: [
            { version: 1, status: 'DRAFT', isDemo: true, currency: 'RUB', rules: bannerDemoPriceRulesCreate() },
          ],
        },
      },
      include: { priceLists: true },
    });
    priceListId = definition.priceLists[0].id;

    // Publish-валидация новых метрик/правил проходит на реальных данных.
    await publisher.publishDefinition(definition.id);
    await publisher.publishPriceList(priceListId);
    await prisma.serviceCalculator.create({ data: { serviceId: service.id, definitionId: definition.id } });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await db?.drop();
  });

  it('definition DTO: urlOrder и размеры в метрах', async () => {
    const dto = await calculator.getDefinitionBySlug(SLUG);
    expect(dto.urlOrder).toEqual(['w', 'h', 'material', 'lugs', 'lugstep', 'hem', 'qty', 'express']);
    expect(dto.parameters.find((p) => p.urlKey === 'w')).toMatchObject({ min: 0.5, max: 5, step: 0.05, unit: 'м' });
    expect(dto.parameters.find((p) => p.urlKey === 'lugstep')?.visibleIf).toEqual({ lugs: 'custom' });
  });

  it('calculate 2×1: 1 080 ₽ с derived-метриками', async () => {
    const res = await calculator.calculateBySlug(SLUG, { parameters: {} });
    expect(res.price.amountMinor).toBe(108000);
    expect(res.derived).toEqual([
      { code: 'area', label: 'Площадь', unit: 'м²', perItem: 2, total: 2 },
      { code: 'perimeter', label: 'Периметр', unit: 'м', perItem: 6, total: 6 },
      { code: 'lug-count', label: 'Люверсы', unit: 'шт', perItem: 12, total: 12 },
    ]);
  });

  it('confirm parity: суммы, derived, normalized input, applied rules, priceListId', async () => {
    const input = {
      parameters: { w: 1.5, h: 0.75, material: 'satin', lugs: 'custom', lugstep: 25, hem: 'basic', qty: 2 },
    };
    const preview = await calculator.calculateBySlug(SLUG, input);
    const confirmed = await calculator.confirmCalculation(SLUG, input);

    expect(confirmed.price.amountMinor).toBe(preview.price.amountMinor);
    expect(confirmed.derived).toEqual(preview.derived);
    expect(confirmed.normalizedParameters).toEqual(preview.normalizedParameters);
    expect(confirmed.normalizedParameters).toMatchObject({ w: 1.5, h: 0.75, lugstep: 25 });

    const snapshot = await prisma.calculationSnapshot.findUniqueOrThrow({ where: { id: confirmed.snapshotId } });
    expect(snapshot.priceListId).toBe(priceListId);
    expect(snapshot.totalMinor).toBe(preview.price.amountMinor);
    expect(snapshot.parameters).toMatchObject({ material: 'satin', hem: 'basic' });
    const appliedKinds = (snapshot.appliedRules as { kind: string; ruleId: string | null }[]).map((r) => r.kind);
    expect(appliedKinds).toEqual(
      expect.arrayContaining(['BASE_PER_SQM', 'SURCHARGE_PER_INTERVAL_COUNT', 'SURCHARGE_PER_LENGTH']),
    );
    expect(
      (snapshot.appliedRules as { ruleId: string | null }[]).every((r) => typeof r.ruleId === 'string'),
    ).toBe(true);

    // Ручная математика: площадь 1.125 × 607.50 = 683.44 (округление до коп.)
    // периметр 4.5 м, шаг 0.25 м → 18 люверсов × 15 = 270 ₽; подшив 4.5 × 80 = 360 ₽;
    // (683.44 + 270 + 360) × 2 = 2 626.88 ₽.
    expect(preview.price.amountMinor).toBe((68344 + 27000 + 36000) * 2);
  });

  it('некорректные размеры → 422; повреждённое метрическое правило не публикуется', async () => {
    await expect(
      calculator.calculateBySlug(SLUG, { parameters: { w: 0.2, h: 1 } }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    // Прайс с правилом на несуществующую метрику отклоняется публикацией.
    const definition = await prisma.calculatorDefinition.findFirstOrThrow({ where: { code: 'banner-print' } });
    const badList = await prisma.priceList.create({
      data: {
        definitionId: definition.id,
        version: 99,
        status: 'DRAFT',
        rules: {
          create: [
            { kind: 'BASE_PER_SQM', amountMinor: 45000, sortOrder: 0 },
            {
              kind: 'SURCHARGE_PER_LENGTH',
              amountMinor: 8000,
              config: { sourceMetric: 'no-such-metric', unit: 'm', perItem: true },
              sortOrder: 1,
            },
          ],
        },
      },
    });
    await expect(publisher.publishPriceList(badList.id)).rejects.toBeInstanceOf(UnprocessableEntityException);
    await prisma.priceList.delete({ where: { id: badList.id } });
  });
});
