import {
  CalculationOutcome,
  EngineConfigError,
  EngineDefinition,
  PUBLIC_CUSTOMER_CONTEXT,
  computeReadyDate,
  runCalculation,
  validateInputShape,
} from './pricing-engine';

/** Фикстура по мотивам визиток (ТЗ «Калькуляторы цен», п.1.1). Цены — тестовые. */
function makeDefinition(overrides: Partial<EngineDefinition> = {}): EngineDefinition {
  return {
    code: 'business-cards',
    version: 3,
    pricingMode: 'TIER',
    urlOrder: ['subtype', 'format', 'paper', 'coating', 'sides', 'qty', 'express'],
    minQty: 50,
    maxQty: 10000,
    qtyStep: 50,
    defaultQty: 100,
    currency: 'RUB',
    priceListVersion: 7,
    parameters: [
      {
        urlKey: 'subtype',
        label: 'Тип',
        type: 'SEGMENTED',
        isRequired: true,
        shareable: true,
        options: [
          { value: 'standard', label: 'Стандартные', isDefault: true, isActive: true },
          { value: 'plastic', label: 'Пластиковые', isDefault: false, isActive: true },
        ],
      },
      {
        urlKey: 'coating',
        label: 'Покрытие',
        type: 'SWATCH',
        isRequired: true,
        shareable: true,
        options: [
          { value: 'none', label: 'Без покрытия', isDefault: true, isActive: true },
          { value: 'soft-touch', label: 'Soft Touch', isDefault: false, isActive: true },
        ],
      },
      {
        urlKey: 'sides',
        label: 'Стороны',
        type: 'SEGMENTED',
        isRequired: true,
        shareable: true,
        options: [
          { value: 'single', label: '1 сторона', isDefault: false, isActive: true },
          { value: 'double', label: '2 стороны', isDefault: true, isActive: true },
        ],
      },
      {
        urlKey: 'express',
        label: 'Срочно',
        type: 'TOGGLE',
        isRequired: false,
        shareable: true,
        defaultValue: '0',
        options: [],
      },
    ],
    compatibilityRules: [
      {
        id: 'c1',
        kind: 'DISABLE_OPTIONS',
        when: { subtype: 'plastic' },
        target: { param: 'coating', options: ['soft-touch'] },
        message: 'Soft Touch недоступен для пластиковых визиток',
        sortOrder: 0,
      },
      {
        id: 'c2',
        kind: 'SET_BOUNDS',
        when: { subtype: 'plastic' },
        target: { param: 'qty', min: 100, step: 100 },
        message: 'Минимальный тираж для пластиковых визиток — 100 шт., шаг 100',
        sortOrder: 1,
      },
      {
        id: 'c3',
        kind: 'MAX_QTY',
        when: { express: '1' },
        target: { maxQty: 1000 },
        message: 'Срочное изготовление — только для тиража до 1 000 шт.',
        sortOrder: 2,
      },
    ],
    priceRules: [
      { id: 't1', kind: 'BASE_TIER', qtyFrom: 50, qtyTo: 199, amountMinor: 1200, sortOrder: 0 },
      { id: 't2', kind: 'BASE_TIER', qtyFrom: 200, qtyTo: 499, amountMinor: 900, sortOrder: 1 },
      { id: 't3', kind: 'BASE_TIER', qtyFrom: 500, qtyTo: null, amountMinor: 600, sortOrder: 2 },
      { id: 't4', kind: 'BASE_TIER', condition: { subtype: 'plastic' }, qtyFrom: 100, qtyTo: null, amountMinor: 3000, sortOrder: 3 },
      { id: 'm1', kind: 'MULTIPLIER', condition: { sides: 'double' }, multiplier: 1.35, sortOrder: 4 },
      { id: 'm2', kind: 'MULTIPLIER', condition: { coating: 'soft-touch' }, multiplier: 1.2, sortOrder: 5 },
      { id: 'm3', kind: 'MULTIPLIER', condition: { express: '1' }, multiplier: 1.5, sortOrder: 6 },
      { id: 'min1', kind: 'MIN_TOTAL', amountMinor: 90000, sortOrder: 7 },
    ],
    productionRules: [
      { id: 'p1', condition: null, workingDays: 2, cutoff: '14:00', priority: 0 },
      { id: 'p2', condition: { express: '1' }, workingDays: 0, cutoff: '12:00', priority: 10 },
    ],
    upsells: [
      { code: 'design', label: 'Разработка дизайна', pricing: 'FLAT', amountMinor: 50000, isActive: true },
      { code: 'rounded-corners', label: 'Скруглённые углы', pricing: 'MULTIPLIER', multiplier: 1.1, isActive: true },
    ],
    ...overrides,
  };
}

