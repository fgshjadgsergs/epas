import {
  findConflictingPeriods,
  validateDerivedMetrics,
  validateMetricPriceRules,
  validateMultiQtyLineRules,
  validatePresetAgainstDefinition,
  validateDeterministicOrder,
  validatePeriod,
  validateTierRanges,
} from './publish-validator';

describe('validateTierRanges', () => {
  it('пропускает корректные непересекающиеся диапазоны, покрывающие minQty', () => {
    const issues = validateTierRanges(
      [
        { id: 'a', condition: null, qtyFrom: 50, qtyTo: 199, sortOrder: 0 },
        { id: 'b', condition: null, qtyFrom: 200, qtyTo: null, sortOrder: 1 },
      ],
      50,
    );
    expect(issues).toEqual([]);
  });

  it('отклоняет пересекающиеся диапазоны', () => {
    const issues = validateTierRanges(
      [
        { id: 'a', condition: null, qtyFrom: 50, qtyTo: 200, sortOrder: 0 },
        { id: 'b', condition: null, qtyFrom: 150, qtyTo: null, sortOrder: 1 },
      ],
      50,
    );
    expect(issues.some((i) => i.code === 'OVERLAPPING_TIERS')).toBe(true);
  });

  it('отклоняет разрыв между диапазонами', () => {
    const issues = validateTierRanges(
      [
        { id: 'a', condition: null, qtyFrom: 50, qtyTo: 99, sortOrder: 0 },
        { id: 'b', condition: null, qtyFrom: 200, qtyTo: null, sortOrder: 1 },
      ],
      50,
    );
    expect(issues.some((i) => i.code === 'GAP_IN_TIERS')).toBe(true);
  });

  it('отклоняет непокрытый minQty', () => {
    const issues = validateTierRanges(
      [{ id: 'a', condition: null, qtyFrom: 100, qtyTo: null, sortOrder: 0 }],
      50,
    );
    expect(issues.some((i) => i.code === 'TIER_DOES_NOT_COVER_MIN_QTY')).toBe(true);
  });

  it('отклоняет открытый диапазон не последним', () => {
    const issues = validateTierRanges(
      [
        { id: 'a', condition: null, qtyFrom: 50, qtyTo: null, sortOrder: 0 },
        { id: 'b', condition: null, qtyFrom: 200, qtyTo: 300, sortOrder: 1 },
      ],
      50,
    );
    expect(issues.some((i) => i.code === 'OPEN_RANGE_NOT_LAST')).toBe(true);
  });

  it('условные диапазоны (разные condition) валидируются независимо', () => {
    const issues = validateTierRanges(
      [
        { id: 'a', condition: null, qtyFrom: 50, qtyTo: null, sortOrder: 0 },
        { id: 'b', condition: { subtype: 'plastic' }, qtyFrom: 100, qtyTo: null, sortOrder: 1 },
      ],
      50,
    );
    expect(issues).toEqual([]);
  });

  it('отклоняет дублирующийся qtyFrom', () => {
    const issues = validateTierRanges(
      [
        { id: 'a', condition: null, qtyFrom: 50, qtyTo: 100, sortOrder: 0 },
        { id: 'b', condition: null, qtyFrom: 50, qtyTo: null, sortOrder: 1 },
      ],
      50,
    );
    expect(issues.some((i) => i.code === 'DUPLICATE_TIER_START')).toBe(true);
  });
});

