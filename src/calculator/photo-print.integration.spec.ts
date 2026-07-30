/**
 * Сквозной тест «Фотопечати» на живом PostgreSQL: publish demo-данных →
 * calculate → confirm → snapshot; parity построчной разбивки и связей.
 */
import { UnprocessableEntityException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CalculatorService } from './calculator.service';
import { PublishService } from './publish.service';
import type { PrismaService } from '../database/prisma.service';
import { createDisposableDb, migrateDeploy, type DisposableDb } from './testing/integration-db';
import { photoPrintDefinitionCreate, photoPrintDemoPriceRulesCreate } from '../../prisma/demo/photo-print-demo';
import { makePricingEnv } from '../config/testing/pricing-environment.stub';

jest.setTimeout(180000);

const SLUG = 'fotopechat-na-bumage';

describe('Фотопечать: сквозной flow на живой БД (integration)', () => {
  let db: DisposableDb;
  let prisma: PrismaClient;
  let calculator: CalculatorService;
  let publisher: PublishService;
  let priceListId: string;

  beforeAll(async () => {
    db = await createDisposableDb('photo_print_it_photo');
    migrateDeploy(db.url);
    prisma = new PrismaClient({ datasources: { db: { url: db.url } } });
    calculator = new CalculatorService(prisma as unknown as PrismaService, makePricingEnv());
    publisher = new PublishService(prisma as unknown as PrismaService, makePricingEnv());

    const category = await prisma.category.create({ data: { slug: 'fotopechat', title: 'Фотопечать' } });
    const service = await prisma.service.create({
      data: { categoryId: category.id, slug: SLUG, title: 'Фотопечать на бумаге' },
    });
    const definition = await prisma.calculatorDefinition.create({
      data: {
        ...photoPrintDefinitionCreate(1),
        isDemo: true,
        status: 'DRAFT',
        priceLists: {
          create: [
            { version: 1, status: 'DRAFT', isDemo: true, currency: 'RUB', rules: photoPrintDemoPriceRulesCreate() },
          ],
        },
      },
      include: { priceLists: true },
    });
    priceListId = definition.priceLists[0].id;

    // Publish-валидация построчных правил проходит на реальных данных.
    await publisher.publishDefinition(definition.id);
    await publisher.publishPriceList(priceListId);
    await prisma.serviceCalculator.create({ data: { serviceId: service.id, definitionId: definition.id } });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await db?.drop();
  });

  it('definition DTO отдаёт строки MULTI_QTY и публичные границы', async () => {
    const dto = await calculator.getDefinitionBySlug(SLUG);
    const formats = dto.parameters.find((p) => p.urlKey === 'formats');
    expect(formats?.type).toBe('MULTI_QTY');
    expect(formats?.options.map((o) => o.value)).toEqual([
      '10x15', '13x18', '15x20', '20x30', '30x40', '30x45', '40x60', 'custom',
    ]);
    expect(formats?.multiQty).toMatchObject({ maxLines: 8, totalMin: 1, totalMax: 10000 });
  });

  it('confirm parity: lineItems, totalQuantity, суммы, applied rules, priceListId', async () => {
    const input = { parameters: { formats: { '10x15': 100, '20x30': 20 }, paper: 'satin' } };
    const preview = await calculator.calculateBySlug(SLUG, input);
    const confirmed = await calculator.confirmCalculation(SLUG, input);

    // Ручная математика: (100×18 + 20×70) × 1.1 = 3520 ₽.
    expect(preview.price.amountMinor).toBe(352000);
    expect(confirmed.price.amountMinor).toBe(preview.price.amountMinor);
    expect(confirmed.lineItems).toEqual(preview.lineItems);
    expect(confirmed.totalQuantity).toBe(120);
    expect(preview.lineItems.map((l) => l.key)).toEqual(['10x15', '20x30']);
    expect(confirmed.normalizedParameters).toEqual(preview.normalizedParameters);

    const snapshot = await prisma.calculationSnapshot.findUniqueOrThrow({ where: { id: confirmed.snapshotId } });
    expect(snapshot.priceListId).toBe(priceListId);
    expect(snapshot.totalMinor).toBe(preview.price.amountMinor);
    // Normalized multi-qty input сохранён с форматными ключами.
    expect((snapshot.parameters as { formats: Record<string, number> }).formats).toEqual({
      '10x15': 100,
      '20x30': 20,
    });
    // Line totals зафиксированы в appliedRules с rule id.
    const lineApplied = (snapshot.appliedRules as { kind: string; ruleId: string; amountMinor: number }[]).filter(
      (r) => r.kind === 'BASE_PER_MULTI_QTY_LINE',
    );
    expect(lineApplied.map((r) => r.amountMinor).sort((a, b) => a - b)).toEqual([140000, 180000]);
    expect(lineApplied.every((r) => typeof r.ruleId === 'string')).toBe(true);
  });

  it('строка без цены не публикуется (fail-closed на publish)', async () => {
    const definition = await prisma.calculatorDefinition.findFirstOrThrow({ where: { code: 'photo-print' } });
    const badRules = photoPrintDemoPriceRulesCreate();
    badRules.create = badRules.create.filter(
      (r) => !('config' in r) || (r as { config?: { lineKey?: string } }).config?.lineKey !== 'custom',
    );
    const badList = await prisma.priceList.create({
      data: { definitionId: definition.id, version: 99, status: 'DRAFT', rules: badRules },
    });
    await expect(publisher.publishPriceList(badList.id)).rejects.toBeInstanceOf(UnprocessableEntityException);
    await prisma.priceList.delete({ where: { id: badList.id } });
  });

  it('пустой заказ → 422 без snapshot', async () => {
    const before = await prisma.calculationSnapshot.count();
    await expect(
      calculator.confirmCalculation(SLUG, { parameters: { formats: {} } }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(await prisma.calculationSnapshot.count()).toBe(before);
  });
});