const MONDAY_MORNING = new Date('2026-07-20T06:00:00Z'); // 09:00 МСК, до отсечки

function expectOk(outcome: CalculationOutcome) {
  if (!outcome.ok) throw new Error(`Ожидался успех, получены ошибки: ${JSON.stringify(outcome.errors)}`);
  return outcome.result;
}

describe('runCalculation', () => {
  it('подставляет дефолты для отсутствующих параметров', () => {
    const r = expectOk(runCalculation(makeDefinition(), { parameters: {} }, MONDAY_MORNING));
    expect(r.normalizedParameters).toMatchObject({
      subtype: 'standard',
      coating: 'none',
      sides: 'double',
      express: '0',
    });
    expect(r.quantity).toBe(100);
    expect(r.price.amountMinor).toBe(162000); // 100 × 12.00 × 1.35
  });

  it('отклоняет неизвестный параметр', () => {
    const outcome = runCalculation(makeDefinition(), { parameters: { lamm: 'x' } }, MONDAY_MORNING);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.errors[0].param).toBe('lamm');
  });

  it('отклоняет неверный тип тиража', () => {
    const outcome = runCalculation(makeDefinition(), { parameters: { qty: 'abc' } }, MONDAY_MORNING);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.errors.some((e) => e.param === 'qty')).toBe(true);
  });

  it('отклоняет неизвестную option', () => {
    const outcome = runCalculation(makeDefinition(), { parameters: { coating: 'velvet' } }, MONDAY_MORNING);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.errors[0]).toMatchObject({ param: 'coating' });
  });

  it('отклоняет несовместимую комбинацию с текстом из правила', () => {
    const outcome = runCalculation(
      makeDefinition(),
      { parameters: { subtype: 'plastic', coating: 'soft-touch', qty: 100 } },
      MONDAY_MORNING,
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.errors[0].message).toBe('Soft Touch недоступен для пластиковых визиток');
  });

  it('conditional bounds (SET_BOUNDS): пластик поднимает min и шаг тиража', () => {
    const outcome = runCalculation(makeDefinition(), { parameters: { subtype: 'plastic', qty: 50 } }, MONDAY_MORNING);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.errors[0].message).toBe('Минимальный тираж — 100 шт.');
    }
  });

  it('conditional bounds: шаг 100 применяется вместо базового шага 50', () => {
    const r = expectOk(
      runCalculation(makeDefinition(), { parameters: { subtype: 'plastic', qty: 150 } }, MONDAY_MORNING),
    );
    expect(r.quantity).toBe(200); // выровнено вверх до шага 100
    expect(r.warnings.some((w) => w.includes('шага 100'))).toBe(true);
  });

  it('ограничивает экспресс по максимальному тиражу', () => {
    const outcome = runCalculation(makeDefinition(), { parameters: { express: '1', qty: 2000 } }, MONDAY_MORNING);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.errors[0].param).toBe('express');
  });

  it('выбирает пороговую цену по диапазону тиража и условную сетку', () => {
    const std = expectOk(runCalculation(makeDefinition(), { parameters: { sides: 'single', qty: 500 } }, MONDAY_MORNING));
    expect(std.price.amountMinor).toBe(300000); // 500 × 6.00
    const plastic = expectOk(
      runCalculation(makeDefinition(), { parameters: { subtype: 'plastic', sides: 'single', qty: 100 } }, MONDAY_MORNING),
    );
    expect(plastic.price.amountMinor).toBe(300000); // своя сетка 30.00 × 100
  });

  it('применяет минимальную стоимость заказа', () => {
    const r = expectOk(runCalculation(makeDefinition(), { parameters: { sides: 'single', qty: 50 } }, MONDAY_MORNING));
    expect(r.price.amountMinor).toBe(90000); // 50×12=600 < MIN_TOTAL 900
    expect(r.warnings.some((w) => w.includes('минимальная стоимость'))).toBe(true);
  });

  it('округляет деньги до копейки на каждом множителе (без хвостов float)', () => {
    const r = expectOk(runCalculation(makeDefinition(), { parameters: { coating: 'soft-touch', qty: 150 } }, MONDAY_MORNING));
    expect(r.price.amountMinor).toBe(291600); // 150×12=1800 → ×1.35=2430 → ×1.2=2916
    expect(Number.isInteger(r.price.amountMinor)).toBe(true);
  });

  it('приоритет базового правила: более специфичное условие (плата за пластик), не порядок в массиве', () => {
    const r = expectOk(runCalculation(makeDefinition(), { parameters: { subtype: 'plastic', qty: 500 } }, MONDAY_MORNING));
    // t4 (condition subtype=plastic) специфичнее t3 (без условия) — должен выиграть t4.
    expect(r.price.amountMinor).not.toBe(500 * 600 * 1.35);
  });

  it('НДС — информационное поле, приходит из CustomerContext сервера, а не из запроса', () => {
    const r = expectOk(runCalculation(makeDefinition(), { parameters: {} }, MONDAY_MORNING, new Set(), PUBLIC_CUSTOMER_CONTEXT));
    expect(r.priceWithVat.amountMinor).toBe(Math.round(r.price.amountMinor * 1.2));
  });

  it('произвольный b2b в parameters отклоняется как неизвестный параметр (нет коммерческого преимущества)', () => {
    const outcome = runCalculation(makeDefinition(), { parameters: { b2b: true, qty: 100 } }, MONDAY_MORNING);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.errors.some((e) => e.param === 'b2b')).toBe(true);
  });

  it('считает срок производства: стандарт 2 рабочих дня от утра понедельника', () => {
    const r = expectOk(runCalculation(makeDefinition(), { parameters: {} }, MONDAY_MORNING));
    expect(r.production.workingDays).toBe(2);
    expect(r.production.readyAt).toBe('2026-07-22');
    expect(r.production.cutoff).toBe('14:00');
  });

  it('экспресс: правило с большим priority, готовность сегодня', () => {
    const r = expectOk(runCalculation(makeDefinition(), { parameters: { express: '1', qty: 100 } }, MONDAY_MORNING));
    expect(r.production.workingDays).toBe(0);
    expect(r.production.readyAt).toBe('2026-07-20');
    expect(r.production.readyDateLabel).toBe('сегодня до 18:00');
  });

  it('учитывает отсечку: после 14:00 старт сдвигается на день', () => {
    const mondayEvening = new Date('2026-07-20T12:30:00Z'); // 15:30 МСК
    const r = expectOk(runCalculation(makeDefinition(), { parameters: {} }, mondayEvening));
    expect(r.production.readyAt).toBe('2026-07-23');
  });

  it('пропускает праздники при расчёте даты готовности', () => {
    const holidays = new Set(['2026-07-21']);
    const { readyAt } = computeReadyDate(MONDAY_MORNING, 2, '14:00', holidays);
    expect(readyAt).toBe('2026-07-23');
  });

  it('неоднозначный priority правил срока — конфигурационная ошибка (fail-closed), не молчаливый выбор', () => {
    const def = makeDefinition({
      productionRules: [
        { id: 'p1', condition: null, workingDays: 2, cutoff: '14:00', priority: 5 },
        { id: 'p2', condition: null, workingDays: 1, cutoff: '14:00', priority: 5 },
      ],
    });
    expect(() => runCalculation(def, { parameters: {} }, MONDAY_MORNING)).toThrow(EngineConfigError);
  });

  it('неоднозначные базовые правила тиража — конфигурационная ошибка', () => {
    const def = makeDefinition({
      priceRules: [
        { id: 'a', kind: 'BASE_TIER', qtyFrom: 50, qtyTo: null, amountMinor: 1000, sortOrder: 0 },
        { id: 'b', kind: 'BASE_TIER', qtyFrom: 50, qtyTo: null, amountMinor: 2000, sortOrder: 1 },
      ],
    });
    expect(() => runCalculation(def, { parameters: { qty: 100 } }, MONDAY_MORNING)).toThrow(EngineConfigError);
  });

  it('диапазоны тиража не покрывают запрошенный qty — конфигурационная ошибка', () => {
    const def = makeDefinition({
      priceRules: [{ id: 'a', kind: 'BASE_TIER', qtyFrom: 50, qtyTo: 99, amountMinor: 1000, sortOrder: 0 }],
    });
    expect(() => runCalculation(def, { parameters: { qty: 500 } }, MONDAY_MORNING)).toThrow(EngineConfigError);
  });

  it('включает версии определения, прайса и движка в результат', () => {
    const r = expectOk(runCalculation(makeDefinition(), { parameters: {} }, MONDAY_MORNING));
    expect(r.calculationVersion).toBe('business-cards:v3:p7');
    expect(r.engineVersion).toMatch(/^engine\//);
  });

  it('appliedRules содержит ID применённых правил (аудит для snapshot)', () => {
    const r = expectOk(runCalculation(makeDefinition(), { parameters: { qty: 100 } }, MONDAY_MORNING));
    expect(r.appliedRules.some((a) => a.ruleId === 't1')).toBe(true);
    expect(r.appliedRules.some((a) => a.ruleId === 'm1')).toBe(true);
  });

  it('детерминированность: одинаковый вход даёт побайтово одинаковый результат', () => {
    const def = makeDefinition();
    const input = { parameters: { coating: 'soft-touch', qty: 250, express: '0' }, upsells: ['design', 'rounded-corners'] };
    const a = runCalculation(def, input, MONDAY_MORNING);
    const b = runCalculation(def, input, MONDAY_MORNING);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('upsells: множитель до фикс-надбавок, неизвестный код — ошибка', () => {
    const r = expectOk(
      runCalculation(makeDefinition(), { parameters: { sides: 'single', qty: 100 }, upsells: ['rounded-corners', 'design'] }, MONDAY_MORNING),
    );
    expect(r.price.amountMinor).toBe(182000); // 1200 → ×1.1=1320 → +500=1820
    expect(r.appliedUpsells).toHaveLength(2);

    const bad = runCalculation(makeDefinition(), { parameters: {}, upsells: ['unknown-upsell'] }, MONDAY_MORNING);
    expect(bad.ok).toBe(false);
  });

  it('без активного прайса (нет BASE_TIER) — конфигурационная ошибка', () => {
    expect(() => runCalculation(makeDefinition({ priceRules: [] }), { parameters: {} }, MONDAY_MORNING)).toThrow(
      EngineConfigError,
    );
  });
});

describe('validateInputShape (блок 12)', () => {
  it('принимает plain object с простыми значениями', () => {
    expect(validateInputShape({ format: '90x50', qty: 100, express: true })).toEqual([]);
  });

  it('отклоняет не-объект', () => {
    expect(validateInputShape('x')).not.toEqual([]);
    expect(validateInputShape(null)).not.toEqual([]);
    expect(validateInputShape([1, 2])).not.toEqual([]);
  });

  it('отклоняет __proto__/prototype/constructor как ключи', () => {
    const raw = JSON.parse('{"__proto__": {"polluted": true}, "qty": 1}');
    const issues = validateInputShape(raw);
    expect(issues.some((i) => i.param === '__proto__')).toBe(true);
  });

  it('отклоняет слишком много ключей', () => {
    const many: Record<string, number> = {};
    for (let i = 0; i < 60; i++) many[`k${i}`] = 1;
    expect(validateInputShape(many).length).toBeGreaterThan(0);
  });

  it('отклоняет слишком длинную строку', () => {
    expect(validateInputShape({ format: 'x'.repeat(500) }).length).toBeGreaterThan(0);
  });

  it('допускает plain object с числовыми значениями (multi-quantity строки)', () => {
    expect(validateInputShape({ sizes: { s: 2, m: 5 } })).toEqual([]);
  });

  it('отклоняет вложенный объект с нечисловыми значениями', () => {
    expect(validateInputShape({ sizes: { s: 'two' } }).length).toBeGreaterThan(0);
  });
});

describe('multi-quantity (блок 7)', () => {
  function multiDefinition(): EngineDefinition {
    return makeDefinition({
      pricingMode: 'TIER',
      minQty: 1,
      maxQty: 100000,
      parameters: [
        {
          urlKey: 'sizes',
          label: 'Размеры',
          type: 'MULTI_QTY',
          isRequired: true,
          shareable: false,
          multiQty: { maxLines: 5, lineMin: 0, lineMax: 1000, lineStep: 1, totalMin: 1, totalMax: 500 },
          options: [
            { value: 's', label: 'S', isDefault: false, isActive: true },
            { value: 'm', label: 'M', isDefault: false, isActive: true },
            { value: 'l', label: 'L', isDefault: false, isActive: true },
          ],
        },
      ],
      compatibilityRules: [],
      priceRules: [{ id: 't1', kind: 'BASE_TIER', qtyFrom: 1, qtyTo: null, amountMinor: 50000, sortOrder: 0 }],
    });
  }

  it('суммирует строки количества в итоговый тираж', () => {
    const r = expectOk(runCalculation(multiDefinition(), { parameters: { sizes: { s: 2, m: 3 } } }, MONDAY_MORNING));
    expect(r.quantity).toBe(5);
    expect(r.price.amountMinor).toBe(250000);
  });

  it('отклоняет строку с недопустимым ключом', () => {
    const outcome = runCalculation(multiDefinition(), { parameters: { sizes: { xl: 1 } } }, MONDAY_MORNING);
    expect(outcome.ok).toBe(false);
  });

  it('отклоняет превышение maxLines', () => {
    const outcome = runCalculation(
      multiDefinition(),
      { parameters: { sizes: { s: 1, m: 1, l: 1, extra1: 1, extra2: 1, extra3: 1 } } },
      MONDAY_MORNING,
    );
    expect(outcome.ok).toBe(false);
  });

  it('отклоняет итог ниже totalMin', () => {
    const outcome = runCalculation(multiDefinition(), { parameters: { sizes: {} } }, MONDAY_MORNING);
    expect(outcome.ok).toBe(false);
  });

  it('отклоняет итог выше totalMax', () => {
    const outcome = runCalculation(multiDefinition(), { parameters: { sizes: { s: 600 } } }, MONDAY_MORNING);
    expect(outcome.ok).toBe(false);
  });
});

describe('area-based pricing (блок 7)', () => {
  function areaDefinition(unit: 'mm' | 'cm' | 'm', extra: Partial<EngineDefinition> = {}): EngineDefinition {
    return makeDefinition({
      pricingMode: 'AREA',
      area: { unit, minBillableSqm: 0.5 },
      parameters: [
        { urlKey: 'w', label: 'Ширина', type: 'DIMENSION', isRequired: true, shareable: true, minValue: 0.1, options: [] },
        { urlKey: 'h', label: 'Высота', type: 'DIMENSION', isRequired: true, shareable: true, minValue: 0.1, options: [] },
      ],
      compatibilityRules: [],
      priceRules: [{ id: 'sqm', kind: 'BASE_PER_SQM', amountMinor: 100000, sortOrder: 0 }],
      minQty: 1,
      maxQty: 100,
      qtyStep: 1,
      defaultQty: 1,
      ...extra,
    });
  }

  it('считает площадь в метрах: 2×1 м = 2 м²', () => {
    const r = expectOk(runCalculation(areaDefinition('m'), { parameters: { w: 2, h: 1, qty: 1 } }, MONDAY_MORNING));
    expect(r.price.amountMinor).toBe(200000); // 2 м² × 1000.00 ₽
  });

  it('считает площадь в сантиметрах: 200×100 см = 2 м²', () => {
    const r = expectOk(runCalculation(areaDefinition('cm'), { parameters: { w: 200, h: 100, qty: 1 } }, MONDAY_MORNING));
    expect(r.price.amountMinor).toBe(200000);
  });

  it('считает площадь в миллиметрах: 2000×1000 мм = 2 м²', () => {
    const r = expectOk(runCalculation(areaDefinition('mm'), { parameters: { w: 2000, h: 1000, qty: 1 } }, MONDAY_MORNING));
    expect(r.price.amountMinor).toBe(200000);
  });

  it('применяет минимальную оплачиваемую площадь', () => {
    const r = expectOk(runCalculation(areaDefinition('m'), { parameters: { w: 0.5, h: 0.5, qty: 1 } }, MONDAY_MORNING));
    // 0.25 м² < minBillableSqm 0.5 → оплачивается 0.5 м².
    expect(r.price.amountMinor).toBe(50000);
    expect(r.warnings.some((w) => w.includes('оплачиваемая площадь'))).toBe(true);
  });

  it('отклоняет площадь больше maxSqm', () => {
    const outcome = runCalculation(
      areaDefinition('m', { area: { unit: 'm', maxSqm: 10 } }),
      { parameters: { w: 10, h: 10, qty: 1 } },
      MONDAY_MORNING,
    );
    expect(outcome.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SET_BOUNDS для DIMENSION (Codex review v2, блок 4): условные min/max/step/
// required, применяемые отдельно к каждой оси (w и h — разные параметры).
// ---------------------------------------------------------------------------
describe('SET_BOUNDS для DIMENSION', () => {
  function dimensionDefinition(overrides: Partial<EngineDefinition> = {}): EngineDefinition {
    const base = makeDefinition();
    return {
      ...base,
      parameters: [
        base.parameters[0], // subtype: standard | plastic
        {
          urlKey: 'w',
          label: 'Ширина',
          type: 'DIMENSION',
          isRequired: true,
          shareable: true,
          unit: 'мм',
          minValue: 30,
          maxValue: 100,
          stepValue: 1,
          defaultValue: '90',
          options: [],
        },
        {
          urlKey: 'h',
          label: 'Высота',
          type: 'DIMENSION',
          isRequired: true,
          shareable: true,
          unit: 'мм',
          minValue: 30,
          maxValue: 100,
          stepValue: 1,
          defaultValue: '50',
          options: [],
        },
      ],
      compatibilityRules: [
        // Пластик: ширина только 50..90 с шагом 5 — правило действует ТОЛЬКО
        // на ось w; границы h не меняются.
        {
          id: 'b1',
          kind: 'SET_BOUNDS',
          when: { subtype: 'plastic' },
          target: { param: 'w', min: 50, max: 90, step: 5 },
          sortOrder: 0,
        },
      ],
      ...overrides,
    };
  }

  it('без условия действуют базовые границы: w=100 допустим (ровно max)', () => {
    const r = expectOk(
      runCalculation(dimensionDefinition(), { parameters: { subtype: 'standard', w: 100, h: 30, qty: 100 } }, MONDAY_MORNING),
    );
    expect(r.normalizedParameters.w).toBe(100);
    expect(r.normalizedParameters.h).toBe(30);
  });

  it('изменение subtype меняет допустимые размеры: w=100 для пластика отклоняется', () => {
    const outcome = runCalculation(
      dimensionDefinition(),
      { parameters: { subtype: 'plastic', w: 100, h: 50, qty: 100 } },
      MONDAY_MORNING,
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.errors.some((e) => e.param === 'w' && e.message.includes('90'))).toBe(true);
    }
  });

  it('условный min: w=40 для пластика отклоняется (условный min 50 строже базового 30)', () => {
    const outcome = runCalculation(
      dimensionDefinition(),
      { parameters: { subtype: 'plastic', w: 40, h: 50, qty: 100 } },
      MONDAY_MORNING,
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.errors.some((e) => e.param === 'w' && e.message.includes('50'))).toBe(true);
  });

  it('значение ровно на условной границе допустимо: w=50 и w=90 для пластика', () => {
    for (const w of [50, 90]) {
      const r = expectOk(
        runCalculation(dimensionDefinition(), { parameters: { subtype: 'plastic', w, h: 50, qty: 100 } }, MONDAY_MORNING),
      );
      expect(r.normalizedParameters.w).toBe(w);
    }
  });

  it('условный step: w=52 выравнивается до 50 с warning (шаг 5 для пластика)', () => {
    const r = expectOk(
      runCalculation(dimensionDefinition(), { parameters: { subtype: 'plastic', w: 52, h: 50, qty: 100 } }, MONDAY_MORNING),
    );
    expect(r.normalizedParameters.w).toBe(50);
    expect(r.warnings.some((warning) => warning.includes('шага 5'))).toBe(true);
  });

  it('правило действует только на целевую ось: h вне условных границ w допустима', () => {
    // h=95 > условного max w (90), но правило целится только в w.
    const r = expectOk(
      runCalculation(dimensionDefinition(), { parameters: { subtype: 'plastic', w: 90, h: 95, qty: 100 } }, MONDAY_MORNING),
    );
    expect(r.normalizedParameters.h).toBe(95);
  });

  it('SET_BOUNDS.required=false снимает обязательность параметра без default', () => {
    const def = dimensionDefinition();
    def.parameters[1] = { ...def.parameters[1], defaultValue: null, isRequired: true };
    def.compatibilityRules = [
      { id: 'b2', kind: 'SET_BOUNDS', when: { subtype: 'plastic' }, target: { param: 'w', required: false }, sortOrder: 0 },
    ];
    // Для standard параметр обязателен (нет default, значения нет) → 422 …
    const failed = runCalculation(def, { parameters: { subtype: 'standard', h: 50, qty: 100 } }, MONDAY_MORNING);
    expect(failed.ok).toBe(false);
    // … а для plastic required переопределён в false → расчёт проходит.
    const ok = runCalculation(def, { parameters: { subtype: 'plastic', h: 50, qty: 100 } }, MONDAY_MORNING);
    expect(ok.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Upsells: дубликаты и условная доступность (Codex review v2, блок 1).
// ---------------------------------------------------------------------------
describe('валидация upsells', () => {
  it('отклоняет дубликат upsell-кода', () => {
    const outcome = runCalculation(
      makeDefinition(),
      { parameters: { qty: 100 }, upsells: ['design', 'design'] },
      MONDAY_MORNING,
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.errors.some((e) => e.param === 'upsells' && e.message.includes('дважды'))).toBe(true);
  });

  it('отклоняет upsell, недоступный для текущих параметров (visibleIf не совпал)', () => {
    const def = makeDefinition();
    def.upsells = [
      ...def.upsells,
      { code: 'hole', label: 'Отверстие под люверс', pricing: 'MULTIPLIER', multiplier: 1.05, isActive: true, visibleIf: { subtype: 'plastic' } },
    ];
    const outcome = runCalculation(
      def,
      { parameters: { subtype: 'standard', qty: 100 }, upsells: ['hole'] },
      MONDAY_MORNING,
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.errors.some((e) => e.param === 'upsells' && e.message.includes('недоступна'))).toBe(true);
    }
  });

  it('разрешает upsell с visibleIf при совпавших параметрах и включает его в цену', () => {
    const def = makeDefinition();
    def.upsells = [
      { code: 'hole', label: 'Отверстие под люверс', pricing: 'FLAT', amountMinor: 10000, isActive: true, visibleIf: { subtype: 'plastic' } },
    ];
    const base = expectOk(
      runCalculation(def, { parameters: { subtype: 'plastic', coating: 'none', qty: 100 } }, MONDAY_MORNING),
    );
    const withUpsell = expectOk(
      runCalculation(def, { parameters: { subtype: 'plastic', coating: 'none', qty: 100 }, upsells: ['hole'] }, MONDAY_MORNING),
    );
    expect(withUpsell.price.amountMinor).toBe(base.price.amountMinor + 10000);
    expect(withUpsell.normalizedUpsells).toEqual(['hole']);
    expect(withUpsell.appliedUpsells).toEqual([{ code: 'hole', label: 'Отверстие под люверс', amountMinor: 10000 }]);
  });
});