describe('validateDeterministicOrder', () => {
  it('пропускает разные sortOrder', () => {
    const issues = validateDeterministicOrder([
      { id: 'a', kind: 'MULTIPLIER', condition: { sides: 'double' }, sortOrder: 0 },
      { id: 'b', kind: 'MULTIPLIER', condition: { coating: 'matte-lam' }, sortOrder: 1 },
    ]);
    expect(issues).toEqual([]);
  });

  it('отклоняет одинаковый sortOrder при одинаковом condition и kind', () => {
    const issues = validateDeterministicOrder([
      { id: 'a', kind: 'MULTIPLIER', condition: { sides: 'double' }, sortOrder: 5 },
      { id: 'b', kind: 'MULTIPLIER', condition: { sides: 'double' }, sortOrder: 5 },
    ]);
    expect(issues.some((i) => i.code === 'AMBIGUOUS_SORT_ORDER')).toBe(true);
  });

  it('одинаковый sortOrder но разный kind — не конфликт', () => {
    const issues = validateDeterministicOrder([
      { id: 'a', kind: 'MULTIPLIER', condition: null, sortOrder: 0 },
      { id: 'b', kind: 'SURCHARGE_FLAT', condition: null, sortOrder: 0 },
    ]);
    expect(issues).toEqual([]);
  });
});

describe('validatePeriod', () => {
  it('validFrom < validTo — ок', () => {
    expect(validatePeriod({ validFrom: new Date('2026-01-01'), validTo: new Date('2026-02-01') })).toEqual([]);
  });
  it('validFrom >= validTo — ошибка', () => {
    const issues = validatePeriod({ validFrom: new Date('2026-02-01'), validTo: new Date('2026-01-01') });
    expect(issues.some((i) => i.code === 'INVALID_PERIOD')).toBe(true);
  });
  it('открытые границы — ок', () => {
    expect(validatePeriod({ validFrom: null, validTo: null })).toEqual([]);
  });
});

describe('findConflictingPeriods', () => {
  it('находит пересечение с открытым существующим периодом', () => {
    const conflicts = findConflictingPeriods(
      { id: 'new', validFrom: new Date('2026-06-01'), validTo: null },
      [{ id: 'old', validFrom: null, validTo: null }],
    );
    expect(conflicts).toHaveLength(1);
  });

  it('не считает конфликтом непересекающиеся периоды (сезонные прайсы)', () => {
    const conflicts = findConflictingPeriods(
      { id: 'new', validFrom: new Date('2026-06-01'), validTo: new Date('2026-07-01') },
      [{ id: 'old', validFrom: new Date('2026-01-01'), validTo: new Date('2026-02-01') }],
    );
    expect(conflicts).toEqual([]);
  });

  it('исключает сам себя из списка конфликтов', () => {
    const conflicts = findConflictingPeriods(
      { id: 'self', validFrom: null, validTo: null },
      [{ id: 'self', validFrom: null, validTo: null }],
    );
    expect(conflicts).toEqual([]);
  });

  it('находит частичное пересечение периодов', () => {
    const conflicts = findConflictingPeriods(
      { id: 'new', validFrom: new Date('2026-01-15'), validTo: new Date('2026-03-01') },
      [{ id: 'old', validFrom: new Date('2026-01-01'), validTo: new Date('2026-02-01') }],
    );
    expect(conflicts).toHaveLength(1);
  });
});

describe('validatePresetAgainstDefinition', () => {
  const definition = {
    minQty: 100,
    maxQty: 100000,
    parameters: [
      {
        urlKey: 'format',
        type: 'SEGMENTED',
        minValue: null,
        maxValue: null,
        options: [
          { value: 'A4', isActive: true },
          { value: 'A5', isActive: true },
          { value: 'old', isActive: false },
        ],
      },
      { urlKey: 'w', type: 'DIMENSION', minValue: 74, maxValue: 297, options: [] },
      { urlKey: 'express', type: 'TOGGLE', minValue: null, maxValue: null, options: [] },
    ],
  };

  it('корректный preset проходит без замечаний', () => {
    expect(
      validatePresetAgainstDefinition({ format: 'A4', w: '148', express: '0', qty: '1000' }, definition),
    ).toEqual([]);
  });

  it('неизвестный параметр отклоняется (включая promo/b2b/upsells/price)', () => {
    for (const key of ['promo', 'b2b', 'upsells', 'price', 'discount']) {
      const issues = validatePresetAgainstDefinition({ [key]: 'x' }, definition);
      expect(issues.some((i) => i.code === 'PRESET_UNKNOWN_PARAM')).toBe(true);
    }
  });

  it('недопустимая или неактивная option отклоняется', () => {
    expect(
      validatePresetAgainstDefinition({ format: 'A9' }, definition).some((i) => i.code === 'PRESET_INVALID_OPTION'),
    ).toBe(true);
    expect(
      validatePresetAgainstDefinition({ format: 'old' }, definition).some((i) => i.code === 'PRESET_INVALID_OPTION'),
    ).toBe(true);
  });

  it('границы: qty и DIMENSION вне диапазона отклоняются', () => {
    expect(
      validatePresetAgainstDefinition({ qty: '50' }, definition).some((i) => i.code === 'PRESET_QTY_OUT_OF_RANGE'),
    ).toBe(true);
    expect(
      validatePresetAgainstDefinition({ w: '10' }, definition).some(
        (i) => i.code === 'PRESET_DIMENSION_OUT_OF_RANGE',
      ),
    ).toBe(true);
    expect(
      validatePresetAgainstDefinition({ express: '2' }, definition).some((i) => i.code === 'PRESET_INVALID_TOGGLE'),
    ).toBe(true);
  });
});

