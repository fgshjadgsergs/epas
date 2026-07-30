/**
 * Демо-данные 12 TIER-калькуляторов партии C2 — data-driven, чтобы не плодить
 * по файлу на услугу.
 *
 * СТРУКТУРА (параметры/варианты/зависимости/qty/обработки) — строго по
 * `ТЗ_калькуляторы.md` (главный источник истины, разделы указаны в каждом
 * spec). ₽-надбавки и %-модификаторы, ЯВНО заданные в ТЗ (конверт c6=+8,
 * тиснение +15 %, экспресс +40 % и т. п.), перенесены как бизнес-данные.
 *
 * ЦЕНЫ БАЗОВЫХ ТИРАЖЕЙ (BASE_TIER) и неоговорённые в ТЗ коэффициенты —
 * ДЕМОНСТРАЦИОННЫЕ (числа прежнего frontend-прототипа more.ts/more2.ts):
 * прайс создаётся только как isDemo. Боевых цен заказчик не давал.
 *
 * НЕ вошли (нет раздела в ТЗ_калькуляторы.md → не выдумываем): «фото-календари»
 * (/kalendari/foto/), «планинги» (/kalendari/planingi/) — TZ_ABSENT.
 */
import type { Prisma } from '@prisma/client';

// ₽ → копейки.
const rub = (v: number) => Math.round(v * 100);

type PType = 'SEGMENTED' | 'SWATCH' | 'TOGGLE' | 'DIMENSION' | 'MULTI_QTY';

interface Opt {
  v: string;
  l: string;
  def?: boolean;
  /** Коэффициент к цене (MULTIPLIER) при выборе этого варианта. */
  coeff?: number;
  /** Надбавка за штуку, ₽ (SURCHARGE_PER_UNIT). */
  perUnit?: number;
}

interface Param {
  key: string;
  label: string;
  type: PType;
  opts?: Opt[];
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  default?: string;
  visibleIf?: Record<string, string>;
  /**
   * Настройки MULTI_QTY-параметра (таблица «ключ → количество», напр. размеры
   * футболок ТЗ 8.1). Тираж = сумма строк; тариф — по общему тиражу (BASE_TIER).
   */
  multiQty?: { lineMin?: number; lineMax?: number; lineStep?: number; totalMin?: number; totalMax?: number };
}

interface Upsell {
  code: string;
  label: string;
  kind: 'FLAT' | 'PER_UNIT';
  /** Сумма в ₽. */
  amount: number;
}

export interface TierSpec {
  code: string;
  title: string;
  slug: string;
  category: string;
  tz: string;
  minQty: number;
  maxQty: number;
  qtyStep: number;
  defaultQty: number;
  productionDays: number;
  urlOrder: string[];
  params: Param[];
  /** [qtyFrom, ценаЗаШтуку₽] по возрастанию тиража. */
  tiers: [number, number][];
  express?: { coeff: number; days: number; maxQty?: number };
  upsells?: Upsell[];
  /** MIN_QTY-совместимость: при when → минимальный тираж. */
  minQtyRules?: { when: Record<string, string>; minQty: number }[];
  /**
   * DISABLE_OPTIONS-совместимость: при when варианты `param` недоступны —
   * backend отклоняет комбинацию (422). Пример: страницы по типу переплёта
   * (ТЗ 2.3 staple 4–48 / spiral 8–400 / thermo 40–800).
   */
  disableRules?: { when: Record<string, string | string[]>; param: string; options: string[]; message: string }[];
  /**
   * Скидка от тиража: QTY_DISCOUNT-модификатор (семантика C3). Один или
   * несколько порогов (напр. фотокниги ТЗ 3.2: от 2 шт. −5 %, от 5 шт. −10 %);
   * диапазоны qtyFrom/qtyTo выставляются по возрастанию from.
   */
  qtyDiscount?: { from: number; coeff: number } | { from: number; coeff: number }[];
  /**
   * Производный тираж: qty = произведение перечисленных целочисленных
   * параметров (ТЗ 2.2 копирование «оригиналы × копии»). Пользователь тираж
   * не вводит — его выводит сервер (config.quantityFrom).
   */
  quantityFrom?: string[];
  demoComment: string;
}

/** Общий каталог-контекст: category slug для каждой услуги. */
export const CAT_POLYGRAPHY = 'operativnaya-poligrafiya';
export const CAT_STICKERS = 'naklejki';
export const CAT_CALENDARS = 'kalendari';

