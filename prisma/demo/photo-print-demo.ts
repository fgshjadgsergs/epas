/**
 * Демо-данные калькулятора «Фотопечать» (service_id: photo-print, ТЗ п.3.1,
 * тип multi_format из §15.13 backend_requirements_ru_v6.md).
 *
 * Единый источник для demo-сида и сквозного integration-теста.
 *
 * Модель: MULTI_QTY-параметр formats — независимое количество для каждого
 * формата; каждая строка тарифицируется СВОИМ количеством и своей ценой
 * (BASE_PER_MULTI_QTY_LINE), база заказа = сумма строк; бумага и срочность —
 * общие множители к сумме.
 *
 * ЦЕНЫ — ДЕМОНСТРАЦИОННЫЕ (из прототипа frontend photoPrint): 10×15 — 18 ₽,
 * 13×18 — 28 ₽, 15×20 — 36 ₽, 20×30 — 70 ₽, 30×40 — 120 ₽, 30×45 — 140 ₽,
 * 40×60 — 210 ₽, свой размер — 110 ₽; сатин ×1.1; срочность 4 ч ×1.3,
 * 1 ч ×1.6. Боевых цен заказчик не давал.
 *
 * Допущения/расхождения с прототипом (задокументированы):
 *  - ввод размеров (customW/customH) для «Свой размер» в definition v1 не
 *    переносится: в прототипе размеры НЕ влияли на цену (110 ₽/шт всегда,
 *    до 60×90 см) и служили только сбору данных заказа; условная видимость
 *    «параметр виден, когда строка custom > 0» движком пока не выражается —
 *    отдельный техдолг перед футболками;
 *  - лимиты: до 5000 шт в строке, до 10 000 суммарно, минимум 1 фотография —
 *    рабочие demo-крышки (в ТЗ лимитов нет).
 */

export function photoPrintDefinitionCreate(version: number) {
  return {
    code: 'photo-print',
    title: 'Фотопечать (демо)',
    version,
    pricingMode: 'TIER' as const,
    urlOrder: ['formats', 'paper', 'urgency', 'qty'],
    minQty: 1,
    maxQty: 10000,
    qtyStep: 1,
    defaultQty: 10,
    parameters: {
      create: [
        {
          urlKey: 'formats',
          label: 'Форматы и количество',
          type: 'MULTI_QTY' as const,
          sortOrder: 0,
          defaultValue: '10x15:10',
          config: {
            multiQty: {
              maxLines: 8,
              lineMin: 0,
              lineMax: 5000,
              lineStep: 1,
              totalMin: 1,
              totalMax: 10000,
            },
          },
          options: {
            create: [
              { value: '10x15', label: '10×15', isDefault: true, sortOrder: 0 },
              { value: '13x18', label: '13×18', sortOrder: 1 },
              { value: '15x20', label: '15×20', sortOrder: 2 },
              { value: '20x30', label: '20×30', sortOrder: 3 },
              { value: '30x40', label: '30×40', sortOrder: 4 },
              { value: '30x45', label: '30×45', sortOrder: 5 },
              { value: '40x60', label: '40×60', sortOrder: 6 },
              { value: 'custom', label: 'Свой размер (до 60×90 см)', sortOrder: 7 },
            ],
          },
        },
        {
          urlKey: 'paper',
          label: 'Бумага',
          type: 'SWATCH' as const,
          sortOrder: 1,
          options: {
            create: [
              { value: 'gloss', label: 'Глянцевая', isDefault: true, sortOrder: 0 },
              { value: 'matte', label: 'Матовая', sortOrder: 1 },
              { value: 'satin', label: 'Сатин', sortOrder: 2 },
            ],
          },
        },
        {
          urlKey: 'urgency',
          label: 'Срочность',
          type: 'SEGMENTED' as const,
          sortOrder: 2,
          options: {
            create: [
              { value: 'standard', label: 'Стандарт (1–2 дня)', isDefault: true, sortOrder: 0 },
              { value: 'express-4h', label: 'За 4 часа', sortOrder: 1 },
              { value: 'express-1h', label: 'За 1 час', sortOrder: 2 },
            ],
          },
        },
      ],
    },
    compatibilityRules: { create: [] },
    productionRules: {
      create: [
        { workingDays: 1, cutoff: '14:00', priority: 0 },
        { condition: { urgency: 'express-4h' }, workingDays: 0, cutoff: '18:00', priority: 10 },
        { condition: { urgency: 'express-1h' }, workingDays: 0, cutoff: '20:00', priority: 20 },
      ],
    },
    upsells: { create: [] },
  };
}

/** ДЕМО-прайс фотопечати: цена за штуку каждой строки + множители бумаги/срочности. */
export function photoPrintDemoPriceRulesCreate() {
  const line = (lineKey: string, amountMinor: number, sortOrder: number) => ({
    kind: 'BASE_PER_MULTI_QTY_LINE' as const,
    qtyFrom: 1,
    qtyTo: null,
    amountMinor,
    config: { sourceParameter: 'formats', lineKey },
    sortOrder,
  });
  return {
    create: [
      line('10x15', 1800, 0),
      line('13x18', 2800, 1),
      line('15x20', 3600, 2),
      line('20x30', 7000, 3),
      line('30x40', 12000, 4),
      line('30x45', 14000, 5),
      line('40x60', 21000, 6),
      line('custom', 11000, 7),
      { kind: 'MULTIPLIER' as const, condition: { paper: 'satin' }, multiplier: 1.1, sortOrder: 20 },
      { kind: 'MULTIPLIER' as const, condition: { urgency: 'express-4h' }, multiplier: 1.3, sortOrder: 21 },
      { kind: 'MULTIPLIER' as const, condition: { urgency: 'express-1h' }, multiplier: 1.6, sortOrder: 22 },
    ],
  };
}
