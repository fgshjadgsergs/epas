import { CalculationOutcome, EngineConfigError, EngineDefinition, runCalculation } from './pricing-engine';
import { bannerDefinitionCreate, bannerDemoPriceRulesCreate } from '../../prisma/demo/banner-demo';

/**
 * Расчёты «Баннеров» на ТЕХ ЖЕ демо-данных, что сидятся в БД. Ожидаемые
 * суммы посчитаны вручную по формулам ТЗ §15.12:
 *   total = (area×price_sqm + lugs + hem) × qty × express.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
function bannerEngineDefinition(overrides: Partial<EngineDefinition> = {}): EngineDefinition {
  const def = bannerDefinitionCreate(1) as any;
  const rules = (bannerDemoPriceRulesCreate() as any).create;
  return {
    code: def.code,
    version: def.version,
    pricingMode: def.pricingMode,
    urlOrder: def.urlOrder,
    minQty: def.minQty,
    maxQty: def.maxQty,
    qtyStep: def.qtyStep,
    defaultQty: def.defaultQty,
    currency: 'RUB',
    priceListVersion: 1,
    area: def.config.area,
    metrics: def.config.metrics,
    parameters: def.parameters.create.map((p: any) => ({
      urlKey: p.urlKey,
      label: p.label,
      type: p.type,
      isRequired: p.isRequired ?? true,
      shareable: true,
      unit: p.unit ?? null,
      minValue: p.minValue ?? null,
      maxValue: p.maxValue ?? null,
      stepValue: p.stepValue ?? null,
      defaultValue: p.defaultValue ?? null,
      visibleIf: p.visibleIf ?? null,
      areaUnit: p.config?.unit ?? null,
      options: (p.options?.create ?? []).map((o: any) => ({
        value: o.value,
        label: o.label,
        isDefault: o.isDefault ?? false,
        isActive: true,
      })),
    })),
    compatibilityRules: [],
    priceRules: rules.map((r: any, i: number) => ({
      id: `p${i}`,
      kind: r.kind,
      condition: r.condition ?? null,
      qtyFrom: null,
      qtyTo: null,
      amountMinor: r.amountMinor ?? null,
      multiplier: r.multiplier ?? null,
      config: r.config ?? null,
      sortOrder: r.sortOrder,
    })),
    productionRules: def.productionRules.create.map((r: any, i: number) => ({
      id: `pr${i}`,
      condition: r.condition ?? null,
      workingDays: r.workingDays,
      cutoff: r.cutoff,
      priority: r.priority,
    })),
    upsells: [],
    ...overrides,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const NOW = new Date('2026-07-20T06:00:00Z');

function expectOk(outcome: CalculationOutcome) {
  if (!outcome.ok) throw new Error(`Ожидался успех: ${JSON.stringify(outcome.errors)}`);
  return outcome.result;
}

function derived(result: ReturnType<typeof expectOk>, code: string) {
  return result.derived.find((m) => m.code === code);
}

describe('Баннеры: площадь, периметр, люверсы, подшив (демо-данные)', () => {
  const def = bannerEngineDefinition();

  it('2×1 м, баннер 440, люверсы каждые 50 см: 900 + 12×15 = 1 080 ₽', () => {
    const r = expectOk(runCalculation(def, { parameters: {} }, NOW));
    expect(r.price.amountMinor).toBe(108000);
    expect(derived(r, 'area')).toMatchObject({ perItem: 2, total: 2, unit: 'м²' });
    expect(derived(r, 'perimeter')).toMatchObject({ perItem: 6, total: 6, unit: 'м' });
    expect(derived(r, 'lug-count')).toMatchObject({ perItem: 12, total: 12, unit: 'шт' });
  });

  it('Decimal 1.5×0.75: площадь 1.125 м², периметр 4.5 м, 9 люверсов', () => {
    const r = expectOk(runCalculation(def, { parameters: { w: 1.5, h: 0.75 } }, NOW));
    // 1.125 × 450 ₽ = 506.25 ₽ + 9 × 15 = 641.25 ₽
    expect(r.price.amountMinor).toBe(50625 + 13500);
    expect(derived(r, 'area')?.perItem).toBe(1.125);
    expect(derived(r, 'perimeter')?.perItem).toBe(4.5);
    expect(derived(r, 'lug-count')?.perItem).toBe(9);
  });

  it('CEIL при некратном периметре: 1.3×1 → периметр 4.6 → 10 люверсов', () => {
    const r = expectOk(runCalculation(def, { parameters: { w: 1.3, h: 1 } }, NOW));
    expect(derived(r, 'lug-count')?.perItem).toBe(10);
  });

  it('свой шаг люверсов: lugstep=25 см → 24 люверса на периметр 6 м', () => {
    const r = expectOk(runCalculation(def, { parameters: { lugs: 'custom', lugstep: 25 } }, NOW));
    expect(derived(r, 'lug-count')?.perItem).toBe(24);
    // 900 ₽ + 24 × 15 = 1 260 ₽
    expect(r.price.amountMinor).toBe(90000 + 36000);
  });

  it('скрытый lugstep не влияет: lugs=with + прислан lugstep → шаг остаётся 0.5 м', () => {
    const withStale = expectOk(runCalculation(def, { parameters: { lugs: 'with', lugstep: 25 } }, NOW));
    const clean = expectOk(runCalculation(def, { parameters: { lugs: 'with' } }, NOW));
    expect(withStale.price.amountMinor).toBe(clean.price.amountMinor);
    expect(withStale.normalizedParameters.lugstep).toBeUndefined();
    expect(derived(withStale, 'lug-count')?.perItem).toBe(12);
  });

  it('без люверсов: метрика lug-count отсутствует, надбавки нет', () => {
    const r = expectOk(runCalculation(def, { parameters: { lugs: 'none' } }, NOW));
    expect(r.price.amountMinor).toBe(90000);
    expect(derived(r, 'lug-count')).toBeUndefined();
    expect(derived(r, 'perimeter')?.perItem).toBe(6);
  });

  it('подшив по периметру: basic 80 ₽/м и thick 150 ₽/м', () => {
    const basic = expectOk(runCalculation(def, { parameters: { hem: 'basic' } }, NOW));
    expect(basic.price.amountMinor).toBe(108000 + 48000); // 6 м × 80 ₽
    const thick = expectOk(runCalculation(def, { parameters: { hem: 'thick' } }, NOW));
    expect(thick.price.amountMinor).toBe(108000 + 90000); // 6 м × 150 ₽
  });

  it('материал меняет базу за м²: сатин 607.50 ₽/м²', () => {
    const r = expectOk(runCalculation(def, { parameters: { material: 'satin' } }, NOW));
    expect(r.price.amountMinor).toBe(121500 + 18000);
  });

  it('экспресс умножает базу + люверсы + подшив (формула ТЗ), qty > 1', () => {
    const r = expectOk(
      runCalculation(def, { parameters: { hem: 'basic', express: '1', qty: 2 } }, NOW),
    );
    // ((900 + 180 + 480) × 2) × 1.25 = 3 900 ₽
    expect(r.price.amountMinor).toBe(390000);
    expect(r.production.workingDays).toBe(1);
    expect(derived(r, 'lug-count')).toMatchObject({ perItem: 12, total: 24 });
    expect(derived(r, 'area')).toMatchObject({ perItem: 2, total: 4 });
  });

  it('неизвестный материал и некорректные размеры → 422', () => {
    for (const parameters of [
      { material: 'gold-foil' },
      { w: 0.4 },
      { h: 6 },
      { w: 'abc' as unknown as number },
      { w: -1 },
    ]) {
      const outcome = runCalculation(def, { parameters }, NOW);
      expect(outcome.ok).toBe(false);
    }
  });

  it('maxSqm: площадь сверх лимита отклоняется', () => {
    const capped = bannerEngineDefinition({ area: { unit: 'm', maxSqm: 4 } });
    const outcome = runCalculation(capped, { parameters: { w: 3, h: 2 } }, NOW);
    expect(outcome.ok).toBe(false);
  });

  it('minBillableSqm применяется к изделию: маленький баннер тарифицируется по минимуму', () => {
    const withMin = bannerEngineDefinition({ area: { unit: 'm', minBillableSqm: 1 } });
    const r = expectOk(runCalculation(withMin, { parameters: { w: 0.5, h: 0.5, lugs: 'none' } }, NOW));
    // 0.25 м² < 1 м² → оплачивается 1 м² = 450 ₽; derived показывает фактическую площадь.
    expect(r.price.amountMinor).toBe(45000);
    expect(derived(r, 'area')?.perItem).toBe(0.25);
  });

  it('fail-closed: нулевой интервал — ошибка конфигурации, цена не считается', () => {
    const broken = bannerEngineDefinition();
    (broken.metrics![2] as { interval?: number }).interval = 0.0000001;
    broken.metrics = [...broken.metrics!];
    expect(() => runCalculation(broken, { parameters: {} }, NOW)).toThrow(EngineConfigError);
  });

  it('fail-closed: правило ссылается на отсутствующую метрику', () => {
    const broken = bannerEngineDefinition({ metrics: [] });
    expect(() => runCalculation(broken, { parameters: {} }, NOW)).toThrow(EngineConfigError);
  });
});
