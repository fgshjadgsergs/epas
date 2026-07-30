/**
 * Демо-данные калькулятора «Баннеры» (service_id: banner-print, ТЗ п.4.1 +
 * формулы §15.12 backend_requirements_ru_v6.md).
 *
 * Единый источник для demo-сида и сквозного integration-теста.
 *
 * Формулы из ТЗ §15.12:
 *   area      = w × h;  price = area × price_per_sqm(material)
 *   lug_count = ceil(perimeter / 0.5);  lugs_price = lug_count × 15 ₽
 *   hem_price = perimeter × hem_rate
 *   total     = (price + lugs_price + hem_price) × qty × express_coeff
 *
 * ЦЕНЫ — ДЕМОНСТРАЦИОННЫЕ, боевых заказчик не давал:
 *   - 450 ₽/м² и коэффициенты материалов — из прототипа frontend (banner.ts);
 *   - 15 ₽/люверс — из примера формулы ТЗ §15.12 (принято как demo);
 *   - ставки подшива 80/150 ₽/м — ДОПУЩЕНИЕ demo: ТЗ задаёт формулу
 *     «периметр × hem_rate», но самих ставок нигде нет (в прототипе был
 *     коэффициент 1.08/1.15, что противоречит формуле ТЗ — выбрана формула).
 *
 * Прочие допущения (в ТЗ не оговорено, реализовано без выдумывания сверх):
 *   - шаг люверсов 0.5 м фиксирован для «Каждые 50 см» и берётся из
 *     параметра lugstep (см) для «Свой шаг»; угловые люверсы отдельно не
 *     считаются; минимального количества нет;
 *   - количество люверсов и подшив считаются на ОДНО изделие и умножаются
 *     на qty (по структуре формулы total из ТЗ);
 *   - минимальной оплачиваемой площади в ТЗ нет — minBillableSqm не задан;
 *     maxSqm 25 — техническая крышка из границ 5×5 м;
 *   - шаг размеров 0.05 м (в прототипе был 0.1, но ТЗ требует корректность
 *     значений вида 0.75 м — 0.1 их выравнивал бы).
 */

