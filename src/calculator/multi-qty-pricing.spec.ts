import { CalculationOutcome, EngineConfigError, EngineDefinition, runCalculation } from './pricing-engine';

/**
 * Построчная тарификация MULTI_QTY (BASE_PER_MULTI_QTY_LINE) на
 * синтетическом определении: две строки A/B с разными ценами, тиражные
 * диапазоны ВНУТРИ строки, общие ограничения и fail-closed сценарии.
 */
function makeDefinition(overrides: Partial<EngineDefinition> = {}): EngineDefinition {
  return {
    code: 'multi-demo',
    version: 1,
    pricingMode: 'TIER',
    urlOrder: ['items', 'qty'],
    minQty: 1,
    maxQty: 100000,
    qtyStep: 1,
    defaultQty: 1,
    currency: 'RUB',
    priceListVersion: 1,
    parameters: [
      {
        urlKey: 'items',
        label: 'Позиции',
        type: 'MULTI_QTY',
        isRequired: true,
        shareable: true,
        defaultValue: 'a:1',
        multiQty: {
          maxLines: 3,
          lineMin: 0,
          lineMax: 1000,
          lineStep: 1,
          totalMin: 1,
          totalMax: 1500,
          lineOverrides: { b: { min: 5, step: 5, max: 500 } },
        },
        options: [
          { value: 'a', label: 'Строка A', isDefault: true, isActive: true },
          { value: 'b', label: 'Строка B', isDefault: false, isActive: true },
          { value: 'old', label: 'Архивная', isDefault: false, isActive: false },
        ],
      },
      {
        urlKey: 'color',
        label: 'Цвет',
        type: 'SEGMENTED',
        isRequired: true,
        shareable: true,
        options: [
          { value: 'plain', label: 'Обычный', isDefault: true, isActive: true },
          { value: 'premium', label: 'Премиум', isDefault: false, isActive: true },
        ],
      },
    ],
    compatibilityRules: [],
    priceRules: [
      // Строка A: свои тиражные диапазоны по количеству ЭТОЙ строки.
      { id: 'a1', kind: 'BASE_PER_MULTI_QTY_LINE', qtyFrom: 1, qtyTo: 99, amountMinor: 1000, config: { sourceParameter: 'items', lineKey: 'a' }, sortOrder: 0 },
      { id: 'a2', kind: 'BASE_PER_MULTI_QTY_LINE', qtyFrom: 100, qtyTo: null, amountMinor: 800, config: { sourceParameter: 'items', lineKey: 'a' }, sortOrder: 1 },
      // Строка B: одна цена + условная цена для premium.
      { id: 'b1', kind: 'BASE_PER_MULTI_QTY_LINE', qtyFrom: 1, qtyTo: null, amountMinor: 5000, config: { sourceParameter: 'items', lineKey: 'b' }, sortOrder: 2 },
      { id: 'b2', kind: 'BASE_PER_MULTI_QTY_LINE', condition: { color: 'premium' }, qtyFrom: 1, qtyTo: null, amountMinor: 7000, config: { sourceParameter: 'items', lineKey: 'b' }, sortOrder: 3 },
      // Скидка от ОБЩЕГО количества — отдельная семантика (QTY_DISCOUNT).
      { id: 'd1', kind: 'QTY_DISCOUNT', qtyFrom: 1000, qtyTo: null, multiplier: 0.9, sortOrder: 10 },
    ],
    productionRules: [{ id: 'p1', condition: null, workingDays: 1, cutoff: '14:00', priority: 0 }],
    upsells: [],
    ...overrides,
  };
}

const NOW = new Date('2026-07-20T06:00:00Z');

function expectOk(outcome: CalculationOutcome) {
  if (!outcome.ok) throw new Error(`Ожидался успех: ${JSON.stringify(outcome.errors)}`);
  return outcome.result;
}

