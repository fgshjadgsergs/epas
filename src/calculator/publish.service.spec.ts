import { ConflictException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { PublishService } from './publish.service';
import type { PrismaService } from '../database/prisma.service';
import { makePricingEnv } from '../config/testing/pricing-environment.stub';

/**
 * PublishService — единственная защита от «demo-прайс стал production-ценой»
 * (Codex review, блок 1 и 5). Мокаем PrismaService: транзакция выполняет
 * переданный колбэк с тем же мок-клиентом (как реальный prisma.$transaction).
 */
function makeFakePrisma(overrides: {
  priceList?: Partial<Record<string, unknown>>;
  otherActivePriceLists?: unknown[];
  definition?: Partial<Record<string, unknown>>;
}) {
  const fake = {
    priceList: {
      findUnique: jest.fn().mockResolvedValue(overrides.priceList ?? null),
      findMany: jest.fn().mockResolvedValue(overrides.otherActivePriceLists ?? []),
      update: jest.fn().mockImplementation(({ data }) => ({
        id: (overrides.priceList as { id: string })?.id ?? 'pl-1',
        version: 1,
        status: data.status,
      })),
    },
    calculatorDefinition: {
      findUnique: jest.fn().mockResolvedValue(overrides.definition ?? null),
      update: jest.fn().mockImplementation(({ data }) => ({
        id: (overrides.definition as { id: string })?.id ?? 'def-1',
        version: 1,
        status: data.status,
      })),
    },
    // Advisory lock (блок 6) в юнит-тестах — no-op; реальную сериализацию
    // проверяет publish-concurrency.integration.spec.ts на живом PostgreSQL.
    $executeRaw: jest.fn().mockResolvedValue(0),
    $transaction: jest.fn().mockImplementation((cb: (tx: unknown) => unknown) => cb(fake)),
  };
  return fake as unknown as PrismaService;
}

const basePriceList = {
  id: 'pl-1',
  definitionId: 'def-1',
  status: 'DRAFT',
  isDemo: false,
  publishedAt: null,
  validFrom: null,
  validTo: null,
  rules: [{ id: 'r1', kind: 'BASE_TIER', condition: null, qtyFrom: 50, qtyTo: null, amountMinor: 1000, multiplier: null, sortOrder: 0 }],
  definition: { minQty: 50, config: null, parameters: [] },
};

describe('PublishService.publishPriceList', () => {
  it('запрещает активацию demo-прайса в production', async () => {
    const prisma = makeFakePrisma({ priceList: { ...basePriceList, isDemo: true } });
    // Боевое окружение: демо-прайс не публикуется.
    const service = new PublishService(prisma, makePricingEnv('production'));
    await expect(service.publishPriceList('pl-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('разрешает активацию demo-прайса вне production (для локального тестирования)', async () => {
    const prisma = makeFakePrisma({ priceList: { ...basePriceList, isDemo: true } });
    const service = new PublishService(prisma, makePricingEnv('development'));
    const result = await service.publishPriceList('pl-1');
    expect(result.status).toBe('ACTIVE');
  });

  it('публикует корректный не-demo прайс-лист', async () => {
    const prisma = makeFakePrisma({ priceList: basePriceList });
    const service = new PublishService(prisma, makePricingEnv('production'));
    const result = await service.publishPriceList('pl-1');
    expect(result.status).toBe('ACTIVE');
  });

  it('отклоняет повторную публикацию уже опубликованного прайса', async () => {
    const prisma = makeFakePrisma({
      priceList: { ...basePriceList, status: 'ACTIVE', publishedAt: new Date() },
    });
    const service = new PublishService(prisma, makePricingEnv());
    await expect(service.publishPriceList('pl-1')).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('отклоняет validFrom >= validTo', async () => {
    const prisma = makeFakePrisma({
      priceList: { ...basePriceList, validFrom: new Date('2026-02-01'), validTo: new Date('2026-01-01') },
    });
    const service = new PublishService(prisma, makePricingEnv());
    await expect(service.publishPriceList('pl-1')).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('отклоняет пересекающиеся диапазоны тиража', async () => {
    const prisma = makeFakePrisma({
      priceList: {
        ...basePriceList,
        rules: [
          { id: 'r1', kind: 'BASE_TIER', condition: null, qtyFrom: 50, qtyTo: 200, amountMinor: 1000, multiplier: null, sortOrder: 0 },
          { id: 'r2', kind: 'BASE_TIER', condition: null, qtyFrom: 150, qtyTo: null, amountMinor: 800, multiplier: null, sortOrder: 1 },
        ],
      },
    });
    const service = new PublishService(prisma, makePricingEnv());
    await expect(service.publishPriceList('pl-1')).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('отклоняет неоднозначный sortOrder у правил', async () => {
    const prisma = makeFakePrisma({
      priceList: {
        ...basePriceList,
        rules: [
          ...basePriceList.rules,
          { id: 'r2', kind: 'MULTIPLIER', condition: { sides: 'double' }, qtyFrom: null, qtyTo: null, amountMinor: null, multiplier: 1.1, sortOrder: 5 },
          { id: 'r3', kind: 'MULTIPLIER', condition: { sides: 'double' }, qtyFrom: null, qtyTo: null, amountMinor: null, multiplier: 1.2, sortOrder: 5 },
        ],
      },
    });
    const service = new PublishService(prisma, makePricingEnv());
    await expect(service.publishPriceList('pl-1')).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('возвращает 409 при пересечении периода с другим активным прайсом', async () => {
    const prisma = makeFakePrisma({
      priceList: basePriceList,
      otherActivePriceLists: [{ id: 'pl-2', validFrom: null, validTo: null }],
    });
    const service = new PublishService(prisma, makePricingEnv());
    await expect(service.publishPriceList('pl-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('повреждённое правило (не проходит zod) блокирует публикацию', async () => {
    const prisma = makeFakePrisma({
      priceList: {
        ...basePriceList,
        rules: [{ id: 'r1', kind: 'BASE_TIER', condition: null, qtyFrom: null, qtyTo: null, amountMinor: null, multiplier: null, sortOrder: 0 }],
      },
    });
    const service = new PublishService(prisma, makePricingEnv());
    await expect(service.publishPriceList('pl-1')).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});

describe('PublishService.publishDefinition', () => {
  const baseDefinition = {
    id: 'def-1',
    status: 'DRAFT',
    isDemo: false,
    publishedAt: null,
    compatibilityRules: [],
    productionRules: [{ id: 'p1', condition: null, workingDays: 2, cutoff: '14:00', priority: 0 }],
    parameters: [
      { urlKey: 'w', type: 'DIMENSION', minValue: 30, maxValue: 100 },
      { urlKey: 'subtype', type: 'SEGMENTED', minValue: null, maxValue: null },
    ],
  };

  it('запрещает активацию demo-определения в production', async () => {
    const prisma = makeFakePrisma({ definition: { ...baseDefinition, isDemo: true } });
    const service = new PublishService(prisma, makePricingEnv('production'));
    await expect(service.publishDefinition('def-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('отклоняет неоднозначный priority у правил срока', async () => {
    const prisma = makeFakePrisma({
      definition: {
        ...baseDefinition,
        productionRules: [
          { id: 'p1', condition: null, workingDays: 2, cutoff: '14:00', priority: 0 },
          { id: 'p2', condition: null, workingDays: 1, cutoff: '12:00', priority: 0 },
        ],
      },
    });
    const service = new PublishService(prisma, makePricingEnv());
    await expect(service.publishDefinition('def-1')).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('публикует корректное определение', async () => {
    const prisma = makeFakePrisma({ definition: baseDefinition });
    const service = new PublishService(prisma, makePricingEnv());
    const result = await service.publishDefinition('def-1');
    expect(result.status).toBe('ACTIVE');
  });

  it('отклоняет ARCHIVED-определение (публикуется только черновик)', async () => {
    const prisma = makeFakePrisma({ definition: { ...baseDefinition, status: 'ARCHIVED' } });
    const service = new PublishService(prisma, makePricingEnv());
    await expect(service.publishDefinition('def-1')).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('отклоняет cutoff 99:99 у правила срока (блок 8: часы 00–23, минуты 00–59)', async () => {
    const prisma = makeFakePrisma({
      definition: {
        ...baseDefinition,
        productionRules: [{ id: 'p1', condition: null, workingDays: 2, cutoff: '99:99', priority: 0 }],
      },
    });
    const service = new PublishService(prisma, makePricingEnv());
    await expect(service.publishDefinition('def-1')).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('SET_BOUNDS: неизвестный target-параметр блокирует публикацию', async () => {
    const prisma = makeFakePrisma({
      definition: {
        ...baseDefinition,
        compatibilityRules: [
          { id: 'c1', kind: 'SET_BOUNDS', when: { subtype: 'plastic' }, target: { param: 'nope', min: 1 }, sortOrder: 0 },
        ],
      },
    });
    const service = new PublishService(prisma, makePricingEnv());
    await expect(service.publishDefinition('def-1')).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('SET_BOUNDS: min/max/step для не-DIMENSION параметра блокирует публикацию', async () => {
    const prisma = makeFakePrisma({
      definition: {
        ...baseDefinition,
        compatibilityRules: [
          { id: 'c1', kind: 'SET_BOUNDS', when: { w: '50' }, target: { param: 'subtype', min: 1 }, sortOrder: 0 },
        ],
      },
    });
    const service = new PublishService(prisma, makePricingEnv());
    await expect(service.publishDefinition('def-1')).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('SET_BOUNDS: невозможный effective-диапазон (override min > базового max)', async () => {
    const prisma = makeFakePrisma({
      definition: {
        ...baseDefinition,
        compatibilityRules: [
          // База w: 30..100; override min=200 → пустой диапазон.
          { id: 'c1', kind: 'SET_BOUNDS', when: { subtype: 'plastic' }, target: { param: 'w', min: 200 }, sortOrder: 0 },
        ],
      },
    });
    const service = new PublishService(prisma, makePricingEnv());
    await expect(service.publishDefinition('def-1')).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('SET_BOUNDS: циклическая зависимость (when по числовой цели другого правила)', async () => {
    const prisma = makeFakePrisma({
      definition: {
        ...baseDefinition,
        compatibilityRules: [
          { id: 'c1', kind: 'SET_BOUNDS', when: { subtype: 'plastic' }, target: { param: 'w', min: 40 }, sortOrder: 0 },
          // when ссылается на w — числовую цель c1: порядок применения границ
          // менял бы контекст сопоставления → отклоняется.
          { id: 'c2', kind: 'SET_BOUNDS', when: { w: '40' }, target: { param: 'qty', min: 100 }, sortOrder: 1 },
        ],
      },
    });
    const service = new PublishService(prisma, makePricingEnv());
    await expect(service.publishDefinition('def-1')).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