export const TIER_SPECS: TierSpec[] = [
  {
    code: 'booklets', title: 'Буклеты (демо)', slug: 'buklety', category: CAT_POLYGRAPHY, tz: '1.3',
    minQty: 100, maxQty: 50000, qtyStep: 100, defaultQty: 100, productionDays: 3,
    urlOrder: ['format', 'fold', 'paper', 'coating', 'qty', 'express'],
    params: [
      { key: 'format', label: 'Формат (развёрнутый)', type: 'SEGMENTED', opts: [
        { v: 'dl-trifold', l: 'Евро (DL)', coeff: 0.9 }, { v: 'a4-bifold', l: 'A4', def: true },
        { v: 'a4-trifold', l: 'A4 широкий', coeff: 1.1 }, { v: 'a5-bifold', l: 'A5', coeff: 0.8 } ] },
      { key: 'fold', label: 'Тип фальцовки', type: 'SEGMENTED', opts: [
        { v: 'bifold', l: '1 фальц', def: true }, { v: 'trifold', l: '2 фальца', coeff: 1.05 },
        { v: 'gatefold', l: 'Воротами', coeff: 1.15 }, { v: 'zfold', l: 'Гармошка', coeff: 1.05 } ] },
      { key: 'paper', label: 'Бумага', type: 'SWATCH', opts: [
        { v: 'coated-115', l: 'Мелованная 115 г', coeff: 0.9 }, { v: 'coated-150', l: 'Мелованная 150 г', def: true },
        { v: 'coated-200', l: 'Мелованная 200 г', coeff: 1.15 }, { v: 'design', l: 'Дизайнерская', coeff: 1.25 } ] },
      { key: 'coating', label: 'Покрытие', type: 'SWATCH', opts: [
        { v: 'none', l: 'Без', def: true }, { v: 'matte-lam', l: 'Матовая', coeff: 1.1 },
        { v: 'gloss-lam', l: 'Глянцевая', coeff: 1.1 }, { v: 'soft-touch', l: 'Soft Touch', coeff: 1.2 } ] },
    ],
    tiers: [[100, 28], [500, 16], [1000, 11], [5000, 7], [10000, 5], [50000, 4]],
    express: { coeff: 1.4, days: 1, maxQty: 1000 },
    upsells: [{ code: 'design', label: 'Разработка дизайна (6 полос)', kind: 'FLAT', amount: 2500 },
      { code: 'glued-pocket', label: 'Клеевой кармашек', kind: 'PER_UNIT', amount: 4 }],
    demoComment: 'ДЕМО-прайс буклетов (базовые тиражи — прототип frontend). Структура — ТЗ п.1.3.',
  },
  {
    code: 'postcards', title: 'Открытки и приглашения (демо)', slug: 'otkrytki', category: CAT_POLYGRAPHY, tz: '1.4',
    minQty: 50, maxQty: 5000, qtyStep: 50, defaultQty: 100, productionDays: 2,
    urlOrder: ['format', 'w', 'h', 'paper', 'coating', 'foil', 'envelope', 'qty'],
    params: [
      { key: 'format', label: 'Формат', type: 'SEGMENTED', opts: [
        { v: '148x105', l: '148×105', def: true }, { v: '150x150', l: '150×150', coeff: 1.2 },
        { v: '210x99', l: '210×99', coeff: 1.1 }, { v: '210x148', l: '210×148', coeff: 1.4 },
        { v: 'custom', l: 'Свой размер', coeff: 1.3 } ] },
      { key: 'w', label: 'Ширина', type: 'DIMENSION', unit: 'мм', min: 90, max: 300, step: 1, default: '148', visibleIf: { format: 'custom' } },
      { key: 'h', label: 'Высота', type: 'DIMENSION', unit: 'мм', min: 90, max: 300, step: 1, default: '105', visibleIf: { format: 'custom' } },
      { key: 'paper', label: 'Бумага', type: 'SWATCH', opts: [
        { v: 'coated-300', l: 'Мелованная 300 г' }, { v: 'coated-350', l: 'Мелованная 350 г', def: true },
        { v: 'design', l: 'Дизайнерская', coeff: 1.25 } ] },
      { key: 'coating', label: 'Покрытие', type: 'SWATCH', opts: [
        { v: 'none', l: 'Без' }, { v: 'matte-lam', l: 'Матовая', def: true },
        { v: 'gloss-lam', l: 'Глянцевая' }, { v: 'soft-touch', l: 'Soft Touch', coeff: 1.2 } ] },
      { key: 'foil', label: 'Тиснение фольгой', type: 'SEGMENTED', opts: [
        { v: 'no', l: 'Без', def: true }, { v: 'yes', l: 'С тиснением', coeff: 1.15 } ] },
      { key: 'envelope', label: 'Конверт', type: 'SEGMENTED', opts: [
        { v: 'none', l: 'Без конверта', def: true }, { v: 'c6', l: 'C6', perUnit: 8 }, { v: 'c5', l: 'C5', perUnit: 12 } ] },
    ],
    tiers: [[50, 20], [100, 14], [500, 7], [1000, 5], [5000, 3.5]],
    demoComment: 'ДЕМО-прайс открыток. Надбавки конверта/тиснения — из ТЗ п.1.4; базовые тиражи — демо.',
  },
  {
    code: 'certificates', title: 'Сертификаты и дипломы (демо)', slug: 'sertifikaty', category: CAT_POLYGRAPHY, tz: '1.5',
    minQty: 10, maxQty: 5000, qtyStep: 1, defaultQty: 50, productionDays: 2,
    urlOrder: ['format', 'w', 'h', 'paper', 'color', 'coating', 'emboss', 'qty', 'express'],
    params: [
      { key: 'format', label: 'Формат', type: 'SEGMENTED', opts: [
        { v: 'A4', l: 'A4', def: true }, { v: 'A5', l: 'A5', coeff: 0.7 }, { v: 'custom', l: 'Свой размер', coeff: 1.2 } ] },
      { key: 'w', label: 'Ширина', type: 'DIMENSION', unit: 'мм', min: 100, max: 300, step: 1, default: '210', visibleIf: { format: 'custom' } },
      { key: 'h', label: 'Высота', type: 'DIMENSION', unit: 'мм', min: 100, max: 300, step: 1, default: '297', visibleIf: { format: 'custom' } },
      { key: 'paper', label: 'Бумага', type: 'SWATCH', opts: [
        { v: 'design-200', l: 'Дизайнерская 200 г', def: true }, { v: 'coated-300', l: 'Мелованная 300 г', coeff: 0.9 },
        { v: 'offset-160', l: 'Офсетная 160 г', coeff: 0.8 } ] },
      { key: 'color', label: 'Цветность', type: 'SEGMENTED', opts: [
        { v: '4+0', l: 'Цветная (4+0)', def: true }, { v: '1+0', l: 'Ч/б (1+0)', coeff: 0.6 } ] },
      { key: 'coating', label: 'Покрытие', type: 'SWATCH', opts: [
        { v: 'none', l: 'Без', def: true }, { v: 'matte-lam', l: 'Матовая', coeff: 1.1 },
        { v: 'gloss-lam', l: 'Глянцевая', coeff: 1.1 }, { v: 'uv-gloss', l: 'UV-лак', coeff: 1.2 } ] },
      { key: 'emboss', label: 'Тиснение / голография', type: 'SWATCH', opts: [
        { v: 'none', l: 'Без', def: true }, { v: 'gold', l: 'Золото', coeff: 1.2 },
        { v: 'silver', l: 'Серебро', coeff: 1.2 }, { v: 'holographic', l: 'Голография', coeff: 1.2 } ] },
    ],
    tiers: [[10, 80], [50, 45], [100, 32], [500, 22], [1000, 16], [5000, 12]],
    express: { coeff: 1.5, days: 1, maxQty: 50 },
    upsells: [{ code: 'frame-simple', label: 'Рамка деревянная', kind: 'PER_UNIT', amount: 350 },
      { code: 'design', label: 'Разработка дизайна', kind: 'FLAT', amount: 800 }],
    demoComment: 'ДЕМО-прайс сертификатов. Тиснение +20 % — из ТЗ п.1.5; базовые тиражи — демо.',
  },
  {
    code: 'badges-blanks', title: 'Бирки, бейджи, бланки (демо)', slug: 'birki-bejdzi-blanki', category: CAT_POLYGRAPHY, tz: '1.6',
    minQty: 10, maxQty: 50000, qtyStep: 1, defaultQty: 50, productionDays: 3,
    urlOrder: ['subtype', 'tagFormat', 'tagPaper', 'tagFix', 'tagColor', 'badgeMaterial', 'badgeFormat', 'badgeFill', 'blankFormat', 'blankPaper', 'blankColor', 'blankNumbering', 'qty'],
    params: [
      { key: 'subtype', label: 'Подтип', type: 'SEGMENTED', opts: [
        { v: 'tags', l: 'Бирки' }, { v: 'badges', l: 'Бейджи', def: true, coeff: 1.2 }, { v: 'blanks', l: 'Бланки', coeff: 0.7 } ] },
      { key: 'tagFormat', label: 'Формат бирки', type: 'SEGMENTED', visibleIf: { subtype: 'tags' }, opts: [
        { v: '50x90', l: '50×90', def: true }, { v: '55x85', l: '55×85' }, { v: '40x70', l: '40×70', coeff: 0.85 }, { v: 'custom', l: 'Свой размер', coeff: 1.2 } ] },
      { key: 'tagPaper', label: 'Бумага бирки', type: 'SWATCH', visibleIf: { subtype: 'tags' }, opts: [
        { v: 'coated-300', l: 'Мелованная 300 г', def: true }, { v: 'design-200', l: 'Дизайнерская 200 г', coeff: 1.3 }, { v: 'kraft', l: 'Крафт', coeff: 1.1 } ] },
      { key: 'tagFix', label: 'Крепление бирки', type: 'SEGMENTED', visibleIf: { subtype: 'tags' }, opts: [
        { v: 'none', l: 'Без', def: true }, { v: 'hole', l: 'Отверстие' }, { v: 'hole-ribbon', l: 'Отверстие + лента', perUnit: 5 } ] },
      { key: 'tagColor', label: 'Цветность бирки', type: 'SEGMENTED', visibleIf: { subtype: 'tags' }, opts: [
        { v: '4+0', l: '4+0', def: true }, { v: '4+4', l: '4+4', coeff: 1.4 }, { v: '1+0', l: '1+0', coeff: 0.6 } ] },
      { key: 'badgeMaterial', label: 'Материал бейджа', type: 'SWATCH', visibleIf: { subtype: 'badges' }, opts: [
        { v: 'rigid-paper', l: 'Плотная бумага', coeff: 0.8 }, { v: 'plastic-pvc', l: 'Пластик PVC', def: true }, { v: 'soft-pvc', l: 'Мягкий PVC', coeff: 1.2 } ] },
      { key: 'badgeFormat', label: 'Формат бейджа', type: 'SEGMENTED', visibleIf: { subtype: 'badges' }, opts: [
        { v: '90x60', l: '90×60', def: true }, { v: '85x55', l: '85×55', coeff: 0.95 }, { v: '105x70', l: '105×70', coeff: 1.2 }, { v: 'custom', l: 'Свой размер', coeff: 1.25 } ] },
      { key: 'badgeFill', label: 'Наполнение бейджа', type: 'SEGMENTED', visibleIf: { subtype: 'badges' }, opts: [
        { v: 'print-only', l: 'Только печать', def: true }, { v: 'with-holder', l: 'С держателем', perUnit: 15 }, { v: 'with-clip', l: 'С клипсой', perUnit: 20 } ] },
      { key: 'blankFormat', label: 'Формат бланка', type: 'SEGMENTED', visibleIf: { subtype: 'blanks' }, opts: [
        { v: 'A4', l: 'A4', def: true }, { v: 'A5', l: 'A5', coeff: 0.7 }, { v: 'A6', l: 'A6', coeff: 0.5 } ] },
      { key: 'blankPaper', label: 'Бумага бланка', type: 'SWATCH', visibleIf: { subtype: 'blanks' }, opts: [
        { v: 'offset-80', l: 'Офсет 80 г', def: true }, { v: 'offset-120', l: 'Офсет 120 г', coeff: 1.2 }, { v: 'coated-150', l: 'Мелованная 150 г', coeff: 1.35 } ] },
      { key: 'blankColor', label: 'Цветность бланка', type: 'SEGMENTED', visibleIf: { subtype: 'blanks' }, opts: [
        { v: '4+0', l: '4+0', def: true }, { v: '1+0', l: '1+0', coeff: 0.5 } ] },
      { key: 'blankNumbering', label: 'Нумерация', type: 'SEGMENTED', visibleIf: { subtype: 'blanks' }, opts: [
        { v: 'no', l: 'Без нумерации', def: true }, { v: 'yes', l: 'С нумерацией', perUnit: 5 } ] },
    ],
    tiers: [[10, 90], [50, 55], [100, 40], [500, 28], [1000, 20], [5000, 14], [10000, 10], [50000, 8]],
    minQtyRules: [{ when: { subtype: 'tags' }, minQty: 50 }, { when: { subtype: 'blanks' }, minQty: 100 }],
    demoComment: 'ДЕМО-прайс бирок/бейджей/бланков. Надбавки крепления/держателя/нумерации — из ТЗ п.1.6.',
  },
  {
    code: 'menu', title: 'Меню для ресторанов (демо)', slug: 'menyu', category: CAT_POLYGRAPHY, tz: '1.7',
    minQty: 10, maxQty: 1000, qtyStep: 1, defaultQty: 50, productionDays: 4,
    urlOrder: ['type', 'format', 'w', 'h', 'pages', 'binding', 'paper', 'coating', 'qty', 'express'],
    params: [
      { key: 'type', label: 'Тип', type: 'SEGMENTED', opts: [
        { v: 'card', l: 'Карта', def: true }, { v: 'booklet', l: 'Буклет', coeff: 1.6 }, { v: 'folder', l: 'Папка', coeff: 2 } ] },
      { key: 'format', label: 'Формат', type: 'SEGMENTED', opts: [
        { v: 'A4', l: 'A4', def: true }, { v: 'A5', l: 'A5', coeff: 0.7 }, { v: 'custom', l: 'Свой размер', coeff: 1.2 } ] },
      { key: 'w', label: 'Ширина', type: 'DIMENSION', unit: 'мм', min: 100, max: 320, step: 1, default: '210', visibleIf: { format: 'custom' } },
      { key: 'h', label: 'Высота', type: 'DIMENSION', unit: 'мм', min: 100, max: 450, step: 1, default: '297', visibleIf: { format: 'custom' } },
      { key: 'pages', label: 'Кол-во страниц', type: 'SEGMENTED', visibleIf: { type: 'booklet' }, opts: [
        { v: '8', l: '8', def: true }, { v: '12', l: '12', coeff: 1.3 }, { v: '16', l: '16', coeff: 1.6 },
        { v: '24', l: '24', coeff: 2.1 }, { v: '32', l: '32', coeff: 2.6 }, { v: '48', l: '48', coeff: 3.4 }, { v: '64', l: '64', coeff: 4.2 } ] },
      { key: 'binding', label: 'Переплёт', type: 'SEGMENTED', visibleIf: { type: 'booklet' }, opts: [
        { v: 'staple', l: 'Скрепка', def: true }, { v: 'wire', l: 'Пружина', coeff: 1.2 }, { v: 'soft-cover', l: 'Мягкий переплёт', coeff: 1.5 } ] },
      { key: 'paper', label: 'Бумага блока', type: 'SWATCH', opts: [
        { v: 'coated-115', l: 'Мелованная 115 г', coeff: 0.85 }, { v: 'coated-200', l: 'Мелованная 200 г', def: true } ] },
      { key: 'coating', label: 'Покрытие', type: 'SWATCH', opts: [
        { v: 'none', l: 'Без' }, { v: 'matte-lam', l: 'Матовая' }, { v: 'gloss-lam', l: 'Глянцевая' }, { v: 'soft-touch', l: 'Soft Touch', def: true, coeff: 1.2 } ] },
    ],
    tiers: [[10, 180], [50, 90], [100, 65], [500, 45], [1000, 35]],
    express: { coeff: 1.4, days: 2, maxQty: 25 },
    demoComment: 'ДЕМО-прайс меню. Структура (тип/страницы/переплёт) — ТЗ п.1.7; базовые тиражи — демо.',
  },
  {
    code: 'stickers', title: 'Наклейки и стикерпаки (демо)', slug: 'pechat', category: CAT_STICKERS, tz: '5.1',
    minQty: 1, maxQty: 100000, qtyStep: 1, defaultQty: 100, productionDays: 1,
    urlOrder: ['type', 'shape', 'size', 'sheetFormat', 'material', 'qty', 'express'],
    params: [
      { key: 'type', label: 'Тип', type: 'SEGMENTED', opts: [
        { v: 'sheet', l: 'На листе' }, { v: 'cut', l: 'Вырубные', def: true }, { v: 'sticker-pack', l: 'Стикерпак', coeff: 1.2 } ] },
      { key: 'shape', label: 'Форма вырубки', type: 'SEGMENTED', visibleIf: { type: 'cut' }, opts: [
        { v: 'circle', l: 'Круг', def: true }, { v: 'square', l: 'Квадрат' }, { v: 'rectangle', l: 'Прямоугольник' }, { v: 'oval', l: 'Овал' }, { v: 'contour', l: 'По контуру', coeff: 1.3 } ] },
      { key: 'size', label: 'Размер', type: 'DIMENSION', unit: 'мм', min: 20, max: 200, step: 5, default: '50' },
      { key: 'sheetFormat', label: 'Формат листа', type: 'SEGMENTED', visibleIf: { type: 'sticker-pack' }, opts: [
        { v: 'A6', l: 'A6', coeff: 0.7 }, { v: 'A5', l: 'A5', def: true }, { v: 'A4', l: 'A4', coeff: 1.5 } ] },
      { key: 'material', label: 'Материал', type: 'SWATCH', opts: [
        { v: 'paper-gloss', l: 'Бумага глянец', def: true }, { v: 'paper-matte', l: 'Бумага мат' },
        { v: 'film-white', l: 'Плёнка белая', coeff: 1.2 }, { v: 'film-transparent', l: 'Прозрачная', coeff: 1.3 }, { v: 'film-holographic', l: 'Голография', coeff: 1.5 } ] },
    ],
    tiers: [[1, 25], [10, 15], [50, 8], [100, 5], [500, 2.5], [1000, 1.8], [5000, 1.1]],
    express: { coeff: 1.3, days: 1 },
    minQtyRules: [{ when: { type: 'cut' }, minQty: 10 }],
    demoComment: 'ДЕМО-прайс наклеек. Типы/минимумы — ТЗ п.5.1; базовые тиражи — демо.',
  },
  {
    code: 'labels', title: 'Этикетки и бирки для одежды (демо)', slug: 'etiketki', category: CAT_STICKERS, tz: '5.2',
    minQty: 50, maxQty: 100000, qtyStep: 1, defaultQty: 500, productionDays: 2,
    urlOrder: ['type', 'width', 'height', 'material', 'tagMaterial', 'fix', 'qty'],
    params: [
      { key: 'type', label: 'Тип', type: 'SEGMENTED', opts: [
        { v: 'label-roll', l: 'Этикетки в рулоне', def: true }, { v: 'label-sheet', l: 'Этикетки на листе' },
        { v: 'clothing-tag', l: 'Бирки для одежды', coeff: 1.3 }, { v: 'barcode', l: 'Штрихкоды' } ] },
      { key: 'width', label: 'Ширина', type: 'DIMENSION', unit: 'мм', min: 15, max: 150, step: 1, default: '58' },
      { key: 'height', label: 'Высота', type: 'DIMENSION', unit: 'мм', min: 10, max: 100, step: 1, default: '40' },
      { key: 'material', label: 'Материал этикетки', type: 'SWATCH', opts: [
        { v: 'paper-white', l: 'Бумага белая', def: true }, { v: 'film-white', l: 'Плёнка белая', coeff: 1.3 }, { v: 'craft', l: 'Крафт', coeff: 1.1 } ] },
      { key: 'tagMaterial', label: 'Материал бирки', type: 'SWATCH', visibleIf: { type: 'clothing-tag' }, opts: [
        { v: 'coated-300', l: 'Мелованная 300 г', def: true }, { v: 'tyvek', l: 'Тайвек', coeff: 1.3 }, { v: 'plastic-pvc', l: 'Пластик PVC', coeff: 1.5 } ] },
      { key: 'fix', label: 'Крепление', type: 'SEGMENTED', visibleIf: { type: 'clothing-tag' }, opts: [
        { v: 'hole', l: 'Отверстие', def: true }, { v: 'hole-pin', l: 'Отверстие + пин', perUnit: 3 }, { v: 'self-adhesive', l: 'Самоклейка' } ] },
    ],
    tiers: [[50, 5], [100, 4], [500, 2], [1000, 1.3], [5000, 0.8], [10000, 0.5]],
    minQtyRules: [{ when: { type: 'label-roll' }, minQty: 100 }, { when: { type: 'barcode' }, minQty: 100 }],
    demoComment: 'ДЕМО-прайс этикеток. Типы/крепление/минимумы — ТЗ п.5.2; базовые тиражи — демо.',
  },
  {
    code: 'calendar-wall', title: 'Настенные перекидные календари (демо)', slug: 'nastennye', category: CAT_CALENDARS, tz: '6.1',
    minQty: 10, maxQty: 5000, qtyStep: 1, defaultQty: 50, productionDays: 5,
    urlOrder: ['format', 'w', 'h', 'sheets', 'binding', 'paper', 'coverCoating', 'year', 'qty'],
    params: [
      { key: 'format', label: 'Формат', type: 'SEGMENTED', opts: [
        { v: 'A3', l: 'A3', def: true }, { v: 'A2', l: 'A2', coeff: 1.8 }, { v: 'custom', l: 'Свой размер', coeff: 1.4 } ] },
      { key: 'w', label: 'Ширина', type: 'DIMENSION', unit: 'см', min: 20, max: 60, step: 1, default: '30', visibleIf: { format: 'custom' } },
      { key: 'h', label: 'Высота', type: 'DIMENSION', unit: 'см', min: 20, max: 86, step: 1, default: '42', visibleIf: { format: 'custom' } },
      { key: 'sheets', label: 'Листов (перекидок)', type: 'SEGMENTED', opts: [
        { v: '12+1', l: '12+1', def: true }, { v: '6+1', l: '6+1', coeff: 0.6 }, { v: '4+1', l: '4+1', coeff: 0.45 } ] },
      { key: 'binding', label: 'Скрепление', type: 'SEGMENTED', opts: [
        { v: 'eurohook', l: 'Евроспираль', def: true }, { v: 'spiral-metal', l: 'Метал. пружина', coeff: 1.2 } ] },
      { key: 'paper', label: 'Бумага блока', type: 'SWATCH', opts: [
        { v: 'coated-115', l: 'Мелованная 115 г', def: true }, { v: 'coated-150', l: 'Мелованная 150 г', coeff: 1.15 } ] },
      { key: 'coverCoating', label: 'Покрытие обложки', type: 'SWATCH', opts: [
        { v: 'none', l: 'Без', def: true }, { v: 'matte-lam', l: 'Матовая', coeff: 1.1 }, { v: 'gloss-lam', l: 'Глянцевая', coeff: 1.1 } ] },
      { key: 'year', label: 'Год', type: 'SEGMENTED', opts: [
        { v: '2026', l: '2026' }, { v: '2027', l: '2027', def: true } ] },
    ],
    tiers: [[10, 350], [50, 220], [100, 170], [500, 120], [1000, 95], [5000, 80]],
    upsells: [{ code: 'pad', label: 'Подложка-подвес', kind: 'PER_UNIT', amount: 15 }],
    demoComment: 'ДЕМО-прайс настенных календарей. Структура — ТЗ п.6.1; базовые тиражи — демо.',
  },
  {
    code: 'calendar-desk', title: 'Настольные календари домик (демо)', slug: 'nastolnye', category: CAT_CALENDARS, tz: '6.2',
    minQty: 10, maxQty: 1000, qtyStep: 1, defaultQty: 50, productionDays: 3,
    urlOrder: ['format', 'sheets', 'binding', 'stand', 'paper', 'qty'],
    params: [
      { key: 'format', label: 'Формат', type: 'SEGMENTED', opts: [
        { v: 'A6', l: 'A6', coeff: 0.8 }, { v: 'A5', l: 'A5', def: true }, { v: 'A4', l: 'A4', coeff: 1.4 } ] },
      { key: 'sheets', label: 'Листов', type: 'SEGMENTED', opts: [
        { v: '12+1', l: '12+1', def: true }, { v: '6+1', l: '6+1', coeff: 0.6 } ] },
      { key: 'binding', label: 'Скрепление', type: 'SEGMENTED', opts: [
        { v: 'spiral-metal', l: 'Метал. пружина', def: true }, { v: 'spiral-plastic', l: 'Пластик. пружина', coeff: 0.9 } ] },
      { key: 'stand', label: 'Подставка', type: 'SEGMENTED', opts: [
        { v: 'cardboard', l: 'Картон', def: true }, { v: 'plastic', l: 'Пластик', perUnit: 20 } ] },
      { key: 'paper', label: 'Бумага', type: 'SWATCH', opts: [
        { v: 'coated-150', l: 'Мелованная 150 г', def: true }, { v: 'coated-200', l: 'Мелованная 200 г', coeff: 1.15 } ] },
    ],
    tiers: [[10, 250], [50, 160], [100, 120], [500, 90], [1000, 75]],
    demoComment: 'ДЕМО-прайс настольных календарей. Надбавка подставки — ТЗ п.6.2; базовые тиражи — демо.',
  },
  {
    code: 'calendar-pocket', title: 'Карманные календари (демо)', slug: 'karmannye', category: CAT_CALENDARS, tz: '6.3',
    minQty: 100, maxQty: 50000, qtyStep: 1, defaultQty: 500, productionDays: 2,
    urlOrder: ['format', 'paper', 'coating', 'qty', 'express'],
    params: [
      { key: 'format', label: 'Формат', type: 'SEGMENTED', opts: [
        { v: '70x100', l: '70×100', def: true }, { v: '90x50', l: '90×50', coeff: 0.85 }, { v: '85x55', l: '85×55', coeff: 0.85 } ] },
      { key: 'paper', label: 'Бумага', type: 'SWATCH', opts: [
        { v: 'coated-300', l: 'Мелованная 300 г', def: true }, { v: 'coated-350', l: 'Мелованная 350 г', coeff: 1.1 } ] },
      { key: 'coating', label: 'Покрытие', type: 'SWATCH', opts: [
        { v: 'none', l: 'Без', def: true }, { v: 'matte-lam', l: 'Матовая' }, { v: 'gloss-lam', l: 'Глянцевая' }, { v: 'soft-touch', l: 'Soft Touch', coeff: 1.2 } ] },
    ],
    tiers: [[100, 9], [500, 4], [1000, 2.6], [5000, 1.4], [10000, 1.1], [50000, 0.9]],
    express: { coeff: 1.3, days: 1, maxQty: 500 },
    demoComment: 'ДЕМО-прайс карманных календарей. Структура — ТЗ п.6.3; базовые тиражи — демо.',
  },
];

