/**
 * Демо-данные 6 размерных калькуляторов партии C3 — data-driven.
 *
 * СТРУКТУРА (параметры/размеры/материалы/обработки/зависимости) — строго по
 * `ТЗ_калькуляторы.md` (разделы указаны в каждом spec). Механика:
 *  - canvas/poster/foam/interior/presswall → AREA (площадь × ₽/м²), эталон
 *    banner-print (prisma/demo/banner-demo.ts): pricingMode AREA + config.metrics
 *    (AREA), BASE_PER_SQM (условие по материалу), MULTIPLIER/SURCHARGE_PER_UNIT,
 *    QTY_DISCOUNT, express-множитель. Люверсов/подшива у C3 нет — проще banner;
 *  - rollup → фиксированные размеры (ТЗ §12: OPTION, не свободный DIMENSION) →
 *    механика TIER (переиспользуем tier-calculators-demo).
 *
 * ₽-надбавки, ЯВНО указанные в ТЗ (петля +30 ₽, скидка от 3 шт. −5 %, экспресс
 * +25…40 %), перенесены как бизнес-данные. ₽/м² и прочие коэффициенты — DEMO
 * (синтетические детерминированные либо из прототипа frontend): прайс только
 * isDemo. Боевых цен заказчик не давал.
 *
 * ТЗ 3.5 «Постеры/плакаты» — одна услуга; варианты /chertezhi/, /afishi-postery/
 * — те же definition + preset (ТЗ не выделяет их в отдельные разделы).
 */
import type { Prisma } from '@prisma/client';
import { tierDefinitionCreate, tierDemoPriceRulesCreate, type TierSpec } from './tier-calculators-demo';

const rub = (v: number) => Math.round(v * 100);

interface AreaOpt { v: string; l: string; def?: boolean; coeff?: number; perUnit?: number; sqm?: number }
interface AreaParam { key: string; label: string; type: 'SEGMENTED' | 'SWATCH'; opts: AreaOpt[]; visibleIf?: Record<string, string> }

export interface AreaSpec {
  code: string; title: string; slug: string; category: string; tz: string;
  unit: 'cm' | 'm';
  wMin: number; wMax: number; hMin: number; hMax: number; step: number; defW: string; defH: string;
  maxSqm: number;
  /** Параметр материала: варианты несут ₽/м² (BASE_PER_SQM по условию). */
  material?: { key: string; label: string; type: 'SEGMENTED' | 'SWATCH'; opts: AreaOpt[] };
  /** Базовая ₽/м² (для дефолтного материала / когда материала нет). */
  baseSqm: number;
  /** Прочие опции (подрамник/толщина/ламинация/конструкция/загиб). */
  options?: AreaParam[];
  express?: { coeff: number; days: number };
  qtyDiscount?: { from: number; coeff: number };
  minQty: number; maxQty: number; defaultQty: number; productionDays: number;
  demoComment: string;
}

export const CAT_PHOTO = 'fotopechat';
export const CAT_WIDE = 'shirokoformat';