describe('validateDerivedMetrics / validateMetricPriceRules', () => {
  const params = [
    { urlKey: 'w', type: 'DIMENSION' },
    { urlKey: 'h', type: 'DIMENSION' },
    { urlKey: 'lugstep', type: 'DIMENSION' },
    { urlKey: 'material', type: 'SWATCH' },
  ];
  const goodMetrics = [
    { kind: 'PERIMETER' as const, code: 'perimeter', widthParam: 'w', heightParam: 'h' },
    {
      kind: 'INTERVAL_COUNT' as const,
      code: 'lug-count',
      sourceMetric: 'perimeter',
      interval: 0.5,
      intervalParam: 'lugstep',
    },
  ];

  it('корректная конфигурация метрик проходит', () => {
    expect(validateDerivedMetrics(goodMetrics, params)).toEqual([]);
  });

  it('неизвестный параметр и не-DIMENSION тип отклоняются', () => {
    const issues = validateDerivedMetrics(
      [{ kind: 'AREA' as const, code: 'area', widthParam: 'nope', heightParam: 'material' }],
      params,
    );
    expect(issues.some((i) => i.code === 'METRIC_UNKNOWN_PARAM')).toBe(true);
    expect(issues.some((i) => i.code === 'METRIC_INCOMPATIBLE_PARAM')).toBe(true);
  });

  it('циклическая/опережающая ссылка INTERVAL_COUNT отклоняется', () => {
    // Источник объявлен ПОЗЖЕ зависимой метрики — эквивалент цикла.
    const issues = validateDerivedMetrics(
      [
        { kind: 'INTERVAL_COUNT' as const, code: 'lug-count', sourceMetric: 'perimeter', interval: 0.5 },
        { kind: 'PERIMETER' as const, code: 'perimeter', widthParam: 'w', heightParam: 'h' },
      ],
      params,
    );
    expect(issues.some((i) => i.code === 'METRIC_UNKNOWN_SOURCE')).toBe(true);
    // Ссылка на саму себя — тоже отклоняется.
    const selfRef = validateDerivedMetrics(
      [{ kind: 'INTERVAL_COUNT' as const, code: 'x', sourceMetric: 'x', interval: 0.5 }],
      params,
    );
    expect(selfRef.some((i) => i.code === 'METRIC_UNKNOWN_SOURCE')).toBe(true);
  });

  it('interval <= 0, отсутствие interval и minCount > maxCount отклоняются', () => {
    const noInterval = validateDerivedMetrics(
      [
        { kind: 'PERIMETER' as const, code: 'perimeter', widthParam: 'w', heightParam: 'h' },
        { kind: 'INTERVAL_COUNT' as const, code: 'c', sourceMetric: 'perimeter' },
      ],
      params,
    );
    expect(noInterval.some((i) => i.code === 'METRIC_NO_INTERVAL')).toBe(true);
    const badRange = validateDerivedMetrics(
      [
        { kind: 'PERIMETER' as const, code: 'perimeter', widthParam: 'w', heightParam: 'h' },
        {
          kind: 'INTERVAL_COUNT' as const,
          code: 'c',
          sourceMetric: 'perimeter',
          interval: -1,
          minCount: 10,
          maxCount: 5,
        },
      ],
      params,
    );
    expect(badRange.some((i) => i.code === 'METRIC_INTERVAL_NOT_POSITIVE')).toBe(true);
    expect(badRange.some((i) => i.code === 'METRIC_COUNT_RANGE')).toBe(true);
  });

  it('PER_LENGTH без метрики длины и INTERVAL_COUNT без interval отклоняются', () => {
    const rules = [
      { id: 'r1', kind: 'SURCHARGE_PER_LENGTH', config: { sourceMetric: 'nope' } },
      { id: 'r2', kind: 'SURCHARGE_PER_INTERVAL_COUNT', config: { sourceMetric: 'perimeter' } },
      { id: 'r3', kind: 'SURCHARGE_PER_LENGTH', config: null },
    ];
    const issues = validateMetricPriceRules(rules, goodMetrics, params);
    expect(issues.some((i) => i.code === 'RULE_UNKNOWN_METRIC')).toBe(true);
    expect(issues.some((i) => i.code === 'RULE_NO_INTERVAL')).toBe(true);
    expect(issues.some((i) => i.code === 'RULE_NO_SOURCE_METRIC')).toBe(true);
  });

  it('корректные метрические правила проходят', () => {
    const rules = [
      { id: 'r1', kind: 'SURCHARGE_PER_LENGTH', config: { sourceMetric: 'perimeter' } },
      {
        id: 'r2',
        kind: 'SURCHARGE_PER_INTERVAL_COUNT',
        config: { sourceMetric: 'perimeter', interval: 0.5, intervalParam: 'lugstep' },
      },
    ];
    expect(validateMetricPriceRules(rules, goodMetrics, params)).toEqual([]);
  });
});