/** Параметры/варианты/совместимость/производство/upsells (без прайса) для CalculatorDefinition.create. */
export function tierDefinitionCreate(spec: TierSpec, version: number) {
  const params = spec.params.map((p, i) => {
    const base: Record<string, unknown> = {
      urlKey: p.key, label: p.label, type: p.type, sortOrder: i,
      ...(p.visibleIf ? { visibleIf: p.visibleIf } : {}),
    };
    if (p.type === 'DIMENSION') {
      Object.assign(base, {
        unit: p.unit ?? null, minValue: p.min ?? null, maxValue: p.max ?? null,
        stepValue: p.step ?? null, defaultValue: p.default ?? null,
      });
    } else if (p.type === 'MULTI_QTY') {
      base.config = { multiQty: { maxLines: (p.opts ?? []).length || 20, lineMin: 0, lineMax: 100000, lineStep: 1, ...(p.multiQty ?? {}) } };
      base.defaultValue = p.default ?? '';
      if (p.opts) base.options = { create: p.opts.map((o, j) => ({ value: o.v, label: o.l, isDefault: !!o.def, sortOrder: j })) };
    } else if (p.opts) {
      base.options = { create: p.opts.map((o, j) => ({ value: o.v, label: o.l, isDefault: !!o.def, sortOrder: j })) };
    }
    return base;
  });
  // Экспресс — TOGGLE-параметр (в URL ключ `express`, дефолт выкл).
  if (spec.express) {
    params.push({ urlKey: 'express', label: 'Срочное изготовление', type: 'TOGGLE', sortOrder: params.length, isRequired: false, defaultValue: '0' });
  }

  const compat: Record<string, unknown>[] = [];
  let cs = 0;
  for (const r of spec.minQtyRules ?? []) {
    compat.push({ kind: 'MIN_QTY', when: r.when, target: { minQty: r.minQty }, message: `Минимальный тираж — ${r.minQty} шт.`, sortOrder: cs++ });
  }
  for (const d of spec.disableRules ?? []) {
    compat.push({ kind: 'DISABLE_OPTIONS', when: d.when, target: { param: d.param, options: d.options }, message: d.message, sortOrder: cs++ });
  }
  if (spec.express?.maxQty) {
    compat.push({ kind: 'MAX_QTY', when: { express: '1' }, target: { maxQty: spec.express.maxQty }, message: `Срочное изготовление — тираж до ${spec.express.maxQty} шт.`, sortOrder: cs++ });
  }

  const production: Record<string, unknown>[] = [{ workingDays: spec.productionDays, priority: 0 }];
  if (spec.express) production.push({ condition: { express: '1' }, workingDays: spec.express.days, priority: 10 });

  const data: Record<string, unknown> = {
    code: spec.code, title: spec.title, version, pricingMode: 'TIER',
    urlOrder: spec.urlOrder, minQty: spec.minQty, maxQty: spec.maxQty, qtyStep: spec.qtyStep, defaultQty: spec.defaultQty,
    parameters: { create: params },
    productionRules: { create: production },
  };
  if (spec.quantityFrom?.length) data.config = { quantityFrom: { product: spec.quantityFrom } };
  if (compat.length) data.compatibilityRules = { create: compat };
  if (spec.upsells?.length) {
    data.upsells = { create: spec.upsells.map((u, i) => ({ code: u.code, label: u.label, pricing: u.kind, amountMinor: rub(u.amount), sortOrder: i })) };
  }
  // Динамически собранный объект соответствует Prisma-схеме калькулятора;
  // строгую типизацию восстанавливаем на границе (значения enum — из ТЗ).
  return data as unknown as Omit<Prisma.CalculatorDefinitionCreateInput, 'isDemo' | 'status' | 'priceLists'>;
}

