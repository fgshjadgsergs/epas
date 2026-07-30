/**
 * Сквозной тест «Листовок» на живом PostgreSQL: реальные демо-данные
 * (prisma/demo/leaflets-demo.ts) → publish flow → definition DTO →
 * calculate → confirm → CalculationSnapshot; плюс запрет demo-прайса
 * в production.
 */
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CalculatorService } from './calculator.service';
import { PublishService } from './publish.service';
import type { PrismaService } from '../database/prisma.service';
import { createDisposableDb, migrateDeploy, type DisposableDb } from './testing/integration-db';
import { leafletsDefinitionCreate, leafletsDemoPriceRulesCreate } from '../../prisma/demo/leaflets-demo';
import { makePricingEnv } from '../config/testing/pricing-environment.stub';

jest.setTimeout(180000);

const SLUG = 'listovki';

describe('Листовки: сквозной flow на живой БД (integration)', () => {
  let db: DisposableDb;
  let prisma: PrismaClient;
  let calculator: CalculatorService;
  let publisher: PublishService;
  let priceListId: string;

  beforeAll(async () => {
    db = await createDisposableDb('photo_print_it_leaf');
    migrateDeploy(db.url);
    prisma = new PrismaClient({ datasources: { db: { url: db.url } } });
    calculator = new CalculatorService(prisma as unknown as PrismaService, makePricingEnv());
    publisher = new PublishService(prisma as unknown as PrismaService, makePricingEnv());

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
    priceListId = definition.priceLists[0].id;

    // Реальный publish flow: валидация схем/диапазонов/порядка при публикации.
    await publisher.publishDefinition(definition.id);
    await publisher.publishPriceList(priceListId);
    await prisma.serviceCalculator.create({ data: { serviceId: service.id, definitionId: definition.id } });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await db?.drop();
  });

  it('definition DTO: порядок параметров, urlOrder и дефолты из БД', async () => {
    const dto = await calculator.getDefinitionBySlug(SLUG);
    expect(dto.urlOrder).toEqual(['format', 'w', 'h', 'paper', 'color', 'coating', 'qty', 'express']);
    expect(dto.parameters.map((p) => p.urlKey)).toEqual(['format', 'w', 'h', 'paper', 'color', 'coating', 'express']);
    expect(dto.parameters.find((p) => p.urlKey === 'format')?.default).toBe('A5');
    expect(dto.parameters.find((p) => p.urlKey === 'w')).toMatchObject({ min: 74, max: 297, step: 1 });
    expect(dto.qty).toEqual({ min: 100, max: 100000, step: 100, default: 500 });
    expect(dto.hasActivePriceList).toBe(true);
  });

  it('calculate: стандартный формат по демо-прайсу', async () => {
    const res = await calculator.calculateBySlug(SLUG, { parameters: { qty: 500 } });
    expect(res.price.amountMinor).toBe(231000); // 500 × 4.20 × 1.1
    expect(res.normalizedParameters.w).toBeUndefined();
  });

  it('calculate: свой размер валидируется и влияет через множитель', async () => {
    const res = await calculator.calculateBySlug(SLUG, {
      parameters: { format: 'custom', w: 148, h: 210, qty: 500 },
    });
    expect(res.price.amountMinor).toBe(300300);
    await expect(
      calculator.calculateBySlug(SLUG, { parameters: { format: 'custom', w: 10, h: 210, qty: 500 } }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('confirm parity: та же цена, snapshot с точными связями и normalized input', async () => {
    const input = {
      parameters: { format: 'A4', paper: 'coated-200', color: '4+0', coating: 'gloss-lam', qty: 1000 },
      upsells: ['numbering'],
    };
    const preview = await calculator.calculateBySlug(SLUG, input);
    const confirmed = await calculator.confirmCalculation(SLUG, input);
    expect(confirmed.price.amountMinor).toBe(preview.price.amountMinor);
    expect(confirmed.normalizedParameters).toEqual(preview.normalizedParameters);

    const snapshot = await prisma.calculationSnapshot.findUniqueOrThrow({ where: { id: confirmed.snapshotId } });
    expect(snapshot.priceListId).toBe(priceListId);
    expect(snapshot.serviceSlug).toBe(SLUG);
    expect(snapshot.parameters).toMatchObject({ format: 'A4', paper: 'coated-200', color: '4+0' });
    expect(snapshot.upsells).toEqual(['numbering']);
    expect(Array.isArray(snapshot.appliedRules)).toBe(true);
    expect((snapshot.appliedRules as unknown[]).length).toBeGreaterThan(0);
    expect(snapshot.totalMinor).toBe(preview.price.amountMinor);
  });

  it('вариантная страница: второй binding с preset использует тот же definition и прайс', async () => {
    // Страница-вариант /listovki/a4/: собственный Service + ServiceCalculator
    // с preset, но БЕЗ копий definition/price list.
    const category = await prisma.category.findFirstOrThrow();
    const variant = await prisma.service.create({
      data: { categoryId: category.id, slug: 'listovki-a4', title: 'Листовки A4' },
    });
    const parentBinding = await prisma.serviceCalculator.findFirstOrThrow({
      where: { service: { slug: SLUG } },
    });
    await prisma.serviceCalculator.create({
      data: { serviceId: variant.id, definitionId: parentBinding.definitionId, preset: { format: 'A4' } },
    });

    // Definition отдаёт preset страницы; сам definition — общий.
    const dto = await calculator.getDefinitionBySlug('listovki-a4');
    expect(dto.preset).toEqual({ format: 'A4' });
    expect(dto.calculationVersion).toBe((await calculator.getDefinitionBySlug(SLUG)).calculationVersion);

    // calculate/confirm через binding варианта: та же цена, что у родителя.
    const input = { parameters: { format: 'A4', qty: 1000 } };
    const viaParent = await calculator.calculateBySlug(SLUG, input);
    const viaVariant = await calculator.calculateBySlug('listovki-a4', input);
    expect(viaVariant.price.amountMinor).toBe(viaParent.price.amountMinor);

    const confirmed = await calculator.confirmCalculation('listovki-a4', input);
    const snapshot = await prisma.calculationSnapshot.findUniqueOrThrow({ where: { id: confirmed.snapshotId } });
    expect(snapshot.serviceSlug).toBe('listovki-a4');
    expect(snapshot.priceListId).toBe(priceListId); // единый прайс, без копий
  });

  it('binding с некорректным preset отдаёт 422, а не тихо ломает расчёт', async () => {
    const category = await prisma.category.findFirstOrThrow();
    const broken = await prisma.service.create({
      data: { categoryId: category.id, slug: 'listovki-broken', title: 'Сломанный preset' },
    });
    const parentBinding = await prisma.serviceCalculator.findFirstOrThrow({
      where: { service: { slug: SLUG } },
    });
    await prisma.serviceCalculator.create({
      data: { serviceId: broken.id, definitionId: parentBinding.definitionId, preset: { promo: 'SALE' } },
    });
    await expect(calculator.getDefinitionBySlug('listovki-broken')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('в production demo-данные листовок недоступны (defense in depth)', async () => {
    // Тот же набор данных, но окружение боевое: демо-определение и демо-прайс
    // не должны быть видны вообще.
    const productionCalculator = new CalculatorService(
      prisma as unknown as PrismaService,
      makePricingEnv('production'),
    );
    await expect(productionCalculator.getDefinitionBySlug(SLUG)).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      productionCalculator.calculateBySlug(SLUG, { parameters: { qty: 500 } }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('staging без ALLOW_DEMO_PRICING тоже не видит демо-прайс, с флагом — видит', async () => {
    const stagingOff = new CalculatorService(prisma as unknown as PrismaService, makePricingEnv('staging', false));
    await expect(stagingOff.getDefinitionBySlug(SLUG)).rejects.toBeInstanceOf(NotFoundException);

    const stagingOn = new CalculatorService(prisma as unknown as PrismaService, makePricingEnv('staging', true));
    const dto = await stagingOn.getDefinitionBySlug(SLUG);
    expect(dto.hasActivePriceList).toBe(true);

    // Расчёт на демо-стенде честно помечен как демонстрационный.
    const result = await stagingOn.calculateBySlug(SLUG, { parameters: { qty: 500 } });
    expect(result.pricingMode).toBe('DEMO');
  });
});