describe('validateMultiQtyLineRules', () => {
  const params = [
    {
      urlKey: 'formats',
      type: 'MULTI_QTY',
      options: [
        { value: '10x15', isActive: true },
        { value: '20x30', isActive: true },
        { value: 'legacy', isActive: false },
      ],
      multiQty: { lineMin: 0 },
    },
    { urlKey: 'paper', type: 'SWATCH', options: [], multiQty: null },
  ];
  const lineRule = (
    id: string,
    lineKey: string,
    qtyFrom: number | null,
    qtyTo: number | null,
    extra: Partial<{ condition: Record<string, string> | null; kind: string; amountMinor: number | null }> = {},
  ) => ({
    id,
    kind: 'BASE_PER_MULTI_QTY_LINE',
    condition: null,
    qtyFrom,
    qtyTo,
    amountMinor: 1000,
    config: { sourceParameter: 'formats', lineKey },
    sortOrder: 0,
    ...extra,
  });

  it('полное покрытие всех активных строк проходит', () => {
    const issues = validateMultiQtyLineRules(
      [lineRule('r1', '10x15', 1, 99), lineRule('r2', '10x15', 100, null), lineRule('r3', '20x30', 1, null)],
      params,
    );
    expect(issues).toEqual([]);
  });

  it('активная строка без цены отклоняется (fail-closed на публикации)', () => {
    const issues = validateMultiQtyLineRules([lineRule('r1', '10x15', 1, null)], params);
    expect(issues.some((i) => i.code === 'LINE_WITHOUT_PRICE')).toBe(true);
  });

  it('пересечения и дыры диапазонов строки отклоняются', () => {
    const overlap = validateMultiQtyLineRules(
      [lineRule('r1', '10x15', 1, 100), lineRule('r2', '10x15', 50, null), lineRule('r3', '20x30', 1, null)],
      params,
    );
    expect(overlap.some((i) => i.code === 'OVERLAPPING_TIERS')).toBe(true);
    const gap = validateMultiQtyLineRules(
      [lineRule('r1', '10x15', 1, 99), lineRule('r2', '10x15', 200, null), lineRule('r3', '20x30', 1, null)],
      params,
    );
    expect(gap.some((i) => i.code === 'GAP_IN_TIERS')).toBe(true);
  });

  it('неизвестный источник, неактивная строка и смешение баз отклоняются', () => {
    const unknownSource = validateMultiQtyLineRules(
      [{ ...lineRule('r1', '10x15', 1, null), config: { sourceParameter: 'paper', lineKey: '10x15' } }],
      params,
    );
    expect(unknownSource.some((i) => i.code === 'LINE_RULE_UNKNOWN_SOURCE')).toBe(true);
    const inactive = validateMultiQtyLineRules([lineRule('r1', 'legacy', 1, null)], params);
    expect(inactive.some((i) => i.code === 'LINE_RULE_UNKNOWN_LINE')).toBe(true);
    const mixed = validateMultiQtyLineRules(
      [
        lineRule('r1', '10x15', 1, null),
        lineRule('r2', '20x30', 1, null),
        { id: 't1', kind: 'BASE_TIER', condition: null, qtyFrom: 1, qtyTo: null, amountMinor: 100, config: null, sortOrder: 5 },
      ],
      params,
    );
    expect(mixed.some((i) => i.code === 'MIXED_BASE_KINDS')).toBe(true);
  });
});