export function bannerDefinitionCreate(version: number) {
  return {
    code: 'banner-print',
    title: 'Баннеры (демо)',
    version,
    pricingMode: 'AREA' as const,
    urlOrder: ['w', 'h', 'material', 'lugs', 'lugstep', 'hem', 'qty', 'express'],
    minQty: 1,
    maxQty: 10,
    qtyStep: 1,
    defaultQty: 1,
    config: {
      area: { unit: 'm', maxSqm: 25 },
      metrics: [
        { kind: 'AREA', code: 'area', label: 'Площадь', widthParam: 'w', heightParam: 'h', unit: 'm' },
        { kind: 'PERIMETER', code: 'perimeter', label: 'Периметр', widthParam: 'w', heightParam: 'h', unit: 'm' },
        {
          kind: 'INTERVAL_COUNT',
          code: 'lug-count',
          label: 'Люверсы',
          sourceMetric: 'perimeter',
          interval: 0.5,
          intervalParam: 'lugstep',
          intervalUnit: 'cm',
          rounding: 'CEIL',
          when: { lugs: ['with', 'custom'] },
        },
      ],
    },
    parameters: {
      create: [
        {
          urlKey: 'w',
          label: 'Ширина',
          type: 'DIMENSION' as const,
          sortOrder: 0,
          unit: 'м',
          minValue: 0.5,
          maxValue: 5,
          stepValue: 0.05,
          defaultValue: '2',
          config: { unit: 'm' },
        },
        {
          urlKey: 'h',
          label: 'Высота',
          type: 'DIMENSION' as const,
          sortOrder: 1,
          unit: 'м',
          minValue: 0.5,
          maxValue: 5,
          stepValue: 0.05,
          defaultValue: '1',
          config: { unit: 'm' },
        },
        {
          urlKey: 'material',
          label: 'Материал',
          type: 'SWATCH' as const,
          sortOrder: 2,
          options: {
            create: [
              { value: 'banner-440', label: 'Баннер 440 г', isDefault: true, sortOrder: 0 },
              { value: 'banner-510', label: 'Баннер 510 г', sortOrder: 1 },
              { value: 'satin', label: 'Сатин (ткань)', sortOrder: 2 },
              { value: 'mesh', label: 'Сетка (mesh)', sortOrder: 3 },
              { value: 'pvc-self-adhesive', label: 'ПВХ самоклейка', sortOrder: 4 },
            ],
          },
        },
        {
          urlKey: 'lugs',
          label: 'Люверсы',
          type: 'SEGMENTED' as const,
          sortOrder: 3,
          options: {
            create: [
              { value: 'with', label: 'Каждые 50 см', isDefault: true, sortOrder: 0 },
              { value: 'custom', label: 'Свой шаг', sortOrder: 1 },
              { value: 'none', label: 'Без люверсов', sortOrder: 2 },
            ],
          },
        },
        {
          urlKey: 'lugstep',
          label: 'Шаг люверсов',
          type: 'DIMENSION' as const,
          sortOrder: 4,
          unit: 'см',
          minValue: 20,
          maxValue: 100,
          stepValue: 5,
          defaultValue: '50',
          visibleIf: { lugs: 'custom' },
          config: { unit: 'cm' },
        },
        {
          urlKey: 'hem',
          label: 'Обшивка кромок',
          type: 'SEGMENTED' as const,
          sortOrder: 5,
          options: {
            create: [
              { value: 'none', label: 'Без обшивки', isDefault: true, sortOrder: 0 },
              { value: 'basic', label: 'Обычная', sortOrder: 1 },
              { value: 'thick', label: 'Усиленная', sortOrder: 2 },
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
    compatibilityRules: { create: [] },
    productionRules: {
      create: [
        { workingDays: 2, cutoff: '14:00', priority: 0 },
        { condition: { express: '1' }, workingDays: 1, cutoff: '14:00', priority: 10 },
      ],
    },
    upsells: { create: [] },
  };
}

/** ДЕМО-прайс баннеров (копейки): база за м² по материалам + люверсы + подшив + экспресс. */
export function bannerDemoPriceRulesCreate() {
  return {
    create: [
      { kind: 'BASE_PER_SQM' as const, amountMinor: 45000, sortOrder: 0 },
      { kind: 'BASE_PER_SQM' as const, condition: { material: 'banner-510' }, amountMinor: 54000, sortOrder: 1 },
      { kind: 'BASE_PER_SQM' as const, condition: { material: 'satin' }, amountMinor: 60750, sortOrder: 2 },
      { kind: 'BASE_PER_SQM' as const, condition: { material: 'mesh' }, amountMinor: 49500, sortOrder: 3 },
      { kind: 'BASE_PER_SQM' as const, condition: { material: 'pvc-self-adhesive' }, amountMinor: 63000, sortOrder: 4 },
      {
        kind: 'SURCHARGE_PER_INTERVAL_COUNT' as const,
        condition: { lugs: ['with', 'custom'] },
        amountMinor: 1500, // 15 ₽/люверс — из примера ТЗ §15.12 (demo)
        config: {
          sourceMetric: 'perimeter',
          interval: 0.5,
          intervalParam: 'lugstep',
          intervalUnit: 'cm',
          rounding: 'CEIL',
          perItem: true,
        },
        sortOrder: 10,
      },
      {
        kind: 'SURCHARGE_PER_LENGTH' as const,
        condition: { hem: 'basic' },
        amountMinor: 8000, // 80 ₽/м — demo-допущение (ставки в ТЗ нет)
        config: { sourceMetric: 'perimeter', unit: 'm', perItem: true },
        sortOrder: 11,
      },
      {
        kind: 'SURCHARGE_PER_LENGTH' as const,
        condition: { hem: 'thick' },
        amountMinor: 15000, // 150 ₽/м — demo-допущение
        config: { sourceMetric: 'perimeter', unit: 'm', perItem: true },
        sortOrder: 12,
      },
      { kind: 'MULTIPLIER' as const, condition: { express: '1' }, multiplier: 1.25, sortOrder: 20 },
    ],
  };
}
