/**
 * Производный тираж qty = произведение целочисленных параметров
 * (config.quantityFrom) — ТЗ 2.2 «итого листов = оригиналы × копии». Тираж
 * считает сервер, а не frontend. Границы страниц/тиража — на бэкенде.
 */
import { EngineDefinition, PUBLIC_CUSTOMER_CONTEXT, runCalculation } from './pricing-engine';

const MONDAY = new Date('2026-07-27T08:00:00+03:00');

/** Копирование (ТЗ 2.2): база 5 ₽/лист, qty = originals × copies. */
function copyDefinition(overrides: Partial<EngineDefinition> = {}): EngineDefinition {
  return {
    code: 'document-copy',
    version: 1,
    pricingMode: 'TIER',
    urlOrder: ['originals', 'copies'],
    minQty: 1,
    maxQty: 50000,
    qtyStep: 1,
    defaultQty: 5,
    currency: 'RUB',
    priceListVersion: 1,
    quantityFrom: { product: ['originals', 'copies'] },
    parameters: [
      { urlKey: 'originals', label: 'Оригиналов', type: 'DIMENSION', isRequired: false, shareable: true, options: [], minValue: 1, maxValue: 100, stepValue: 1, defaultValue: '1' },
      { urlKey: 'copies', label: 'Копий', type: 'DIMENSION', isRequired: false, shareable: true, options: [], minValue: 1, maxValue: 1000, stepValue: 1, defaultValue: '5' },
    ],
    compatibilityRules: [],
    priceRules: [
      { id: 't1', kind: 'BASE_TIER', qtyFrom: 1, qtyTo: 9, amountMinor: 800, multiplier: null, condition: null, sortOrder: 0 },
      { id: 't2', kind: 'BASE_TIER', qtyFrom: 10, qtyTo: 49, amountMinor: 600, multiplier: null, condition: null, sortOrder: 1 },
      { id: 't3', kind: 'BASE_TIER', qtyFrom: 50, qtyTo: null, amountMinor: 400, multiplier: null, condition: null, sortOrder: 2 },
    ],
    productionRules: [{ workingDays: 1, cutoff: '18:00', priority: 0 }],
    upsells: [],
    ...overrides,
  } as EngineDefinition;
}

function ok(def: EngineDefinition, params: Record<string, unknown>) {
  const outcome = runCalculation(def, { parameters: params }, MONDAY, new Set(), PUBLIC_CUSTOMER_CONTEXT);
  if (!outcome.ok) throw new Error(`ожидался успех: ${JSON.stringify(outcome.errors)}`);
  return outcome.result;
}

describe('config.quantityFrom — производный тираж (ТЗ 2.2)', () => {
  it('qty = оригиналы × копии; тариф выбирается по произведению', () => {
    // 3 × 10 = 30 листов → порог 10–49 (6 ₽/лист) → 180 ₽.
    const r = ok(copyDefinition(), { originals: 3, copies: 10 });
    expect(r.quantity).toBe(30);
    expect(r.price.amountMinor).toBe(30 * 600);
  });

  it('одинаковое произведение из разных множителей даёт один тираж и тариф', () => {
    const a = ok(copyDefinition(), { originals: 1, copies: 100 }); // 100
    const b = ok(copyDefinition(), { originals: 10, copies: 10 }); // 100
    const c = ok(copyDefinition(), { originals: 2, copies: 50 }); //  100
    expect([a.quantity, b.quantity, c.quantity]).toEqual([100, 100, 100]);
    // Все попадают в открытый порог 50+ (4 ₽/лист).
    expect([a.price.amountMinor, b.price.amountMinor, c.price.amountMinor]).toEqual([40000, 40000, 40000]);
  });

  it('минимальный случай 1 × 1 = 1 лист (порог 1–9)', () => {
    const r = ok(copyDefinition(), { originals: 1, copies: 1 });
    expect(r.quantity).toBe(1);
    expect(r.price.amountMinor).toBe(800);
  });

  it('множитель ниже минимума (0) → ошибка границ параметра, а не тираж', () => {
    const zero = runCalculation(copyDefinition(), { parameters: { originals: 0, copies: 10 } }, MONDAY);
    expect(zero.ok).toBe(false);
    if (!zero.ok) expect(zero.errors.some((e) => e.param === 'originals')).toBe(true);
  });

  it('нецелый множитель выравнивается по шагу DIMENSION (2.5 → 3), затем множится', () => {
    // 2.5 → шаг 1 → 3; 3 × 10 = 30 листов, порог 10–49.
    const r = ok(copyDefinition(), { originals: 2.5, copies: 10 });
    expect(r.quantity).toBe(30);
  });

  it('произведение сверх maxQty → ошибка тиража', () => {
    // 100 × 1000 = 100 000 > maxQty 50 000.
    const outcome = runCalculation(copyDefinition(), { parameters: { originals: 100, copies: 1000 } }, MONDAY);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.errors.some((e) => e.param === 'qty')).toBe(true);
  });

  it('нормализованные параметры сохраняют оригиналы и копии (воспроизводимость заказа)', () => {
    const r = ok(copyDefinition(), { originals: 4, copies: 7 });
    expect(r.quantity).toBe(28);
    expect(r.normalizedParameters.originals).toBe(4);
    expect(r.normalizedParameters.copies).toBe(7);
  });
});