describe('validateTierRanges — модификатор QTY_DISCOUNT vs базовая BASE_TIER-лестница', () => {
  const strict = { requireMinCoverage: true, forbidGaps: true };
  const modifier = { requireMinCoverage: false, forbidGaps: false };

  it('A. BASE_TIER c разрывом — по-прежнему invalid (строгая семантика)', () => {
    const issues = validateTierRanges(
      [
        { id: 'a', condition: null, qtyFrom: 1, qtyTo: 99, sortOrder: 0 },
        { id: 'b', condition: null, qtyFrom: 200, qtyTo: null, sortOrder: 1 },
      ],
      1,
      strict,
    );
    expect(issues.some((i) => i.code === 'GAP_IN_TIERS')).toBe(true);
  });

  it('A2. BASE_TIER, не покрывающий minQty — по-прежнему invalid', () => {
    const issues = validateTierRanges([{ id: 'a', condition: null, qtyFrom: 3, qtyTo: null, sortOrder: 0 }], 1, strict);
    expect(issues.some((i) => i.code === 'TIER_DOES_NOT_COVER_MIN_QTY')).toBe(true);
  });

  it('B. QTY_DISCOUNT от 3 при minQty=1 — valid (базовое покрытие даёт BASE_PER_SQM)', () => {
    const issues = validateTierRanges([{ id: 'd', condition: null, qtyFrom: 3, qtyTo: null, sortOrder: 0 }], 1, modifier);
    expect(issues).toEqual([]);
  });

  it('B2. Несколько порогов скидки с разрывом — valid (пробелы допустимы для модификатора)', () => {
    const issues = validateTierRanges(
      [
        { id: 'd1', condition: null, qtyFrom: 3, qtyTo: 99, sortOrder: 0 },
        { id: 'd2', condition: null, qtyFrom: 500, qtyTo: null, sortOrder: 1 },
      ],
      1,
      modifier,
    );
    expect(issues).toEqual([]);
  });

  it('пересечение порогов скидки — всё ещё invalid', () => {
    const issues = validateTierRanges(
      [
        { id: 'd1', condition: null, qtyFrom: 3, qtyTo: 100, sortOrder: 0 },
        { id: 'd2', condition: null, qtyFrom: 50, qtyTo: null, sortOrder: 1 },
      ],
      1,
      modifier,
    );
    expect(issues.some((i) => i.code === 'OVERLAPPING_TIERS')).toBe(true);
  });
});