describe('BASE_PER_MULTI_QTY_LINE: построчная база', () => {
  const def = makeDefinition();

  it('одна строка: количество × цена строки, breakdown сохраняет ключ', () => {
    const r = expectOk(runCalculation(def, { parameters: { items: { a: 10 } } }, NOW));
    expect(r.price.amountMinor).toBe(10000);
    expect(r.quantity).toBe(10);
    expect(r.lineItems).toEqual([
      {
        key: 'a',
        label: 'Строка A',
        quantity: 10,
        unitPrice: { amountMinor: 1000, currency: 'RUB' },
        lineTotal: { amountMinor: 10000, currency: 'RUB' },
      },
    ]);
  });

  it('несколько строк с разными ценами: base = сумма lineTotal', () => {
    const r = expectOk(runCalculation(def, { parameters: { items: { b: 20, a: 100 } } }, NOW));
    // a: 100 шт → диапазон 100+ → 8.00; b: 20 шт → 50.00.
    expect(r.lineItems.map((l) => `${l.key}:${l.lineTotal.amountMinor}`)).toEqual(['a:80000', 'b:100000']);
    expect(r.price.amountMinor).toBe(180000);
    expect(r.quantity).toBe(120);
    // Порядок строк стабильный — по options definition, не по входному объекту.
    expect(Object.keys(r.normalizedParameters.items as Record<string, number>)).toEqual(['a', 'b']);
  });

  it('диапазон выбирается по количеству СТРОКИ, а не всего заказа', () => {
    // a=50 (< 100) при общем 550: строка A остаётся в диапазоне 1–99 → 10.00.
    const r = expectOk(runCalculation(def, { parameters: { items: { a: 50, b: 500 } } }, NOW));
    expect(r.lineItems.find((l) => l.key === 'a')?.unitPrice.amountMinor).toBe(1000);
  });

  it('условная цена строки: premium перекрывает базовую (специфичность)', () => {
    const r = expectOk(
      runCalculation(def, { parameters: { items: { b: 10 }, color: 'premium' } }, NOW),
    );
    expect(r.lineItems[0].unitPrice.amountMinor).toBe(7000);
  });

  it('скидка от общего количества применяется поверх суммы строк', () => {
    const r = expectOk(runCalculation(def, { parameters: { items: { a: 600, b: 400 } } }, NOW));
    // a 600×8.00=4800.00; b 400×50.00=20000.00; итого 24800 × 0.9 = 22320.00
    expect(r.price.amountMinor).toBe(2232000);
  });

  it('границы строки: lineOverrides (min 5, шаг 5, max 500 для B)', () => {
    expect(runCalculation(def, { parameters: { items: { b: 3 } } }, NOW).ok).toBe(false); // < min 5
    expect(runCalculation(def, { parameters: { items: { b: 7 } } }, NOW).ok).toBe(false); // не кратно 5
    expect(runCalculation(def, { parameters: { items: { b: 505 } } }, NOW).ok).toBe(false); // > max 500
    expect(runCalculation(def, { parameters: { items: { b: 500 } } }, NOW).ok).toBe(true);
  });

  it('totalMin/totalMax и maxLines', () => {
    const empty = runCalculation(def, { parameters: { items: {} } }, NOW);
    expect(empty.ok).toBe(false); // totalMin 1 → «добавьте хотя бы одну позицию»
    const over = runCalculation(def, { parameters: { items: { a: 1000, b: 505 } } }, NOW);
    expect(over.ok).toBe(false); // b > lineMax, и сумма > totalMax
    const tooMany = runCalculation(
      def,
      { parameters: { items: { a: 1, b: 5, old: 1, x: 1 } } },
      NOW,
    );
    expect(tooMany.ok).toBe(false); // 4 строки > maxLines 3
  });

  it('неизвестная и неактивная строки → 422; отрицательные и дробные — тоже', () => {
    for (const items of [{ nope: 5 }, { old: 5 }, { a: -1 }, { a: 1.5 }]) {
      const outcome = runCalculation(def, { parameters: { items } }, NOW);
      expect(outcome.ok).toBe(false);
    }
  });

  it('нулевая строка удаляется при нормализации и не попадает в breakdown', () => {
    const r = expectOk(runCalculation(def, { parameters: { items: { a: 10, b: 0 } } }, NOW));
    expect(r.lineItems.map((l) => l.key)).toEqual(['a']);
    expect((r.normalizedParameters.items as Record<string, number>).b).toBeUndefined();
  });

  it('fail-closed: ненулевая строка без ценового покрытия не игнорируется', () => {
    const noB = makeDefinition();
    noB.priceRules = noB.priceRules.filter((r) => !r.id?.startsWith('b'));
    expect(() => runCalculation(noB, { parameters: { items: { a: 1, b: 10 } } }, NOW)).toThrow(
      EngineConfigError,
    );
  });

  it('fail-closed: неоднозначные правила строки (одинаковые qtyFrom/специфичность)', () => {
    const dup = makeDefinition();
    dup.priceRules = [
      ...dup.priceRules,
      { id: 'a3', kind: 'BASE_PER_MULTI_QTY_LINE', qtyFrom: 1, qtyTo: 99, amountMinor: 900, config: { sourceParameter: 'items', lineKey: 'a' }, sortOrder: 9 },
    ];
    expect(() => runCalculation(dup, { parameters: { items: { a: 10 } } }, NOW)).toThrow(EngineConfigError);
  });

  it('fail-closed: смешение построчной базы с BASE_TIER', () => {
    const mixed = makeDefinition();
    mixed.priceRules = [
      ...mixed.priceRules,
      { id: 't1', kind: 'BASE_TIER', qtyFrom: 1, qtyTo: null, amountMinor: 100, sortOrder: 99 },
    ];
    expect(() => runCalculation(mixed, { parameters: { items: { a: 1 } } }, NOW)).toThrow(EngineConfigError);
  });

  it('fail-closed: переполнение safe integer', () => {
    const big = makeDefinition();
    big.parameters[0].multiQty = { maxLines: 3, lineMin: 0, lineMax: 1_000_000_000_000, lineStep: 1 };
    big.maxQty = Number.MAX_SAFE_INTEGER;
    big.priceRules = [
      { id: 'a1', kind: 'BASE_PER_MULTI_QTY_LINE', qtyFrom: 1, qtyTo: null, amountMinor: 10_000_000, config: { sourceParameter: 'items', lineKey: 'a' }, sortOrder: 0 },
    ];
    expect(() => runCalculation(big, { parameters: { items: { a: 1_000_000_000_000 } } }, NOW)).toThrow(
      EngineConfigError,
    );
  });
});
