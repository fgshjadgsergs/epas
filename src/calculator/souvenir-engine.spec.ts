/**
 * Движковые проверки C5: футболки (MULTI_QTY размеры → тираж = сумма строк,
 * тариф по общему тиражу) и фотокниги (скидка двумя диапазонами от 2/5 шт.).
 */
import { EngineDefinition, runCalculation } from './pricing-engine';

const MONDAY = new Date('2026-07-28T08:00:00+03:00');

/** Футболки (ТЗ 8.1): размеры MULTI_QTY, BASE_TIER по сумме строк. */
function tshirtDef(): EngineDefinition {
  return {
    code: 'tshirt-print', version: 1, pricingMode: 'TIER', urlOrder: ['sizes', 'method', 'qty'],
    minQty: 1, maxQty: 10000, qtyStep: 1, defaultQty: 1, currency: 'RUB', priceListVersion: 1,
    parameters: [
      { urlKey: 'sizes', label: 'Размеры', type: 'MULTI_QTY', isRequired: false, shareable: true, defaultValue: 'M:1',
        multiQty: { maxLines: 7, lineMin: 0, lineMax: 1000, lineStep: 1, totalMin: 1, totalMax: 10000 },
        options: [
          { value: 'S', label: 'S', isDefault: false, isActive: true },
          { value: 'M', label: 'M', isDefault: true, isActive: true },
          { value: 'L', label: 'L', isDefault: false, isActive: true },
        ] },
      { urlKey: 'method', label: 'Метод', type: 'SEGMENTED', isRequired: false, shareable: true, options: [
        { value: 'dtg', label: 'DTG', isDefault: true, isActive: true },
        { value: 'screenprint', label: 'Шелкография', isDefault: false, isActive: true } ] },
    ],
    compatibilityRules: [
      { kind: 'MIN_QTY', when: { method: 'screenprint' }, target: { minQty: 50 }, message: 'Шелкография — от 50 шт.', sortOrder: 0 },
    ],
    priceRules: [
      { id: 'b1', kind: 'BASE_TIER', qtyFrom: 1, qtyTo: 9, amountMinor: 90000, multiplier: null, condition: null, sortOrder: 0 },
      { id: 'b2', kind: 'BASE_TIER', qtyFrom: 10, qtyTo: null, amountMinor: 65000, multiplier: null, condition: null, sortOrder: 1 },
      { id: 'm1', kind: 'MULTIPLIER', when: null, condition: { method: 'screenprint' }, multiplier: 0.9, amountMinor: null, sortOrder: 2 },
    ],
    productionRules: [{ workingDays: 4, cutoff: '18:00', priority: 0 }],
    upsells: [],
  } as unknown as EngineDefinition;
}

/** Фотокниги (ТЗ 3.2): база 2400 ₽/экз., скидка [2..4] −5 %, [5..∞) −10 %. */
function photobookDef(): EngineDefinition {
  return {
    code: 'photobook', version: 1, pricingMode: 'TIER', urlOrder: ['qty'],
    minQty: 1, maxQty: 1000, qtyStep: 1, defaultQty: 1, currency: 'RUB', priceListVersion: 1,
    parameters: [],
    compatibilityRules: [],
    priceRules: [
      { id: 'b1', kind: 'BASE_TIER', qtyFrom: 1, qtyTo: null, amountMinor: 240000, multiplier: null, condition: null, sortOrder: 0 },
      { id: 'd1', kind: 'QTY_DISCOUNT', qtyFrom: 2, qtyTo: 4, multiplier: 0.95, amountMinor: null, condition: null, sortOrder: 1 },
      { id: 'd2', kind: 'QTY_DISCOUNT', qtyFrom: 5, qtyTo: null, multiplier: 0.9, amountMinor: null, condition: null, sortOrder: 2 },
    ],
    productionRules: [{ workingDays: 5, cutoff: '18:00', priority: 0 }],
    upsells: [],
  } as unknown as EngineDefinition;
}

function ok(def: EngineDefinition, params: Record<string, unknown>) {
  const outcome = runCalculation(def, { parameters: params }, MONDAY);
  if (!outcome.ok) throw new Error(`ожидался успех: ${JSON.stringify(outcome.errors)}`);
  return outcome.result;
}

describe('C5 футболки: MULTI_QTY размеры → тираж = сумма строк (ТЗ 8.1)', () => {
  it('тираж = сумма строк; тариф по общему тиражу', () => {
    // S:3 + M:5 + L:4 = 12 → порог 10+ (650 ₽) → 12×650 = 7800 ₽.
    const r = ok(tshirtDef(), { sizes: { S: 3, M: 5, L: 4 }, method: 'dtg' });
    expect(r.quantity).toBe(12);
    expect(r.price.amountMinor).toBe(12 * 65000);
  });

  it('распределение размеров сохраняется в нормализованных параметрах', () => {
    const r = ok(tshirtDef(), { sizes: { S: 2, L: 1 }, method: 'dtg' });
    expect(r.quantity).toBe(3);
    expect(r.normalizedParameters.sizes).toEqual({ S: 2, L: 1 });
  });

  it('нулевые линии не мешают; одна линия — валидна', () => {
    const r = ok(tshirtDef(), { sizes: { M: 4, S: 0 }, method: 'dtg' });
    expect(r.quantity).toBe(4);
  });

  it('шелкография ниже 50 шт → 422 (MIN_QTY), а при 60 — со скидкой метода', () => {
    const low = runCalculation(tshirtDef(), { parameters: { sizes: { M: 10 }, method: 'screenprint' } }, MONDAY);
    expect(low.ok).toBe(false);
    const good = ok(tshirtDef(), { sizes: { M: 60 }, method: 'screenprint' });
    // 60 → тариф 650 ₽ × 0.9 (шелкография) × 60.
    expect(good.price.amountMinor).toBe(Math.round(60 * 65000 * 0.9));
  });
});

describe('C5 фотокниги: скидка двумя диапазонами (ТЗ 3.2)', () => {
  it('1 экз — без скидки', () => {
    expect(ok(photobookDef(), { qty: 1 }).price.amountMinor).toBe(240000);
  });
  it('2–4 экз — −5 %', () => {
    expect(ok(photobookDef(), { qty: 3 }).price.amountMinor).toBe(Math.round(3 * 240000 * 0.95));
  });
  it('от 5 экз — −10 %', () => {
    expect(ok(photobookDef(), { qty: 6 }).price.amountMinor).toBe(Math.round(6 * 240000 * 0.9));
  });
});
