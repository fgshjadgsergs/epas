/**
 * Сквозной integration-тест calculate → confirm на живом PostgreSQL:
 * реальный publish-flow, реальные снапшоты, актуальный ACTIVE-прайс.
 */
import { UnprocessableEntityException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CalculatorService } from './calculator.service';
import { PublishService } from './publish.service';
import type { PrismaService } from '../database/prisma.service';
import { createDisposableDb, migrateDeploy, type DisposableDb } from './testing/integration-db';
import { makePricingEnv } from '../config/testing/pricing-environment.stub';

jest.setTimeout(180000);

const SLUG = 'it-vizitki';

describe('calculate → confirm на живой БД (integration)', () => {
  let db: DisposableDb;
  let prisma: PrismaClient;
  let calculator: CalculatorService;
  let publisher: PublishService;
  let defId: string;
  let priceListV1: string;

  beforeAll(async () => {
    db = await createDisposableDb('photo_print_it_calc');
    migrateDeploy(db.url);
    prisma = new PrismaClient({ datasources: { db: { url: db.url } } });
    calculator = new CalculatorService(prisma as unknown as PrismaService, makePricingEnv());
    publisher = new PublishService(prisma as unknown as PrismaService, makePricingEnv());

    const category = await prisma.category.create({ data: { slug: 'it-cat', title: 'IT' } });
    const service = await prisma.service.create({
      data: { categoryId: category.id, slug: SLUG, title: 'Визитки IT' },
    });

    // Реальный порядок публикации: DRAFT + children → publish.
    const def = await prisma.calculatorDefinition.create({
      data: {
        code: 'it-vizitki',
        title: 'Визитки IT',
        version: 1,
        status: 'DRAFT',
        urlOrder: ['subtype', 'qty'],
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
                  { value: 'standard', label: 'Стандарт', isDefault: true, sortOrder: 0 },
                  { value: 'plastic', label: 'Пластик', sortOrder: 1 },
                ],
              },
            },
          ],
        },
        productionRules: { create: [{ workingDays: 2, cutoff: '14:00', priority: 0 }] },
        upsells: {
          create: [
            { code: 'case', label: 'Кейс', pricing: 'FLAT', amountMinor: 15000, sortOrder: 0 },
            {
              code: 'hole',
              label: 'Люверс',
              pricing: 'FLAT',
              amountMinor: 5000,
              visibleIf: { subtype: 'plastic' },
              sortOrder: 1,
            },
          ],
        },
        priceLists: {
          create: [
            {
              version: 1,
              status: 'DRAFT',
              rules: { create: [{ kind: 'BASE_TIER', qtyFrom: 50, amountMinor: 1000, sortOrder: 0 }] },
            },
          ],
        },
      },
      include: { priceLists: true },
    });
    defId = def.id;
    priceListV1 = def.priceLists[0].id;
    await publisher.publishDefinition(defId);
    await publisher.publishPriceList(priceListV1);
    await prisma.serviceCalculator.create({ data: { serviceId: service.id, definitionId: defId } });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await db?.drop();
  });

  it('parity без upsells: preview и confirm совпадают, snapshot связан с ACTIVE-прайсом', async () => {
    const input = { parameters: { subtype: 'standard', qty: 100 } };
    const preview = await calculator.calculateBySlug(SLUG, input);
    const confirmed = await calculator.confirmCalculation(SLUG, input);

    expect(preview.price.amountMinor).toBe(100000); // 100 × 10.00
    expect(confirmed.price.amountMinor).toBe(preview.price.amountMinor);
    expect(confirmed.normalizedParameters).toEqual(preview.normalizedParameters);
    expect(confirmed.calculationVersion).toBe(preview.calculationVersion);

    const snapshot = await prisma.calculationSnapshot.findUniqueOrThrow({ where: { id: confirmed.snapshotId } });
    expect(snapshot.priceListId).toBe(priceListV1);
    expect(snapshot.totalMinor).toBe(preview.price.amountMinor);
    expect(snapshot.upsells).toEqual([]);
  });

  it('parity с платным upsell: сумма и applied upsells идентичны, snapshot содержит upsells', async () => {
    const input = { parameters: { subtype: 'standard', qty: 100 }, upsells: ['case'] };
    const preview = await calculator.calculateBySlug(SLUG, input);
    const confirmed = await calculator.confirmCalculation(SLUG, input);

    expect(preview.price.amountMinor).toBe(115000); // база 1000×100 + кейс 150.00
    expect(confirmed.price.amountMinor).toBe(preview.price.amountMinor);
    expect(confirmed.upsells).toEqual(['case']);

    const snapshot = await prisma.calculationSnapshot.findUniqueOrThrow({ where: { id: confirmed.snapshotId } });
    expect(snapshot.upsells).toEqual(['case']);
    expect(snapshot.appliedUpsells).toEqual(preview.appliedUpsells);
    expect(snapshot.priceListId).toBe(priceListV1);
  });

  it('негативные сценарии confirm: unknown/duplicate/недоступный upsell → 422 без snapshot', async () => {
    const before = await prisma.calculationSnapshot.count();
    for (const upsells of [['nope'], ['case', 'case'], ['hole']]) {
      await expect(
        calculator.confirmCalculation(SLUG, { parameters: { subtype: 'standard', qty: 100 }, upsells }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    }
    expect(await prisma.calculationSnapshot.count()).toBe(before);
  });

  it('confirm использует текущий ACTIVE-прайс после смены версии', async () => {
    // v1 → архив; v2 с другой ценой → публикация.
    await prisma.priceList.update({ where: { id: priceListV1 }, data: { status: 'ARCHIVED' } });
    const v2 = await prisma.priceList.create({
      data: {
        definitionId: defId,
        version: 2,
        status: 'DRAFT',
        rules: { create: [{ kind: 'BASE_TIER', qtyFrom: 50, amountMinor: 2000, sortOrder: 0 }] },
      },
    });
    await publisher.publishPriceList(v2.id);

    const confirmed = await calculator.confirmCalculation(SLUG, { parameters: { subtype: 'standard', qty: 100 } });
    expect(confirmed.price.amountMinor).toBe(200000); // уже по v2: 100 × 20.00
    const snapshot = await prisma.calculationSnapshot.findUniqueOrThrow({ where: { id: confirmed.snapshotId } });
    expect(snapshot.priceListId).toBe(v2.id);
    expect(snapshot.priceListVersion).toBe(2);

    // Архивная версия v1 по-прежнему недоступна для удаления (RESTRICT + триггер).
    await expect(prisma.priceList.delete({ where: { id: priceListV1 } })).rejects.toThrow();
  });
});