export const AREA_SPECS: AreaSpec[] = [
  {
    code: 'poster-print', title: 'Постеры и плакаты (демо)', slug: 'postery-i-plakaty', category: CAT_PHOTO, tz: '3.5',
    unit: 'cm', wMin: 20, wMax: 150, hMin: 20, hMax: 150, step: 1, defW: '42', defH: '59', maxSqm: 3,
    baseSqm: 1200,
    material: { key: 'paper', label: 'Бумага', type: 'SWATCH', opts: [
      { v: 'poster-130', l: 'Постерная 130 г', def: true, sqm: 1200 },
      { v: 'matte-photo', l: 'Матовая фото', sqm: 1700 },
      { v: 'glossy-photo', l: 'Глянцевая фото', sqm: 1800 },
    ] },
    express: { coeff: 1.3, days: 1 },
    minQty: 1, maxQty: 100, defaultQty: 1, productionDays: 1,
    demoComment: 'ДЕМО-прайс постеров (₽/м² синтетический). Структура — ТЗ п.3.5.',
  },
  {
    code: 'canvas-print', title: 'Печать на холсте (демо)', slug: 'pechat-na-holste', category: CAT_PHOTO, tz: '3.4',
    unit: 'cm', wMin: 20, wMax: 100, hMin: 20, hMax: 120, step: 1, defW: '40', defH: '60', maxSqm: 1.2,
    baseSqm: 2500,
    options: [
      { key: 'subframe', label: 'Подрамник', type: 'SEGMENTED', opts: [
        { v: 'without', l: 'Без (рулон)', coeff: 0.85 }, { v: 'with', l: 'Стандартный 3 см', def: true },
        { v: 'thick', l: 'Толстый 4 см', coeff: 1.2 } ] },
      { key: 'edge', label: 'Загиб', type: 'SEGMENTED', opts: [
        { v: 'mirror', l: 'Зеркальный', def: true }, { v: 'white', l: 'Белый' },
        { v: 'black', l: 'Чёрный' }, { v: 'color-continuation', l: 'Продолжение изображения', coeff: 1.1 } ] },
    ],
    // ТЗ 3.4: от 3 шт. — скидка 5 % (QTY_DISCOUNT). Базовое покрытие тиража даёт
    // BASE_PER_SQM, поэтому скидочный порог валиден без BASE_TIER-лестницы.
    qtyDiscount: { from: 3, coeff: 0.95 },
    express: { coeff: 1.3, days: 1 },
    minQty: 1, maxQty: 50, defaultQty: 1, productionDays: 3,
    demoComment: 'ДЕМО-прайс холста (₽/м² синтетический). Скидка от 3 шт. −5 % — ТЗ п.3.4.',
  },
  {
    code: 'foam-board', title: 'Накатка на пенокартон (демо)', slug: 'nakatka-na-penokarton', category: CAT_PHOTO, tz: '3.6',
    unit: 'cm', wMin: 20, wMax: 150, hMin: 20, hMax: 150, step: 1, defW: '42', defH: '59', maxSqm: 3,
    baseSqm: 1600,
    material: { key: 'paper', label: 'Бумага', type: 'SWATCH', opts: [
      { v: 'poster-130', l: 'Постерная 130 г', def: true, sqm: 1600 },
      { v: 'matte-photo', l: 'Матовая фото', sqm: 2100 },
      { v: 'glossy-photo', l: 'Глянцевая фото', sqm: 2200 },
    ] },
    options: [
      { key: 'thickness', label: 'Толщина', type: 'SEGMENTED', opts: [
        { v: '3mm', l: '3 мм', def: true }, { v: '5mm', l: '5 мм', coeff: 1.3 }, { v: '10mm', l: '10 мм', coeff: 1.6 } ] },
      { key: 'loop', label: 'Петля для подвески', type: 'SEGMENTED', opts: [
        { v: 'no', l: 'Без', def: true }, { v: 'yes', l: 'С петлёй', perUnit: 30 } ] },
    ],
    express: { coeff: 1.3, days: 1 },
    minQty: 1, maxQty: 100, defaultQty: 1, productionDays: 2,
    demoComment: 'ДЕМО-прайс пенокартона (₽/м² синтетический). Петля +30 ₽/шт — ТЗ п.3.6.',
  },
  {
    code: 'presswall', title: 'Press Wall / Фотостена (демо)', slug: 'press-wall', category: CAT_WIDE, tz: '4.3',
    unit: 'm', wMin: 1, wMax: 6, hMin: 1, hMax: 3, step: 0.5, defW: '3', defH: '2.4', maxSqm: 18,
    baseSqm: 650,
    material: { key: 'material', label: 'Материал', type: 'SWATCH', opts: [
      { v: 'banner-440', l: 'Баннер 440 г', def: true, sqm: 650 }, { v: 'satin', l: 'Сатин (ткань)', sqm: 850 } ] },
    options: [
      { key: 'construction', label: 'Конструкция', type: 'SEGMENTED', opts: [
        { v: 'print-only', l: 'Только печать', def: true }, { v: 'with-frame', l: 'С каркасом', perUnit: 12000 },
        { v: 'with-frame-bag', l: 'Каркас + сумка', perUnit: 15000 } ] },
    ],
    minQty: 1, maxQty: 20, defaultQty: 1, productionDays: 3,
    demoComment: 'ДЕМО-прайс press-wall (₽/м² из прототипа; каркас — синтетический). Структура — ТЗ п.4.3.',
  },
  {
    code: 'interior-print', title: 'Интерьерная печать (демо)', slug: 'interyernaya-pechat', category: CAT_WIDE, tz: '4.4',
    unit: 'cm', wMin: 20, wMax: 300, hMin: 20, hMax: 300, step: 1, defW: '100', defH: '100', maxSqm: 9,
    baseSqm: 900,
    material: { key: 'material', label: 'Материал', type: 'SWATCH', opts: [
      { v: 'self-adhesive-matte', l: 'Самоклейка матовая', def: true, sqm: 900 },
      { v: 'self-adhesive-gloss', l: 'Самоклейка глянцевая', sqm: 950 },
      { v: 'self-adhesive-wall', l: 'Настенная самоклейка', sqm: 1100 },
      { v: 'canvas', l: 'Холст', sqm: 1400 },
      { v: 'backlit-film', l: 'Backlit-плёнка', sqm: 1600 },
    ] },
    options: [
      { key: 'lamination', label: 'Ламинация', type: 'SWATCH', opts: [
        { v: 'none', l: 'Без', def: true }, { v: 'matte-lam', l: 'Матовая', coeff: 1.15 }, { v: 'gloss-lam', l: 'Глянцевая', coeff: 1.15 } ] },
    ],
    express: { coeff: 1.3, days: 1 },
    minQty: 1, maxQty: 50, defaultQty: 1, productionDays: 2,
    demoComment: 'ДЕМО-прайс интерьерной печати (₽/м² из прототипа/синтетика). Цена по площади — ТЗ п.4.4.',
  },
];

