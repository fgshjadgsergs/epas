/**
 * Конкурентная публикация прайс-листов на живом PostgreSQL: две параллельные
 * транзакции с пересекающимися периодами — ровно одна успешна, вторая 409,
 * в БД остаётся один ACTIVE-прайс (advisory lock + exclusion constraint).
 */
import { ConflictException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PublishService } from './publish.service';
import type { PrismaService } from '../database/prisma.service';
import { createDisposableDb, migrateDeploy, type DisposableDb } from './testing/integration-db';
import { makePricingEnv } from '../config/testing/pricing-environment.stub';

jest.setTimeout(180000);

describe('Конкурентная публикация прайс-листов (integration)', () => {
  let db: DisposableDb;
  let prisma: PrismaClient;
  let service: PublishService;
  let defId: string;

  beforeAll(async () => {
    db = await createDisposableDb('photo_print_it_pub');
    migrateDeploy(db.url);
    prisma = new PrismaClient({ datasources: { db: { url: db.url } } });
    service = new PublishService(prisma as unknown as PrismaService, makePricingEnv());
    const def = await prisma.calculatorDefinition.create({
      data: {
        code: 'it-pub',
        title: 'Публикация',
        version: 1,
        status: 'DRAFT',
        urlOrder: ['qty'],
        minQty: 50,
        maxQty: 10000,
        qtyStep: 50,
        defaultQty: 100,
      },
    });
    defId = def.id;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await db?.drop();
  });

  function draftPriceList(version: number, validFrom: Date | null = null, validTo: Date | null = null) {
    return prisma.priceList.create({
      data: {
        definitionId: defId,
        version,
        status: 'DRAFT',
        validFrom,
        validTo,
        rules: { create: [{ kind: 'BASE_TIER', qtyFrom: 50, amountMinor: 1000, sortOrder: 0 }] },
      },
    });
  }

  it('Promise.all двух publish с открытыми периодами: ровно один ACTIVE, второй — 409', async () => {
    const [a, b] = await Promise.all([draftPriceList(1), draftPriceList(2)]);

    const results = await Promise.allSettled([service.publishPriceList(a.id), service.publishPriceList(b.id)]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictException);

    const active = await prisma.priceList.findMany({ where: { definitionId: defId, status: 'ACTIVE' } });
    expect(active).toHaveLength(1);
  });

  it('непересекающиеся периоды публикуются оба ([2027-01,2027-02) и [2027-02,2027-03))', async () => {
    // Отдельный definition: у defId уже есть ACTIVE-прайс с ОТКРЫТЫМ периодом,
    // который пересекается с любым ограниченным.
    const boundedDef = await prisma.calculatorDefinition.create({
      data: {
        code: 'it-pub-bounded',
        title: 'Периоды',
        version: 1,
        status: 'DRAFT',
        urlOrder: ['qty'],
        minQty: 50,
        maxQty: 10000,
        qtyStep: 50,
        defaultQty: 100,
      },
    });
    const makeBounded = (version: number, from: string, to: string) =>
      prisma.priceList.create({
        data: {
          definitionId: boundedDef.id,
          version,
          status: 'DRAFT',
          validFrom: new Date(from),
          validTo: new Date(to),
          rules: { create: [{ kind: 'BASE_TIER', qtyFrom: 50, amountMinor: 1000, sortOrder: 0 }] },
        },
      });
    const [a, b] = await Promise.all([
      makeBounded(1, '2027-01-01', '2027-02-01'),
      makeBounded(2, '2027-02-01', '2027-03-01'),
    ]);
    // validTo исключителен: границы 2027-02-01 соприкасаются, но не пересекаются.
    const results = await Promise.allSettled([service.publishPriceList(a.id), service.publishPriceList(b.id)]);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
  });

  it('разные definitions не конфликтуют между собой', async () => {
    const otherDef = await prisma.calculatorDefinition.create({
      data: {
        code: 'it-pub-other',
        title: 'Другая услуга',
        version: 1,
        status: 'DRAFT',
        urlOrder: ['qty'],
        minQty: 50,
        maxQty: 10000,
        qtyStep: 50,
        defaultQty: 100,
      },
    });
    const other = await prisma.priceList.create({
      data: {
        definitionId: otherDef.id,
        version: 1,
        status: 'DRAFT',
        rules: { create: [{ kind: 'BASE_TIER', qtyFrom: 50, amountMinor: 500, sortOrder: 0 }] },
      },
    });
    // У defId уже есть ACTIVE с открытым периодом — но это другой definition.
    const published = await service.publishPriceList(other.id);
    expect(published.status).toBe('ACTIVE');
  });

  it('exclusion constraint остаётся жёсткой линией: прямой SQL-апдейт мимо сервиса отклоняется БД', async () => {
    const sneaky = await draftPriceList(5);
    // Прямой UPDATE мимо PublishService (имитация «другого сервиса»):
    // триггер разрешает DRAFT->ACTIVE, но exclusion constraint видит
    // пересечение с уже активным открытым периодом и отклоняет.
    await expect(
      prisma.$executeRawUnsafe(`UPDATE price_lists SET status = 'ACTIVE' WHERE id = '${sneaky.id}'`),
    ).rejects.toThrow(/price_lists_active_period_excl|conflicting key value/);
  });
});
