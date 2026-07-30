/**
 * Демо-данные калькулятора «Листовки» (service_id: leaflets, ТЗ п.1.2).
 *
 * Единый источник для:
 *  - prisma/seed-calculator-demo.ts (демо-сид в dev);
 *  - src/calculator/leaflets.integration.spec.ts (сквозной тест на живой БД).
 *
 * Параметры/варианты/совместимость перенесены из ТЗ и прежнего
 * frontend-конфига frontend/src/lib/calc/configs/leaflets.ts.
 * ЦЕНЫ — ДЕМОНСТРАЦИОННЫЕ (из прототипа frontend), не production-прайс:
 * прайс-лист создаётся только как DRAFT + isDemo, боевых цен заказчик
 * ещё не предоставил.
 *
 * Отличие от прежнего конфига: url-ключи произвольного размера — w/h
 * (не customW/customH): ТЗ §15.16 требует имена GET-параметров в нижнем
 * регистре; так же назван размер и у визиток.
 */

/** Параметры, совместимость, производство, upsells (без прайса). */
export function leafletsDefinitionCreate(version: number) {
  return {
    code: 'leaflets',
    title: 'Листовки (демо)',
    version,
    pricingMode: 'TIER' as const,
    urlOrder: ['format', 'w', 'h', 'paper', 'color', 'coating', 'qty', 'express'],
    minQty: 100,
    maxQty: 100000,
    qtyStep: 100,
    defaultQty: 500,
    parameters: {
      create: [
        {
          urlKey: 'format',
          label: 'Формат',
          type: 'SEGMENTED' as const,
          sortOrder: 0,
          options: {
            create: [
              { value: 'A4', label: 'A4', sortOrder: 0 },
              { value: 'A5', label: 'A5', isDefault: true, sortOrder: 1 },
              { value: 'A6', label: 'A6', sortOrder: 2 },
              { value: 'DL', label: 'Евро (DL)', sortOrder: 3 },
              { value: 'custom', label: 'Свой размер', sortOrder: 4 },
            ],
          },
        },
        {
          urlKey: 'w',
          label: 'Ширина',
          type: 'DIMENSION' as const,
          sortOrder: 1,
          unit: 'мм',
          minValue: 74,
          maxValue: 297,
          stepValue: 1,
          defaultValue: '148',
          visibleIf: { format: 'custom' },
        },
        {
          urlKey: 'h',
          label: 'Высота',
          type: 'DIMENSION' as const,
          sortOrder: 2,
          unit: 'мм',
          minValue: 74,
          maxValue: 297,
          stepValue: 1,
          defaultValue: '210',
          visibleIf: { format: 'custom' },
        },
        {
          urlKey: 'paper',
          label: 'Бумага',
          type: 'SWATCH' as const,
          sortOrder: 3,
          options: {
            create: [
              { value: 'offset-80', label: 'Офсет 80 г', sortOrder: 0 },
              { value: 'coated-115', label: 'Мелованная 115 г', sortOrder: 1 },
              { value: 'coated-150', label: 'Мелованная 150 г', isDefault: true, sortOrder: 2 },
              { value: 'coated-200', label: 'Мелованная 200 г', sortOrder: 3 },
            ],
          },
        },
        {
          urlKey: 'color',
          label: 'Цветность',
          type: 'SEGMENTED' as const,
          sortOrder: 4,
          options: {
            create: [
              { value: '4+4', label: 'Цвет 2 стороны', isDefault: true, sortOrder: 0 },
              { value: '4+0', label: 'Цвет 1 сторона', sortOrder: 1 },
              { value: '1+1', label: 'Ч/б 2 стороны', sortOrder: 2 },
              { value: '1+0', label: 'Ч/б 1 сторона', sortOrder: 3 },
            ],
          },
        },
        {
          urlKey: 'coating',
          label: 'Ламинация',
          type: 'SWATCH' as const,
          sortOrder: 5,
          options: {
            create: [
              { value: 'none', label: 'Без ламинации', isDefault: true, sortOrder: 0 },
              { value: 'matte-lam', label: 'Матовая', sortOrder: 1 },
              { value: 'gloss-lam', label: 'Глянцевая', sortOrder: 2 },
            ],
          },
        },
        {
          urlKey: 'express',
          label: 'Срочное изготовление',
          type: 'TOGGLE' as const,
          sortOrder: 6,
          isRequired: false,
          defaultValue: '0',
        },
      ],
    },
    compatibilityRules: {
      create: [
        {
          kind: 'DISABLE_OPTIONS' as const,
          when: { paper: 'offset-80' },
          target: { param: 'coating', options: ['matte-lam', 'gloss-lam'] },
          message: 'Ламинация недоступна для офсетной бумаги 80 г',
          sortOrder: 0,
        },
        {
          kind: 'MAX_QTY' as const,
          when: { express: '1' },
          target: { maxQty: 2000 },
          message: 'Срочное изготовление — только для тиража до 2 000 шт.',
          sortOrder: 1,
        },
      ],
    },
    productionRules: {
      create: [
        { workingDays: 2, cutoff: '14:00', priority: 0 },
        { condition: { express: '1' }, workingDays: 1, cutoff: '14:00', priority: 10 },
      ],
    },
    upsells: {
      create: [
        { code: 'numbering', label: 'Нумерация', pricing: 'PER_UNIT' as const, amountMinor: 500, sortOrder: 0 },
        { code: 'perforation', label: 'Перфорация', pricing: 'PER_UNIT' as const, amountMinor: 300, sortOrder: 1 },
        { code: 'design', label: 'Разработка дизайна', pricing: 'FLAT' as const, amountMinor: 100000, sortOrder: 2 },
      ],
    },
  };
}