/** Rollup — фиксированные размеры (ТЗ §12 → OPTION), механика TIER. */
export const ROLLUP_SPEC: TierSpec = {
  code: 'rollup', title: 'Стенды Roll Up (демо)', slug: 'roll-up', category: CAT_WIDE, tz: '4.2',
  minQty: 1, maxQty: 100, qtyStep: 1, defaultQty: 1, productionDays: 3,
  urlOrder: ['width', 'height', 'kit', 'qty', 'express'],
  params: [
    { key: 'width', label: 'Ширина стенда', type: 'SEGMENTED', opts: [
      { v: '60cm', l: '60 см', coeff: 0.8 }, { v: '80cm', l: '80 см', def: true }, { v: '100cm', l: '100 см', coeff: 1.25 },
      { v: '120cm', l: '120 см', coeff: 1.5 }, { v: '150cm', l: '150 см', coeff: 1.9 } ] },
    { key: 'height', label: 'Высота полотна', type: 'SEGMENTED', opts: [
      { v: '200cm', l: '200 см', def: true }, { v: '220cm', l: '220 см', coeff: 1.1 } ] },
    { key: 'kit', label: 'Комплектация', type: 'SEGMENTED', opts: [
      { v: 'print-only', l: 'Только полотно', coeff: 0.5 }, { v: 'with-stand', l: 'С механизмом', def: true },
      { v: 'with-bag', l: 'С механизмом и сумкой', coeff: 1.1 }, { v: 'premium', l: 'Premium', coeff: 1.6 } ] },
  ],
  tiers: [[1, 2500], [3, 2300], [5, 2100], [10, 1900]],
  express: { coeff: 1.4, days: 1 },
  demoComment: 'ДЕМО-прайс roll-up (синтетический). Фиксированные размеры/комплектация — ТЗ п.4.2.',
};

/** Rollup через tier-фабрику (та же механика, что у C2 TIER). */
export function rollupDefinitionCreate(version: number) { return tierDefinitionCreate(ROLLUP_SPEC, version); }
export function rollupDemoPriceRulesCreate() { return tierDemoPriceRulesCreate(ROLLUP_SPEC); }

