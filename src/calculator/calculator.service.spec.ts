import { UnprocessableEntityException } from '@nestjs/common';
import { CalculatorService } from './calculator.service';
import type { PrismaService } from '../database/prisma.service';
import { makePricingEnv } from '../config/testing/pricing-environment.stub';

/**
 * Preview/confirm parity (Codex review v2, блок 1): /calculate и
 * /calculate/confirm обязаны считать ОДИН и тот же вход (parameters + upsells)
 * одним и тем же путём. Prisma замокана — сервис и движок проходятся целиком;
 * сквозной вариант на живой БД — calculate-confirm.integration.spec.ts.
 */

const definitionRow = {
  id: 'def-1',
  code: 'business-cards',
  title: 'Визитки',
  version: 3,
  status: 'ACTIVE',
  isDemo: false,
  isActive: true,
  pricingMode: 'TIER',
  urlOrder: ['subtype', 'qty'],
  config: null,
  minQty: 50,
  maxQty: 10000,
  qtyStep: 50,
  defaultQty: 100,
  parameters: [
    {
      urlKey: 'subtype',
      label: 'Тип',
      type: 'SEGMENTED',
      isRequired: true,
      shareable: true,
      unit: null,
      minValue: null,
      maxValue: null,
      stepValue: null,
      defaultValue: null,
      visibleIf: null,
      config: null,
      options: [
        { value: 'standard', label: 'Стандартные', isDefault: true, isActive: true, meta: null },
        { value: 'plastic', label: 'Пластиковые', isDefault: false, isActive: true, meta: null },
      ],
    },
  ],
  compatibilityRules: [],
  productionRules: [{ id: 'p1', condition: null, workingDays: 2, cutoff: '14:00', priority: 0 }],
  upsells: [
    {
      code: 'plastic-case',
      label: 'Кейс для визиток',
      pricing: 'FLAT',
      amountMinor: 15000,
      multiplier: null,
      isActive: true,
      visibleIf: null,
    },
    {
      code: 'hole',
      label: 'Отверстие под люверс',
      pricing: 'MULTIPLIER',
      amountMinor: null,
      multiplier: 1.05,
      isActive: true,
      visibleIf: { subtype: 'plastic' },
    },
  ],
};

const priceListRow = {
  id: 'pl-1',
  version: 7,
  currency: 'RUB',
  rules: [
    { id: 't1', kind: 'BASE_TIER', condition: null, qtyFrom: 50, qtyTo: null, amountMinor: 1200, multiplier: null, sortOrder: 0 },
    { id: 't2', kind: 'BASE_TIER', condition: { subtype: 'plastic' }, qtyFrom: 50, qtyTo: null, amountMinor: 3000, multiplier: null, sortOrder: 1 },
  ],
};

function makeFakePrisma(preset: Record<string, string> | null = null) {
  const snapshotCreate = jest.fn().mockImplementation(({ data }) => ({ id: 'snap-1', ...data }));
  const fake = {
    service: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'svc-1',
        isActive: true,
        calculator: { preset, definition: definitionRow },
      }),
    },
    priceList: { findFirst: jest.fn().mockResolvedValue(priceListRow) },
    holiday: { findMany: jest.fn().mockResolvedValue([]) },
    calculationSnapshot: { create: snapshotCreate },
  };
  return { prisma: fake as unknown as PrismaService, snapshotCreate };
}