/**
 * ДЕМО-прайс (копейки; из qtyTiers/коэффициентов прототипа frontend).
 * base: цена за штуку по диапазону тиража; далее множители формата/бумаги/
 * цветности/ламинации/срочности — порядок применения детерминирован
 * (sortOrder), диапазоны не пересекаются и покрывают minQty.
 */
export function leafletsDemoPriceRulesCreate() {
  return {
    create: [
      { kind: 'BASE_TIER' as const, qtyFrom: 100, qtyTo: 499, amountMinor: 900, sortOrder: 0 },
      { kind: 'BASE_TIER' as const, qtyFrom: 500, qtyTo: 999, amountMinor: 420, sortOrder: 1 },
      { kind: 'BASE_TIER' as const, qtyFrom: 1000, qtyTo: 1999, amountMinor: 280, sortOrder: 2 },
      { kind: 'BASE_TIER' as const, qtyFrom: 2000, qtyTo: 4999, amountMinor: 210, sortOrder: 3 },
      { kind: 'BASE_TIER' as const, qtyFrom: 5000, qtyTo: 9999, amountMinor: 150, sortOrder: 4 },
      { kind: 'BASE_TIER' as const, qtyFrom: 10000, qtyTo: 49999, amountMinor: 110, sortOrder: 5 },
      { kind: 'BASE_TIER' as const, qtyFrom: 50000, qtyTo: 99999, amountMinor: 85, sortOrder: 6 },
      { kind: 'BASE_TIER' as const, qtyFrom: 100000, qtyTo: null, amountMinor: 70, sortOrder: 7 },
      { kind: 'MULTIPLIER' as const, condition: { format: 'A4' }, multiplier: 1.6, sortOrder: 10 },
      { kind: 'MULTIPLIER' as const, condition: { format: 'A6' }, multiplier: 0.7, sortOrder: 11 },
      { kind: 'MULTIPLIER' as const, condition: { format: 'DL' }, multiplier: 0.8, sortOrder: 12 },
      { kind: 'MULTIPLIER' as const, condition: { format: 'custom' }, multiplier: 1.3, sortOrder: 13 },
      { kind: 'MULTIPLIER' as const, condition: { paper: 'offset-80' }, multiplier: 0.8, sortOrder: 14 },
      { kind: 'MULTIPLIER' as const, condition: { paper: 'coated-150' }, multiplier: 1.1, sortOrder: 15 },
      { kind: 'MULTIPLIER' as const, condition: { paper: 'coated-200' }, multiplier: 1.25, sortOrder: 16 },
      { kind: 'MULTIPLIER' as const, condition: { color: '4+0' }, multiplier: 0.8, sortOrder: 17 },
      { kind: 'MULTIPLIER' as const, condition: { color: '1+1' }, multiplier: 0.6, sortOrder: 18 },
      { kind: 'MULTIPLIER' as const, condition: { color: '1+0' }, multiplier: 0.5, sortOrder: 19 },
      { kind: 'MULTIPLIER' as const, condition: { coating: 'matte-lam' }, multiplier: 1.15, sortOrder: 20 },
      { kind: 'MULTIPLIER' as const, condition: { coating: 'gloss-lam' }, multiplier: 1.15, sortOrder: 21 },
      { kind: 'MULTIPLIER' as const, condition: { express: '1' }, multiplier: 1.3, sortOrder: 22 },
    ],
  };
}