/** ДЕМО price rules: BASE_TIER + MULTIPLIER (coeff) + SURCHARGE_PER_UNIT (perUnit) + экспресс-множитель. */
export function tierDemoPriceRulesCreate(spec: TierSpec) {
  const rules: Record<string, unknown>[] = [];
  const tiers = [...spec.tiers].sort((a, b) => a[0] - b[0]);
  tiers.forEach(([qtyFrom, perUnit], i) => {
    const next = tiers[i + 1];
    rules.push({ kind: 'BASE_TIER', qtyFrom, qtyTo: next ? next[0] - 1 : null, amountMinor: rub(perUnit), sortOrder: i });
  });
  let so = 100;
  for (const p of spec.params) {
    for (const o of p.opts ?? []) {
      if (o.coeff !== undefined && o.coeff !== 1) {
        rules.push({ kind: 'MULTIPLIER', condition: { [p.key]: o.v }, multiplier: o.coeff, sortOrder: so++ });
      }
      if (o.perUnit !== undefined) {
        rules.push({ kind: 'SURCHARGE_PER_UNIT', condition: { [p.key]: o.v }, amountMinor: rub(o.perUnit), sortOrder: so++ });
      }
    }
  }
  if (spec.express) rules.push({ kind: 'MULTIPLIER', condition: { express: '1' }, multiplier: spec.express.coeff, sortOrder: so++ });
  // QTY_DISCOUNT — модификатор результата (не базовая лестница): семантика C3.
  // Несколько порогов → диапазоны qtyFrom/qtyTo по возрастанию (от 2 шт. −5 %,
  // от 5 шт. −10 %). Пересечений нет, minQty не обязан покрываться (модификатор).
  if (spec.qtyDiscount) {
    const discs = (Array.isArray(spec.qtyDiscount) ? spec.qtyDiscount : [spec.qtyDiscount]).slice().sort((a, b) => a.from - b.from);
    discs.forEach((d, i) => {
      const next = discs[i + 1];
      rules.push({ kind: 'QTY_DISCOUNT', qtyFrom: d.from, qtyTo: next ? next.from - 1 : null, multiplier: d.coeff, sortOrder: so++ });
    });
  }
  return { create: rules } as unknown as Prisma.PriceRuleUncheckedCreateNestedManyWithoutPriceListInput;
}
