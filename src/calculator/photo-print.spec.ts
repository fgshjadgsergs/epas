import { CalculationOutcome, EngineDefinition, runCalculation } from './pricing-engine';
import { photoPrintDefinitionCreate, photoPrintDemoPriceRulesCreate } from '../../prisma/demo/photo-print-demo';

/**
 * Расчёты «Фотопечати» на ТЕХ ЖЕ демо-данных, что сидятся в БД.
 * Цены — демонстрационные, из прототипа frontend.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
function photoEngineDefinition(): EngineDefinition {
  const def = photoPrintDefinitionCreate(1) as any;
  const rules = (photoPrintDemoPriceRulesCreate() as any).create;
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
      multiQty: p.config?.multiQty ?? null,
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
      qtyFrom: r.qtyFrom ?? null,
      qtyTo: r.qtyTo ?? null,
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
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const NOW = new Date('2026-07-20T06:00:00Z');

function expectOk(outcome: CalculationOutcome) {
  if (!outcome.ok) throw new Error(`Ожидался успех: ${JSON.stringify(outcome.errors)}`);
  return outcome.result;
}

describe('Фотопечать: построчный расчёт на демо-данных', () => {
  const def = photoEngineDefinition();

  it('дефолт: 10 шт 10×15 → 180 ₽, breakdown с одной строкой', () => {
    const r = expectOk(runCalculation(def, { parameters: {} }, NOW));
    expect(r.price.amountMinor).toBe(18000);
    expect(r.quantity).toBe(10);
    expect(r.lineItems).toHaveLength(1);
    expect(r.lineItems[0]).toMatchObject({ key: '10x15', quantity: 10 });
  });

  it('пример ТЗ: {10x15:100, 20x30:20} — независимые строки с разными ценами', () => {
    const r = expectOk(
      runCalculation(def, { parameters: { formats: { '10x15': 100, '20x30': 20 } } }, NOW),
    );
    // 100 × 18 ₽ + 20 × 70 ₽ = 1800 + 1400 = 3200 ₽.
    expect(r.lineItems.map((l) => `${l.key}=${l.lineTotal.amountMinor}`)).toEqual([
      '10x15=180000',
      '20x30=140000',
    ]);
    expect(r.price.amountMinor).toBe(320000);
    expect(r.quantity).toBe(120);
    // Форматные ключи сохранены в normalized input (не только totalQty).
    expect(r.normalizedParameters.formats).toEqual({ '10x15': 100, '20x30': 20 });
  });

  it('сатин ×1.1 и срочность применяются к сумме строк', () => {
    const base = expectOk(
      runCalculation(def, { parameters: { formats: { '10x15': 100, '20x30': 20 } } }, NOW),
    );
    const satin = expectOk(
      runCalculation(def, { parameters: { formats: { '10x15': 100, '20x30': 20 }, paper: 'satin' } }, NOW),
    );
    expect(satin.price.amountMinor).toBe(Math.round(base.price.amountMinor * 1.1));
    const rush = expectOk(
      runCalculation(def, { parameters: { formats: { '10x15': 100, '20x30': 20 }, urgency: 'express-1h' } }, NOW),
    );
    expect(rush.price.amountMinor).toBe(Math.round(base.price.amountMinor * 1.6));
    expect(rush.production.workingDays).toBe(0);
  });

  it('все 8 форматов имеют цену (полное покрытие demo-прайса)', () => {
    const formats: Record<string, number> = {
      '10x15': 1, '13x18': 1, '15x20': 1, '20x30': 1, '30x40': 1, '30x45': 1, '40x60': 1, custom: 1,
    };
    const r = expectOk(runCalculation(def, { parameters: { formats } }, NOW));
    // 18+28+36+70+120+140+210+110 = 732 ₽
    expect(r.price.amountMinor).toBe(73200);
    expect(r.lineItems).toHaveLength(8);
  });

  it('пустой заказ и превышение totalMax → 422', () => {
    expect(runCalculation(def, { parameters: { formats: {} } }, NOW).ok).toBe(false);
    expect(
      runCalculation(def, { parameters: { formats: { '10x15': 5000, '13x18': 5000, '15x20': 1 } } }, NOW).ok,
    ).toBe(false); // 10 001 > totalMax 10 000
  });

  it('неизвестный формат → 422', () => {
    const outcome = runCalculation(def, { parameters: { formats: { '9x13': 10 } } }, NOW);
    expect(outcome.ok).toBe(false);
  });
});
