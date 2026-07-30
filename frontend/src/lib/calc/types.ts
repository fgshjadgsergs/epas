/**
 * Конфиг-схема калькуляторов (фаза 3). Один движок — много конфигов услуг.
 * Логика цен по ТЗ живёт на бэкенде; здесь — структура параметров, метаданные
 * для превью/свотчей и коэффициенты для клиентского предрасчёта (заглушка API).
 */

export type ParamType =
  | 'segmented'
  | 'swatch'
  | 'qty-slider'
  | 'dimension'
  | 'toggle'
  | 'select'
  /** Селектор с текстовым поиском-автоподсказкой (напр. документ из справочника). */
  | 'search-select'
  /**
   * Мультиколичество: отдельное поле «сколько штук» для каждой опции
   * (мультиформат фотопечати, мультиразмер футболок — ТЗ п.3.1/8.1).
   * Значение в state: строка вида «10x15:24,20x30:2» (только ненулевые).
   */
  | 'multi-qty';

export interface SwatchMeta {
  kind: 'paper' | 'lam' | 'foil' | 'ink';
  /** Цвет заливки свотча/превью (hex или css-градиент). */
  color?: string;
  /** Характер поверхности для превью ламинации. */
  sheen?: 'none' | 'matte' | 'gloss' | 'soft';
}

export interface ParamOption {
  id: string;
  label: string;
  /** Множитель к цене за единицу (по умолчанию 1). */
  coeff?: number;
  /** Разовая надбавка к заказу, ₽. */
  add?: number;
  /** Надбавка к цене за единицу, ₽. */
  perUnitAdd?: number;
  /** Фиксированная цена за единицу (перекрывает пороги тиража) — для селекторов. */
  price?: number;
  /** Подпись (напр. размер фото). */
  note?: string;
  badge?: string;
  swatch?: SwatchMeta;
  /**
   * Срок готовности при выборе этой опции, рабочих дней (перекрывает
   * productionDays). Для ступеней срочности вида «экспресс 4 ч» — 0.
   */
  daysOverride?: number;
}

export interface ParamGroup {
  id: string;
  label: string;
  type: ParamType;
  options?: ParamOption[];
  default: string | number;
  /** Для dimension/qty-slider. */
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export interface QtyTier {
  qty: number;
  perUnit: number;
}

export interface Upsell {
  id: string;
  label: string;
  /** Разовая надбавка к заказу, ₽. */
  add?: number;
  /** Надбавка к цене за единицу, ₽. */
  perUnitAdd?: number;
  /** Множитель к итогу. */
  coeff?: number;
}

/**
 * Правило срочного изготовления услуги (ТЗ «Калькуляторы цен»).
 * Коэффициенты и ограничения индивидуальны для каждой услуги;
 * отсутствие правила = срочное изготовление недоступно.
 */
export interface ExpressRule {
  /** Множитель к цене: 1.3 = +30%, 1.5 = +50%. */
  coeff: number;
  /** Срок в рабочих днях (0 = в день заказа). */
  days: number;
  /** Подпись срока («1 день», «4 часа»). */
  label?: string;
  /** Максимальный тираж для срочного изготовления. */
  maxQty?: number;
  /** Минимальный тираж для срочного изготовления (напр. футболки — от 5 шт.). */
  minQty?: number;
  /** Доступность при текущем выборе параметров (матрицы из ТЗ). */
  available?: (sel: Selection) => boolean;
  /** Пояснение, при каких параметрах доступен экспресс. */
  hint?: string;
}

export interface CalcConfig {
  serviceId: string;
  /** Тип визуального превью продукта. */
  preview: 'card' | 'sheet' | 'banner' | 'generic' | 'idphoto';
  groups: ParamGroup[];
  /** Режим расчёта: по тиражу (полиграфия) или по площади (широкоформат). */
  pricing?: 'tier' | 'area';
  /** Базовая цена за м² для area-режима. */
  pricePerSqm?: number;
  /** Пороговая цена за единицу по тиражу — основа динамики цены и выгоды. */
  qtyTiers?: QtyTier[];
  /** Диапазон тиража для area-режима (когда нет порогов). */
  qtyRange?: { min: number; max: number; step: number };
  /** Тираж по умолчанию (не включается в URL). */
  defaultQty: number;
  /** Скидка от количества: при qty ≥ from применяется coeff. */
  qtyDiscount?: { from: number; coeff: number }[];
  /** Подпись поля количества (по умолчанию «Тираж»). */
  qtyLabel?: string;
  upsells?: Upsell[];
  productionDays: number;
  /** Правило срочного изготовления (нет правила — экспресс недоступен). */
  express?: ExpressRule;
  /** Пресеты размеров для area-режима — быстрый выбор ширины×высоты (ТЗ п.4.1). */
  sizePresets?: { label: string; w: number; h: number }[];
  /** Вычисляемая подпись под тиражом (напр. «Итого листов: 5 × 20 = 100» — ТЗ п.2.2). */
  derivedNote?: (sel: Selection, qty: number) => string;
  /**
   * Возвращает недоступные id опций по группам при текущем выборе
   * (матрицы совместимости из ТЗ). Напр. покрытия по подтипу визиток.
   */
  getDisabled?: (sel: Selection) => Record<string, string[]>;
  /** Группы, скрытые при текущем выборе (напр. бумага скрыта для пластика). */
  getHidden?: (sel: Selection) => string[];
  /** Минимальный тираж при текущем выборе (напр. пластиковые визитки — от 100). */
  getMinQty?: (sel: Selection) => number;
}

export type Selection = Record<string, string | number>;

/** Состояние калькулятора. */
export interface CalcState {
  params: Selection;
  qty: number;
  express: boolean;
  upsells: string[];
  b2b: boolean;
}