/** AREA-definition: pricingMode AREA + метрика площади + DIMENSION w/h + материал/опции. */
export function areaDefinitionCreate(spec: AreaSpec, version: number) {
  const params: Record<string, unknown>[] = [
    { urlKey: 'w', label: 'Ширина', type: 'DIMENSION', sortOrder: 0, unit: spec.unit === 'm' ? 'м' : 'см', minValue: spec.wMin, maxValue: spec.wMax, stepValue: spec.step, defaultValue: spec.defW, config: { unit: spec.unit } },
    { urlKey: 'h', label: 'Высота', type: 'DIMENSION', sortOrder: 1, unit: spec.unit === 'm' ? 'м' : 'см', minValue: spec.hMin, maxValue: spec.hMax, stepValue: spec.step, defaultValue: spec.defH, config: { unit: spec.unit } },
  ];
  let so = 2;
  const optParam = (key: string, label: string, type: string, opts: AreaOpt[], visibleIf?: Record<string, string>) => ({
    urlKey: key, label, type, sortOrder: so++,
    ...(visibleIf ? { visibleIf } : {}),
    options: { create: opts.map((o, j) => ({ value: o.v, label: o.l, isDefault: !!o.def, sortOrder: j })) },
  });
  if (spec.material) params.push(optParam(spec.material.key, spec.material.label, spec.material.type, spec.material.opts));
  for (const p of spec.options ?? []) params.push(optParam(p.key, p.label, p.type, p.opts, p.visibleIf));
  if (spec.express) params.push({ urlKey: 'express', label: 'Срочное изготовление', type: 'TOGGLE', sortOrder: so++, isRequired: false, defaultValue: '0' });

  const production: Record<string, unknown>[] = [{ workingDays: spec.productionDays, priority: 0 }];
  if (spec.express) production.push({ condition: { express: '1' }, workingDays: spec.express.days, priority: 10 });

  return {
    code: spec.code, title: spec.title, version, pricingMode: 'AREA',
    urlOrder: [...['w', 'h', spec.material?.key, ...(spec.options ?? []).map((p) => p.key)].filter(Boolean), 'qty', ...(spec.express ? ['express'] : [])],
    minQty: spec.minQty, maxQty: spec.maxQty, qtyStep: 1, defaultQty: spec.defaultQty,
    config: {
      area: { unit: spec.unit, maxSqm: spec.maxSqm },
      metrics: [{ kind: 'AREA', code: 'area', label: 'Площадь', widthParam: 'w', heightParam: 'h', unit: spec.unit }],
    },
    parameters: { create: params },
    productionRules: { create: production },
  } as unknown as Omit<Prisma.CalculatorDefinitionCreateInput, 'isDemo' | 'status' | 'priceLists'>;
}

/** AREA-прайс: BASE_PER_SQM (+условие по материалу) + опции + скидка + экспресс. */
export function areaDemoPriceRulesCreate(spec: AreaSpec) {
  const rules: Record<string, unknown>[] = [{ kind: 'BASE_PER_SQM', amountMinor: rub(spec.baseSqm), sortOrder: 0 }];
  let so = 1;
  const material = spec.material;
  if (material) {
    for (const o of material.opts) {
      if (o.sqm !== undefined && !o.def) rules.push({ kind: 'BASE_PER_SQM', condition: { [material.key]: o.v }, amountMinor: rub(o.sqm), sortOrder: so++ });
    }
  }
  so = 100;
  for (const p of spec.options ?? []) {
    for (const o of p.opts) {
      if (o.coeff !== undefined && o.coeff !== 1) rules.push({ kind: 'MULTIPLIER', condition: { [p.key]: o.v }, multiplier: o.coeff, sortOrder: so++ });
      if (o.perUnit !== undefined) rules.push({ kind: 'SURCHARGE_PER_UNIT', condition: { [p.key]: o.v }, amountMinor: rub(o.perUnit), sortOrder: so++ });
    }
  }
  if (spec.qtyDiscount) rules.push({ kind: 'QTY_DISCOUNT', qtyFrom: spec.qtyDiscount.from, multiplier: spec.qtyDiscount.coeff, sortOrder: so++ });
  if (spec.express) rules.push({ kind: 'MULTIPLIER', condition: { express: '1' }, multiplier: spec.express.coeff, sortOrder: so++ });
  return { create: rules } as unknown as Prisma.PriceRuleUncheckedCreateNestedManyWithoutPriceListInput;
}