describe('CalculatorService: preview/confirm parity', () => {
  it('без upsells: calculate и confirm дают одинаковую цену, параметры и версию', async () => {
    const { prisma, snapshotCreate } = makeFakePrisma();
    const service = new CalculatorService(prisma, makePricingEnv());
    const input = { parameters: { subtype: 'standard', qty: 100 } };

    const preview = await service.calculateBySlug('vizitki', input);
    const confirmed = await service.confirmCalculation('vizitki', input);

    expect(confirmed.price.amountMinor).toBe(preview.price.amountMinor);
    expect(confirmed.normalizedParameters).toEqual(preview.normalizedParameters);
    expect(confirmed.calculationVersion).toBe(preview.calculationVersion);
    expect(confirmed.upsells).toEqual([]);
    const snapshotData = snapshotCreate.mock.calls[0][0].data;
    expect(snapshotData.priceListId).toBe('pl-1');
    expect(snapshotData.totalMinor).toBe(preview.price.amountMinor);
  });

  it('с платным upsell: parity по amountMinor/normalized/appliedUpsells/version и связь с прайсом', async () => {
    const { prisma, snapshotCreate } = makeFakePrisma();
    const service = new CalculatorService(prisma, makePricingEnv());
    const input = { parameters: { subtype: 'standard', qty: 100 }, upsells: ['plastic-case'] };

    const preview = await service.calculateBySlug('vizitki', input);
    const confirmed = await service.confirmCalculation('vizitki', input);

    // Upsell реально влияет на цену…
    const withoutUpsell = await service.calculateBySlug('vizitki', { parameters: input.parameters });
    expect(preview.price.amountMinor).toBe(withoutUpsell.price.amountMinor + 15000);
    // …и confirm видит ту же сумму, что preview (дефект «confirm терял upsells» закрыт).
    expect(confirmed.price.amountMinor).toBe(preview.price.amountMinor);
    expect(confirmed.normalizedParameters).toEqual(preview.normalizedParameters);
    expect(confirmed.calculationVersion).toBe(preview.calculationVersion);
    expect(confirmed.upsells).toEqual(['plastic-case']);

    // Snapshot фиксирует normalized input (upsells) и applied upsells.
    const snapshotData = snapshotCreate.mock.calls[0][0].data;
    expect(snapshotData.priceListId).toBe('pl-1');
    expect(snapshotData.upsells).toEqual(['plastic-case']);
    expect(snapshotData.appliedUpsells).toEqual(preview.appliedUpsells);
    expect(snapshotData.totalMinor).toBe(preview.price.amountMinor);
  });

  it('неизвестный upsell → 422 одинаково в preview и confirm', async () => {
    const { prisma, snapshotCreate } = makeFakePrisma();
    const service = new CalculatorService(prisma, makePricingEnv());
    const input = { parameters: { qty: 100 }, upsells: ['nope'] };
    await expect(service.calculateBySlug('vizitki', input)).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(service.confirmCalculation('vizitki', input)).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(snapshotCreate).not.toHaveBeenCalled();
  });

  it('дубликат upsell → 422, snapshot не создаётся', async () => {
    const { prisma, snapshotCreate } = makeFakePrisma();
    const service = new CalculatorService(prisma, makePricingEnv());
    const input = { parameters: { qty: 100 }, upsells: ['plastic-case', 'plastic-case'] };
    await expect(service.confirmCalculation('vizitki', input)).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(snapshotCreate).not.toHaveBeenCalled();
  });

  it('слишком большой массив upsells → 422', async () => {
    const { prisma } = makeFakePrisma();
    const service = new CalculatorService(prisma, makePricingEnv());
    const input = { parameters: { qty: 100 }, upsells: Array.from({ length: 21 }, (_, i) => `u${i}`) };
    await expect(service.confirmCalculation('vizitki', input)).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('upsell, недоступный для текущих параметров (visibleIf) → 422 в обоих путях', async () => {
    const { prisma, snapshotCreate } = makeFakePrisma();
    const service = new CalculatorService(prisma, makePricingEnv());
    const input = { parameters: { subtype: 'standard', qty: 100 }, upsells: ['hole'] };
    await expect(service.calculateBySlug('vizitki', input)).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(service.confirmCalculation('vizitki', input)).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(snapshotCreate).not.toHaveBeenCalled();
  });

  it('публичный DTO определения не содержит isDemo и внутренних цен upsell', async () => {
    const { prisma } = makeFakePrisma();
    const service = new CalculatorService(prisma, makePricingEnv());
    const dto = await service.getDefinitionBySlug('vizitki');
    expect('isDemo' in dto).toBe(false);
    for (const upsell of dto.upsells) {
      expect(Object.keys(upsell).sort()).toEqual(['code', 'label', 'visibleIf']);
    }
  });
});

describe('CalculatorService: binding preset страницы', () => {
  it('корректный preset отдаётся в DTO и не мешает расчёту', async () => {
    const { prisma } = makeFakePrisma({ subtype: 'plastic' });
    const service = new CalculatorService(prisma, makePricingEnv());
    const dto = await service.getDefinitionBySlug('vizitki-plastikovye');
    expect(dto.preset).toEqual({ subtype: 'plastic' });
    const res = await service.calculateBySlug('vizitki-plastikovye', { parameters: { subtype: 'plastic', qty: 100 } });
    expect(res.price.amountMinor).toBeGreaterThan(0);
  });

  it('preset с неизвестным параметром → 422 (fail-closed)', async () => {
    const { prisma } = makeFakePrisma({ nosuch: 'x' });
    const service = new CalculatorService(prisma, makePricingEnv());
    await expect(service.getDefinitionBySlug('vizitki')).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('preset с недопустимой option → 422', async () => {
    const { prisma } = makeFakePrisma({ subtype: 'wooden' });
    const service = new CalculatorService(prisma, makePricingEnv());
    await expect(service.getDefinitionBySlug('vizitki')).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('preset не может содержать promo/b2b/upsells → 422', async () => {
    for (const key of ['promo', 'b2b', 'upsells']) {
      const { prisma } = makeFakePrisma({ [key]: 'x' });
      const service = new CalculatorService(prisma, makePricingEnv());
      await expect(service.getDefinitionBySlug('vizitki')).rejects.toBeInstanceOf(UnprocessableEntityException);
    }
  });
});
