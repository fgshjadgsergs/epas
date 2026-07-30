/**
 * Ядро движка калькуляторов (v2, после Codex-ревью).
 *
 * Чистая функция без обращений к БД. Свойства:
 * - деньги: целые копейки, каждый множитель — round half-up до копейки;
 * - условия — декларативный JSON, без исполняемого кода;
 * - детерминизм: правила упорядочены (sortOrder, id), неоднозначность
 *   базовых правил — конфигурационная ошибка (fail-closed), а не «молчаливый
 *   выбор максимальной версии»;
 * - trace: каждое применённое правило пишется в appliedRules (аудит snapshot);
 * - вход жёстко валидируется (plain object, лимиты ключей/глубины/длины,
 *   запрет __proto__/prototype/constructor);
 * - required-параметр без default и без значения → ошибка 422;
 * - conditional bounds (SET_BOUNDS), типизированный multi-quantity и
 *   area-расчёт с единицами mm/cm/m и minBillableArea.
 *
 * Коммерческий контекст (B2B/скидки/налоги) сюда приходит ТОЛЬКО от сервера
 * (CustomerContext), никогда из пользовательского JSON.
 */
import {
  DerivedMetricConfig,
  ENGINE_VERSION,
  MultiQtyLineRuleConfig,
  PerIntervalRuleConfig,
  PerLengthRuleConfig,
} from './rule-schemas';

export { ENGINE_VERSION };
export type { DerivedMetricConfig };

export type ConditionJson = Record<string, string | string[]>;

export interface EngineOption {
  value: string;
  label: string;
  isDefault: boolean;
  isActive: boolean;
}

export type EngineParamType =
  | 'SEGMENTED'
  | 'SWATCH'
  | 'SELECT'
  | 'SEARCH_SELECT'
  | 'DIMENSION'
  | 'TOGGLE'
  | 'MULTI_QTY';

export interface MultiQtyConfig {
  maxLines: number;
  lineMin: number;
  lineMax: number;
  lineStep: number;
  totalMin?: number;
  totalMax?: number;
  /** Индивидуальные границы конкретных строк поверх общих. */
  lineOverrides?: Record<string, { min?: number; max?: number; step?: number }>;
}

export interface EngineParameter {
  urlKey: string;
  label: string;
  type: EngineParamType;
  isRequired: boolean;
  shareable: boolean;
  unit?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
  stepValue?: number | null;
  defaultValue?: string | null;
  visibleIf?: ConditionJson | null;
  /** Единица площади для DIMENSION (mm|cm|m) — из parameter.config. */
  areaUnit?: 'mm' | 'cm' | 'm' | null;
  multiQty?: MultiQtyConfig | null;
  options: EngineOption[];
}

export type CompatKind = 'DISABLE_OPTIONS' | 'HIDE_PARAMS' | 'MIN_QTY' | 'MAX_QTY' | 'SET_BOUNDS';

export interface EngineCompatRule {
  id?: string;
  kind: CompatKind;
  when: ConditionJson;
  target: {
    param?: string;
    options?: string[];
    params?: string[];
    minQty?: number;
    maxQty?: number;
    min?: number;
    max?: number;
    step?: number;
    required?: boolean;
  };
  message?: string | null;
  sortOrder: number;
}

export type PriceRuleKind =
  | 'BASE_TIER'
  | 'BASE_PER_SQM'
  | 'MULTIPLIER'
  | 'SURCHARGE_FLAT'
  | 'SURCHARGE_PER_UNIT'
  | 'QTY_DISCOUNT'
  | 'MIN_TOTAL'
  | 'SURCHARGE_PER_LENGTH'
  | 'SURCHARGE_PER_INTERVAL_COUNT'
  | 'BASE_PER_MULTI_QTY_LINE';

export interface EnginePriceRule {
  id?: string;
  kind: PriceRuleKind;
  condition?: ConditionJson | null;
  qtyFrom?: number | null;
  qtyTo?: number | null;
  amountMinor?: number | null;
  multiplier?: number | null;
  /** Типизированная конфигурация метрических/построчных правил. */
  config?: PerLengthRuleConfig | PerIntervalRuleConfig | MultiQtyLineRuleConfig | null;
  sortOrder: number;
}

export interface EngineUpsell {
  code: string;
  label: string;
  pricing: 'FLAT' | 'PER_UNIT' | 'MULTIPLIER';
  amountMinor?: number | null;
  multiplier?: number | null;
  isActive: boolean;
  /** Доступность по параметрам: не совпало — заказать опцию нельзя (блок 1). */
  visibleIf?: ConditionJson | null;
}

export interface EngineProductionRule {
  id?: string;
  condition?: ConditionJson | null;
  workingDays: number;
  cutoff: string;
  priority: number;
}

export interface AreaConfig {
  unit: 'mm' | 'cm' | 'm';
  minBillableSqm?: number;
  maxSqm?: number;
}

export interface EngineDefinition {
  code: string;
  version: number;
  pricingMode: 'TIER' | 'AREA';
  urlOrder: string[];
  minQty: number;
  maxQty: number;
  qtyStep: number;
  defaultQty: number;
  currency: string;
  priceListVersion: number;
  area?: AreaConfig | null;
  /** Производные метрики изделия (площадь/периметр/интервалы) из config. */
  metrics?: DerivedMetricConfig[] | null;
  /**
   * Производный тираж: qty = произведение целочисленных параметров
   * (например «оригиналы × копии» для копирования, ТЗ 2.2). Параметр `qty`
   * при этом не задаётся пользователем — тираж выводит сервер, а не frontend.
   */
  quantityFrom?: { product: string[] } | null;
  parameters: EngineParameter[];
  compatibilityRules: EngineCompatRule[];
  priceRules: EnginePriceRule[];
  productionRules: EngineProductionRule[];
  upsells: EngineUpsell[];
}

/** Коммерческий контекст — назначается ТОЛЬКО сервером (блок 3). */
export interface CustomerContext {
  customerType: 'INDIVIDUAL' | 'BUSINESS';
  /** Ставка НДС в процентах для информационного поля. */
  vatRatePct: number;
}

export const PUBLIC_CUSTOMER_CONTEXT: CustomerContext = {
  customerType: 'INDIVIDUAL',
  vatRatePct: 20,
};

export interface CalculationInput {
  parameters: Record<string, unknown>;
  upsells?: string[];
}

export interface FieldError {
  param: string;
  message: string;
}

export interface AppliedRule {
  ruleId: string | null;
  kind: string;
  /** Эффект правила: копейки или множитель (для аудита в snapshot). */
  amountMinor?: number;
  multiplier?: number;
}

/** Публичная строка расчёта MULTI_QTY (без rule id/priority/условий). */
export interface CalculationLineItem {
  key: string;
  label: string;
  quantity: number;
  unitPrice: { amountMinor: number; currency: string };
  lineTotal: { amountMinor: number; currency: string };
}

/** Публичное значение производной метрики (без деталей pricing-правил). */
export interface DerivedMetricValue {
  code: string;
  label: string;
  /** 'м²' | 'м' | 'шт' — единица отображения. */
  unit: string;
  /** Значение на одно изделие. */
  perItem: number;
  /** Значение на весь тираж (perItem × qty). */
  total: number;
}

export interface CalculationResult {
  normalizedParameters: Record<string, string | number | Record<string, number>>;
  quantity: number;
  price: { amountMinor: number; currency: string };
  unitPrice: { amountMinor: number; currency: string };
  /** Информационное поле «с НДС» — не меняет цену (блок 3). */
  priceWithVat: { amountMinor: number; currency: string };
  production: {
    workingDays: number;
    readyAt: string | null;
    readyDateLabel: string;
    cutoff: string;
  };
  appliedRules: AppliedRule[];
  appliedUpsells: { code: string; label: string; amountMinor: number }[];
  /** Валидированные коды upsell из входа — normalized input для snapshot (блок 1). */
  normalizedUpsells: string[];
  /**
   * Публичные производные метрики (площадь/периметр/люверсы): perItem — на
   * одно изделие, total — на весь тираж. Считаются ТОЛЬКО сервером; клиент
   * их не присылает и не может повлиять на цену через них.
   */
  derived: DerivedMetricValue[];
  /**
   * Построчная разбивка MULTI_QTY (пустой массив для обычных калькуляторов):
   * форматные ключи НЕ сворачиваются в общий тираж — каждая строка несёт
   * своё количество, цену за единицу и сумму. totalQuantity = quantity.
   */
  lineItems: CalculationLineItem[];
  warnings: string[];
  calculationVersion: string;
  engineVersion: string;
}

export type CalculationOutcome =
  | { ok: true; result: CalculationResult }
  | { ok: false; errors: FieldError[] };

/** Повреждённая/неоднозначная конфигурация: fail-closed, цена не считается. */
export class EngineConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineConfigError';
  }
}

const QTY_KEY = 'qty';
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const MAX_PARAM_KEYS = 50;
const MAX_STRING_LENGTH = 200;
const MAX_MULTI_LINES = 50;
const AREA_UNIT_TO_MM: Record<'mm' | 'cm' | 'm', number> = { mm: 1, cm: 10, m: 1000 };

export function conditionMatches(
  condition: ConditionJson | null | undefined,
  values: Record<string, string | number>,
): boolean {
  if (!condition) return true;
  for (const [key, expected] of Object.entries(condition)) {
    const actual = values[key];
    if (actual === undefined) return false;
    const actualStr = String(actual);
    if (Array.isArray(expected)) {
      if (!expected.map(String).includes(actualStr)) return false;
    } else if (String(expected) !== actualStr) {
      return false;
    }
  }
  return true;
}

/** Специфичность условия = число ключей (для выбора между base-правилами). */
function conditionSpecificity(condition: ConditionJson | null | undefined): number {
  return condition ? Object.keys(condition).length : 0;
}

/** Детерминированный порядок правил: sortOrder, затем id. */
function stableRuleOrder<T extends { sortOrder: number; id?: string }>(rules: T[]): T[] {
  return [...rules].sort((a, b) => a.sortOrder - b.sortOrder || (a.id ?? '').localeCompare(b.id ?? ''));
}

function defaultFor(param: EngineParameter): string | undefined {
  // MULTI_QTY: дефолт — строка "key:count,..." из defaultValue; options здесь
  // описывают доступные СТРОКИ, а не единственное значение по умолчанию.
  if (param.type === 'MULTI_QTY') return param.defaultValue ?? '';
  if (param.options.length > 0) {
    const def =
      param.options.find((o) => o.isDefault && o.isActive) ?? param.options.find((o) => o.isActive);
    return def?.value;
  }
  if (param.defaultValue != null) return param.defaultValue;
  if (param.type === 'TOGGLE') return '0';
  return undefined;
}

function roundMoney(value: number): number {
  return Math.round(value);
}

function applyMultiplier(amountMinor: number, multiplier: number): number {
  return roundMoney(amountMinor * multiplier);
}

// ---------------------------------------------------------------------------
// Входные данные: жёсткая проверка формы (блок 12)
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Форма входа: plain object, ≤50 ключей, безопасные имена, значения —
 * string(≤200)/number/boolean либо (для multi-qty) plain object number-значений.
 */
export function validateInputShape(raw: unknown): FieldError[] {
  const errors: FieldError[] = [];
  if (!isPlainObject(raw)) {
    return [{ param: 'parameters', message: 'parameters должен быть объектом' }];
  }
  const keys = Object.keys(raw);
  if (keys.length > MAX_PARAM_KEYS) {
    return [{ param: 'parameters', message: `Слишком много параметров (макс. ${MAX_PARAM_KEYS})` }];
  }
  for (const key of keys) {
    if (FORBIDDEN_KEYS.has(key) || key.length > 40) {
      errors.push({ param: key, message: 'Недопустимое имя параметра' });
      continue;
    }
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === 'string') {
      if (value.length > MAX_STRING_LENGTH)
        errors.push({ param: key, message: `Значение длиннее ${MAX_STRING_LENGTH} символов` });
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      // ok
    } else if (isPlainObject(value)) {
      // Глубина ≤ 2: только строки-числа внутри (multi-quantity lines).
      const lines = Object.entries(value);
      if (lines.length > MAX_MULTI_LINES) {
        errors.push({ param: key, message: `Слишком много строк количества (макс. ${MAX_MULTI_LINES})` });
        continue;
      }
      for (const [lineKey, lineValue] of lines) {
        if (FORBIDDEN_KEYS.has(lineKey) || lineKey.length > 60) {
          errors.push({ param: key, message: 'Недопустимый ключ строки количества' });
        } else if (typeof lineValue !== 'number') {
          errors.push({ param: key, message: 'Количество в строке должно быть числом' });
        }
      }
    } else {
      errors.push({ param: key, message: 'Недопустимый тип значения' });
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Даты готовности
// ---------------------------------------------------------------------------

function mskParts(now: Date): { y: number; m: number; d: number; minutes: number } {
  const shifted = new Date(now.getTime() + MSK_OFFSET_MS);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth(),
    d: shifted.getUTCDate(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

function isoDate(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
}

function isWorkingDay(y: number, m: number, d: number, holidays: ReadonlySet<string>): boolean {
  const wd = new Date(Date.UTC(y, m, d)).getUTCDay();
  if (wd === 0 || wd === 6) return false;
  return !holidays.has(isoDate(y, m, d));
}

function parseCutoffMinutes(cutoff: string): number {
  const [h, min] = cutoff.split(':').map(Number);
  return (Number.isFinite(h) ? h : 14) * 60 + (Number.isFinite(min) ? min : 0);
}

export function computeReadyDate(
  now: Date,
  workingDays: number,
  cutoff: string,
  holidays: ReadonlySet<string>,
): { readyAt: string; isToday: boolean } {
  const today = mskParts(now);
  let cursor = new Date(Date.UTC(today.y, today.m, today.d));
  if (today.minutes >= parseCutoffMinutes(cutoff)) cursor = new Date(cursor.getTime() + 86400000);
  while (!isWorkingDay(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate(), holidays)) {
    cursor = new Date(cursor.getTime() + 86400000);
  }
  let added = 0;
  while (added < workingDays) {
    cursor = new Date(cursor.getTime() + 86400000);
    if (isWorkingDay(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate(), holidays)) added++;
  }
  const readyAt = isoDate(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate());
  return { readyAt, isToday: readyAt === isoDate(today.y, today.m, today.d) };
}

function readyLabel(readyAt: string, isToday: boolean): string {
  if (isToday) return 'сегодня до 18:00';
  return new Intl.DateTimeFormat('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${readyAt}T00:00:00Z`));
}

function firstKey(condition: ConditionJson): string {
  return Object.keys(condition)[0] ?? QTY_KEY;
}

// ---------------------------------------------------------------------------
// Основной расчёт
// ---------------------------------------------------------------------------

interface EffectiveBounds {
  min: number;
  max: number;
  step: number;
}

export function runCalculation(
  def: EngineDefinition,
  input: CalculationInput,
  now: Date = new Date(),
  holidays: ReadonlySet<string> = new Set(),
  customer: CustomerContext = PUBLIC_CUSTOMER_CONTEXT,
): CalculationOutcome {
  const errors: FieldError[] = [];
  const warnings: string[] = [];
  const applied: AppliedRule[] = [];

  // 0. Форма входа (блок 12).
  const shapeErrors = validateInputShape(input.parameters ?? {});
  if (shapeErrors.length > 0) return { ok: false, errors: shapeErrors };
  const raw = (input.parameters ?? {}) as Record<string, unknown>;

  // 1. Белый список ключей.
  const knownKeys = new Set([QTY_KEY, ...def.parameters.map((p) => p.urlKey)]);
  for (const key of Object.keys(raw)) {
    if (!knownKeys.has(key)) errors.push({ param: key, message: `Неизвестный параметр «${key}»` });
  }

  // 2. Значения: ввод либо default. Валидация границ DIMENSION и required
  //    ОТКЛАДЫВАЕТСЯ до вычисления effective bounds (блок 4 v2): сначала
  //    контекст условий, затем объединение базовых границ с SET_BOUNDS,
  //    и только после этого — проверка итогового значения.
  const values: Record<string, string | number | Record<string, number>> = {};
  const missing = new Set<string>();
  for (const param of def.parameters) {
    const supplied = raw[param.urlKey];
    if (supplied === undefined || supplied === null || supplied === '') {
      const fallback = defaultFor(param);
      if (fallback === undefined) {
        missing.add(param.urlKey);
        continue;
      }
      values[param.urlKey] =
        param.type === 'DIMENSION'
          ? Number(fallback)
          : param.type === 'MULTI_QTY'
            ? parseMultiDefault(fallback)
            : fallback;
      continue;
    }
    const validated = validateParamValue(param, supplied, errors);
    if (validated !== undefined) values[param.urlKey] = validated;
  }

  // 3. Контекст сопоставления условий (без multi-объектов).
  const flatValues: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(values)) {
    if (typeof v === 'string' || typeof v === 'number') flatValues[k] = v;
  }

  // 4a. Conditional bounds (SET_BOUNDS): собираем effective bounds для qty и
  //     каждого параметра (per-axis: w и h — отдельные параметры) плюс
  //     переопределения required. Циклы «when ссылается на bounds-target»
  //     отклоняются на publish (validateSetBoundsRules), поэтому контекст
  //     сопоставления здесь стабилен.
  const compat = stableRuleOrder(def.compatibilityRules);
  const qtyBounds: EffectiveBounds = { min: def.minQty, max: def.maxQty, step: def.qtyStep };
  const paramBounds = new Map<string, { min?: number; max?: number; step?: number }>();
  const requiredOverride = new Map<string, boolean>();
  for (const rule of compat) {
    if (rule.kind !== 'SET_BOUNDS') continue;
    if (!conditionMatches(rule.when, flatValues)) continue;
    const t = rule.target;
    if (!t.param) continue;
    if (t.param === QTY_KEY) {
      if (t.min !== undefined) qtyBounds.min = t.min;
      if (t.max !== undefined) qtyBounds.max = t.max;
      if (t.step !== undefined) qtyBounds.step = t.step;
    } else {
      const bounds = paramBounds.get(t.param) ?? {};
      if (t.min !== undefined) bounds.min = t.min;
      if (t.max !== undefined) bounds.max = t.max;
      if (t.step !== undefined) bounds.step = t.step;
      paramBounds.set(t.param, bounds);
      if (t.required !== undefined) requiredOverride.set(t.param, t.required);
    }
  }

  // 4b. Effective required: базовый isRequired с учётом SET_BOUNDS.required.
  for (const param of def.parameters) {
    if (!missing.has(param.urlKey)) continue;
    const effectiveRequired = requiredOverride.get(param.urlKey) ?? param.isRequired;
    if (effectiveRequired) {
      errors.push({ param: param.urlKey, message: `Параметр «${param.label}» обязателен` });
    }
  }

  // 4c. DIMENSION: базовые границы, переопределённые условными SET_BOUNDS.
  //     Значение ровно на min/max допустимо; вне диапазона — ошибка; не по
  //     шагу — выравнивание с warning (как для qty).
  for (const param of def.parameters) {
    if (param.type !== 'DIMENSION') continue;
    const current = values[param.urlKey];
    if (typeof current !== 'number') continue;
    const override = paramBounds.get(param.urlKey) ?? {};
    const min = override.min ?? param.minValue ?? null;
    const max = override.max ?? param.maxValue ?? null;
    const step = override.step ?? param.stepValue ?? null;
    let value = current;
    if (min != null && value < min) {
      errors.push({ param: param.urlKey, message: `Минимум для «${param.label}» — ${min}${param.unit ?? ''}` });
    }
    if (max != null && value > max) {
      errors.push({ param: param.urlKey, message: `Максимум для «${param.label}» — ${max}${param.unit ?? ''}` });
    }
    if (step != null && step > 0) {
      const steps = Math.round(value / step);
      const snapped = Number((steps * step).toFixed(4));
      if (Math.abs(snapped - value) > 1e-9) {
        warnings.push(`Значение «${param.label}» выровнено до шага ${step}`);
        value = snapped;
      }
    }
    if (value !== current) {
      values[param.urlKey] = value;
      flatValues[param.urlKey] = value;
    }
  }

  // 5. Тираж с эффективными границами.
  let qty = def.defaultQty;
  const rawQty = raw[QTY_KEY];
  if (rawQty !== undefined && rawQty !== null && rawQty !== '') {
    const n = Number(rawQty);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
      errors.push({ param: QTY_KEY, message: 'Тираж должен быть целым положительным числом' });
    } else {
      qty = n;
    }
  }
  if (qty < qtyBounds.min) {
    errors.push({ param: QTY_KEY, message: `Минимальный тираж — ${qtyBounds.min.toLocaleString('ru-RU')} шт.` });
  }
  if (qty > qtyBounds.max) {
    errors.push({ param: QTY_KEY, message: `Максимальный тираж — ${qtyBounds.max.toLocaleString('ru-RU')} шт.` });
  }
  if (qtyBounds.step > 1 && qty % qtyBounds.step !== 0) {
    const normalized = Math.ceil(qty / qtyBounds.step) * qtyBounds.step;
    warnings.push(`Тираж выровнен до шага ${qtyBounds.step}: ${qty} → ${normalized}`);
    qty = normalized;
  }

  // 6a. Производный тираж: qty = произведение целочисленных параметров
  //     (ТЗ 2.2 «итого листов = оригиналы × копии»). Источники — DIMENSION-
  //     параметры с собственными границами (проверены в блоке 4c); тираж
  //     считает сервер, а не frontend. maxQty/шаг применяются как обычно.
  if (def.quantityFrom?.product?.length) {
    let product = 1;
    for (const key of def.quantityFrom.product) {
      const v = values[key];
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
        errors.push({ param: key, message: 'Должно быть целым положительным числом' });
      } else {
        product *= n;
      }
    }
    if (errors.length === 0) {
      qty = product;
      if (qty > qtyBounds.max) {
        errors.push({ param: QTY_KEY, message: `Максимальный тираж — ${qtyBounds.max.toLocaleString('ru-RU')} листов` });
      }
      if (qty < qtyBounds.min) {
        errors.push({ param: QTY_KEY, message: `Минимальный тираж — ${qtyBounds.min.toLocaleString('ru-RU')} листов` });
      }
    }
  }

  // 6. Multi-quantity: суммарное количество строк становится тиражом.
  const multiParam = def.parameters.find((p) => p.type === 'MULTI_QTY');
  if (multiParam && values[multiParam.urlKey] !== undefined) {
    const lines = values[multiParam.urlKey] as Record<string, number>;
    const total = Object.values(lines).reduce((s, n) => s + n, 0);
    const cfg = multiParam.multiQty;
    if (cfg?.totalMin !== undefined && total < cfg.totalMin) {
      errors.push({
        param: multiParam.urlKey,
        message: `Минимальное суммарное количество — ${cfg.totalMin.toLocaleString('ru-RU')}`,
      });
    }
    if (cfg?.totalMax !== undefined && total > cfg.totalMax) {
      errors.push({
        param: multiParam.urlKey,
        message: `Максимальное суммарное количество — ${cfg.totalMax.toLocaleString('ru-RU')}`,
      });
    }
    if (total > 0) qty = total;
  }

  // 7. Видимость: visibleIf и HIDE_PARAMS.
  const withQty: Record<string, string | number> = { ...flatValues, [QTY_KEY]: qty };
  const hidden = new Set<string>();
  for (const param of def.parameters) {
    if (param.visibleIf && !conditionMatches(param.visibleIf, withQty)) hidden.add(param.urlKey);
  }
  for (const rule of compat) {
    if (rule.kind === 'HIDE_PARAMS' && conditionMatches(rule.when, withQty)) {
      for (const p of rule.target.params ?? []) hidden.add(p);
    }
  }
  const normalized: Record<string, string | number | Record<string, number>> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!hidden.has(key)) normalized[key] = value;
  }
  const matchCtx: Record<string, string | number> = { [QTY_KEY]: qty };
  for (const [k, v] of Object.entries(normalized)) {
    if (typeof v === 'string' || typeof v === 'number') matchCtx[k] = v;
  }

  // 8. Совместимость.
  for (const rule of compat) {
    if (!conditionMatches(rule.when, matchCtx)) continue;
    if (rule.kind === 'DISABLE_OPTIONS') {
      const target = rule.target.param;
      if (target && !hidden.has(target)) {
        const current = String(matchCtx[target] ?? '');
        if ((rule.target.options ?? []).includes(current)) {
          errors.push({ param: target, message: rule.message ?? 'Недоступно для выбранных параметров' });
        }
      }
    } else if (rule.kind === 'MIN_QTY' && rule.target.minQty != null && qty < rule.target.minQty) {
      errors.push({
        param: QTY_KEY,
        message: rule.message ?? `Минимальный тираж — ${rule.target.minQty.toLocaleString('ru-RU')} шт.`,
      });
    } else if (rule.kind === 'MAX_QTY' && rule.target.maxQty != null && qty > rule.target.maxQty) {
      errors.push({
        param: firstKey(rule.when),
        message: rule.message ?? `Максимальный тираж — ${rule.target.maxQty.toLocaleString('ru-RU')} шт.`,
      });
    }
  }

  // 9. Upsells: белый список по definition, без дубликатов, с проверкой
  //    доступности для текущих параметров (блок 1). Идентичная проверка
  //    в preview и confirm — оба пути идут через эту функцию.
  const requestedUpsells = input.upsells ?? [];
  if (requestedUpsells.length > 20) {
    errors.push({ param: 'upsells', message: 'Слишком много опций' });
  }
  const activeUpsells = new Map(def.upsells.filter((u) => u.isActive).map((u) => [u.code, u]));
  const seenUpsells = new Set<string>();
  for (const code of requestedUpsells) {
    if (typeof code !== 'string' || code.length > 60 || !activeUpsells.has(code)) {
      errors.push({ param: 'upsells', message: `Неизвестная опция «${String(code).slice(0, 60)}»` });
      continue;
    }
    if (seenUpsells.has(code)) {
      errors.push({ param: 'upsells', message: `Опция «${code}» указана дважды` });
      continue;
    }
    seenUpsells.add(code);
    const upsell = activeUpsells.get(code)!;
    if (upsell.visibleIf && !conditionMatches(upsell.visibleIf, matchCtx)) {
      errors.push({ param: 'upsells', message: `Опция «${upsell.label}» недоступна для выбранных параметров` });
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  // 9b. Производные метрики (площадь/периметр/интервалы): типизированные
  //     операции над DIMENSION-параметрами, целочисленные мм внутри —
  //     без float-дрейфа; порядок объявления = порядок вычисления.
  const metrics = computeDerivedMetrics(def, matchCtx);

  // 10. База цены: построчная (MULTI_QTY), по площади либо по тиражу.
  const rules = stableRuleOrder(def.priceRules);
  const lineItems: CalculationLineItem[] = [];
  let subtotal: number;
  const lineRules = rules.filter((r) => r.kind === 'BASE_PER_MULTI_QTY_LINE');
  if (lineRules.length > 0) {
    // Построчная база: каждая строка тарифицируется своим количеством и своей
    // ценой; разбивка сохраняется до snapshot, а не сворачивается в totalQty.
    if (rules.some((r) => r.kind === 'BASE_TIER' || r.kind === 'BASE_PER_SQM')) {
      throw new EngineConfigError('Построчная база несовместима с BASE_TIER/BASE_PER_SQM в одном прайсе');
    }
    const multiParam = def.parameters.find((p) => p.type === 'MULTI_QTY');
    if (!multiParam) throw new EngineConfigError('Построчные правила без MULTI_QTY-параметра');
    const lines = (normalized[multiParam.urlKey] ?? {}) as Record<string, number>;
    const lineEntries = Object.entries(lines);
    if (lineEntries.length === 0) {
      return { ok: false, errors: [{ param: multiParam.urlKey, message: 'Добавьте хотя бы одну позицию' }] };
    }
    const labels = new Map(multiParam.options.map((o) => [o.value, o.label]));
    subtotal = 0;
    for (const [key, lineQty] of lineEntries) {
      const candidates = lineRules.filter((r) => {
        const cfg = r.config as MultiQtyLineRuleConfig | null;
        return (
          cfg?.sourceParameter === multiParam.urlKey &&
          cfg.lineKey === key &&
          r.amountMinor != null &&
          conditionMatches(r.condition, matchCtx) &&
          (r.qtyFrom ?? 0) <= lineQty &&
          (r.qtyTo == null || lineQty <= r.qtyTo)
        );
      });
      if (candidates.length === 0) {
        // Fail-closed: ненулевая строка без цены НЕ игнорируется.
        throw new EngineConfigError(`Нет цены для строки «${key}» (количество ${lineQty})`);
      }
      const rule = pickBaseRule(candidates);
      const lineTotal = rule.amountMinor! * lineQty;
      if (!Number.isSafeInteger(lineTotal)) throw new EngineConfigError(`Переполнение суммы строки «${key}»`);
      subtotal += lineTotal;
      if (!Number.isSafeInteger(subtotal)) throw new EngineConfigError('Переполнение суммы заказа');
      applied.push({ ruleId: rule.id ?? null, kind: 'BASE_PER_MULTI_QTY_LINE', amountMinor: lineTotal });
      lineItems.push({
        key,
        label: labels.get(key) ?? key,
        quantity: lineQty,
        unitPrice: { amountMinor: rule.amountMinor!, currency: def.currency },
        lineTotal: { amountMinor: lineTotal, currency: def.currency },
      });
    }
  } else if (def.pricingMode === 'AREA') {
    const base = pickBaseRule(
      rules.filter((r) => r.kind === 'BASE_PER_SQM' && conditionMatches(r.condition, matchCtx)),
    );
    if (!base?.amountMinor && base?.amountMinor !== 0) {
      throw new EngineConfigError('Нет базового правила площади в активном прайсе');
    }
    const area = computeArea(def, matchCtx, warnings, errors);
    if (errors.length > 0) return { ok: false, errors };
    const unitMinor = roundMoney(area * base.amountMinor!);
    applied.push({ ruleId: base.id ?? null, kind: 'BASE_PER_SQM', amountMinor: base.amountMinor! });
    subtotal = unitMinor * qty;
  } else {
    const tiers = rules.filter(
      (r) =>
        r.kind === 'BASE_TIER' &&
        r.amountMinor != null &&
        conditionMatches(r.condition, matchCtx) &&
        (r.qtyFrom ?? 0) <= qty &&
        (r.qtyTo == null || qty <= r.qtyTo),
    );
    if (tiers.length === 0) {
      // Ни одного BASE_TIER вообще → прайс не настроен; есть, но не покрывает
      // qty → дырка диапазонов (publish-валидатор обязан не допускать).
      const any = rules.some((r) => r.kind === 'BASE_TIER');
      if (!any) throw new EngineConfigError('Прайс-лист не содержит базовых правил');
      throw new EngineConfigError(`Диапазоны тиража не покрывают qty=${qty}`);
    }
    const base = pickBaseRule(tiers);
    applied.push({ ruleId: base.id ?? null, kind: 'BASE_TIER', amountMinor: base.amountMinor! });
    subtotal = base.amountMinor! * qty;
  }

  // 10b. Метрические надбавки (за длину / за количество интервалов) — ДО
  //      множителей: по формуле ТЗ §15.12 срочность и прочие коэффициенты
  //      применяются к сумме «база + люверсы + подшив».
  for (const rule of rules) {
    if (!conditionMatches(rule.condition, matchCtx)) continue;
    if (rule.kind === 'SURCHARGE_PER_LENGTH' && rule.amountMinor != null && rule.config) {
      const cfg = rule.config as PerLengthRuleConfig;
      const source = metrics.get(cfg.sourceMetric);
      if (!source || source.lengthMm === undefined) {
        throw new EngineConfigError(`SURCHARGE_PER_LENGTH ссылается на отсутствующую метрику «${cfg.sourceMetric}»`);
      }
      // amountMinor — копейки за одну cfg.unit; длина хранится в целых мм.
      const perItemAmount = roundMoney((source.lengthMm * rule.amountMinor) / AREA_UNIT_TO_MM[cfg.unit]);
      const total = cfg.perItem ? perItemAmount * qty : perItemAmount;
      subtotal += total;
      applied.push({ ruleId: rule.id ?? null, kind: 'SURCHARGE_PER_LENGTH', amountMinor: total });
    } else if (rule.kind === 'SURCHARGE_PER_INTERVAL_COUNT' && rule.amountMinor != null && rule.config) {
      const cfg = rule.config as PerIntervalRuleConfig;
      const source = metrics.get(cfg.sourceMetric);
      if (!source || source.lengthMm === undefined) {
        throw new EngineConfigError(
          `SURCHARGE_PER_INTERVAL_COUNT ссылается на отсутствующую метрику «${cfg.sourceMetric}»`,
        );
      }
      const intervalMm = resolveIntervalMm(cfg, matchCtx);
      const count = computeIntervalCount(source.lengthMm, intervalMm, cfg.minCount, cfg.maxCount);
      const perItemAmount = count * rule.amountMinor;
      const total = cfg.perItem ? perItemAmount * qty : perItemAmount;
      subtotal += total;
      applied.push({ ruleId: rule.id ?? null, kind: 'SURCHARGE_PER_INTERVAL_COUNT', amountMinor: total });
    }
  }

  // 11. Модификаторы.
  for (const rule of rules) {
    if (rule.kind === 'MULTIPLIER' && rule.multiplier != null && conditionMatches(rule.condition, matchCtx)) {
      subtotal = applyMultiplier(subtotal, rule.multiplier);
      applied.push({ ruleId: rule.id ?? null, kind: 'MULTIPLIER', multiplier: rule.multiplier });
    }
  }
  for (const rule of rules) {
    if (!conditionMatches(rule.condition, matchCtx)) continue;
    if (rule.kind === 'SURCHARGE_PER_UNIT' && rule.amountMinor != null) {
      subtotal += rule.amountMinor * qty;
      applied.push({ ruleId: rule.id ?? null, kind: 'SURCHARGE_PER_UNIT', amountMinor: rule.amountMinor * qty });
    }
    if (rule.kind === 'SURCHARGE_FLAT' && rule.amountMinor != null) {
      subtotal += rule.amountMinor;
      applied.push({ ruleId: rule.id ?? null, kind: 'SURCHARGE_FLAT', amountMinor: rule.amountMinor });
    }
  }
  const discounts = rules.filter(
    (r) =>
      r.kind === 'QTY_DISCOUNT' &&
      r.multiplier != null &&
      (r.qtyFrom ?? 0) <= qty &&
      (r.qtyTo == null || qty <= r.qtyTo) &&
      conditionMatches(r.condition, matchCtx),
  );
  if (discounts.length > 0) {
    const discount = pickBaseRule(discounts);
    subtotal = applyMultiplier(subtotal, discount.multiplier!);
    applied.push({ ruleId: discount.id ?? null, kind: 'QTY_DISCOUNT', multiplier: discount.multiplier! });
  }

  // 12. Upsells: множители, затем фикс-надбавки.
  const appliedUpsells: { code: string; label: string; amountMinor: number }[] = [];
  for (const code of requestedUpsells) {
    const upsell = activeUpsells.get(code)!;
    if (upsell.pricing === 'MULTIPLIER' && upsell.multiplier != null) {
      const next = applyMultiplier(subtotal, upsell.multiplier);
      appliedUpsells.push({ code, label: upsell.label, amountMinor: next - subtotal });
      subtotal = next;
    }
  }
  for (const code of requestedUpsells) {
    const upsell = activeUpsells.get(code)!;
    if (upsell.pricing === 'FLAT' && upsell.amountMinor != null) {
      appliedUpsells.push({ code, label: upsell.label, amountMinor: upsell.amountMinor });
      subtotal += upsell.amountMinor;
    } else if (upsell.pricing === 'PER_UNIT' && upsell.amountMinor != null) {
      const delta = upsell.amountMinor * qty;
      appliedUpsells.push({ code, label: upsell.label, amountMinor: delta });
      subtotal += delta;
    }
  }

  // 13. Минимальная стоимость.
  for (const rule of rules) {
    if (rule.kind === 'MIN_TOTAL' && rule.amountMinor != null && conditionMatches(rule.condition, matchCtx)) {
      if (subtotal < rule.amountMinor) {
        warnings.push('Применена минимальная стоимость заказа');
        subtotal = rule.amountMinor;
        applied.push({ ruleId: rule.id ?? null, kind: 'MIN_TOTAL', amountMinor: rule.amountMinor });
      }
    }
  }

  // 14. Срок: max priority; ничья приоритетов — конфигурационная ошибка.
  const matchedProduction = def.productionRules.filter((r) => conditionMatches(r.condition, matchCtx));
  let productionBlock: CalculationResult['production'];
  if (matchedProduction.length > 0) {
    const top = Math.max(...matchedProduction.map((r) => r.priority));
    const winners = matchedProduction.filter((r) => r.priority === top);
    if (winners.length > 1) {
      throw new EngineConfigError('Неоднозначные правила срока изготовления (одинаковый priority)');
    }
    const production = winners[0];
    const { readyAt, isToday } = computeReadyDate(now, production.workingDays, production.cutoff, holidays);
    productionBlock = {
      workingDays: production.workingDays,
      readyAt,
      readyDateLabel: readyLabel(readyAt, isToday),
      cutoff: production.cutoff,
    };
  } else {
    productionBlock = { workingDays: 0, readyAt: null, readyDateLabel: '', cutoff: '14:00' };
    warnings.push('Срок изготовления не настроен для этой услуги');
  }

  const totalMinor = subtotal;
  return {
    ok: true,
    result: {
      normalizedParameters: normalized,
      quantity: qty,
      price: { amountMinor: totalMinor, currency: def.currency },
      unitPrice: { amountMinor: roundMoney(totalMinor / qty), currency: def.currency },
      priceWithVat: {
        amountMinor: applyMultiplier(totalMinor, 1 + customer.vatRatePct / 100),
        currency: def.currency,
      },
      production: productionBlock,
      appliedRules: applied,
      appliedUpsells,
      normalizedUpsells: [...requestedUpsells],
      lineItems,
      derived: [...metrics.values()].map((m) => ({
        code: m.code,
        label: m.label,
        unit: m.unitLabel,
        perItem: m.perItem,
        total: roundMetric(m.perItem * qty),
      })),
      warnings,
      calculationVersion: `${def.code}:v${def.version}:p${def.priceListVersion}`,
      engineVersion: ENGINE_VERSION,
    },
  };
}

/**
 * Выбор базового правила из совпавших: приоритет — более специфичное условие;
 * при равной специфичности несколько кандидатов = ошибка конфигурации
 * (никакого «молчаливого» выбора).
 */
function pickBaseRule(candidates: EnginePriceRule[]): EnginePriceRule {
  if (candidates.length === 0) throw new EngineConfigError('Нет подходящего базового правила');
  const maxSpec = Math.max(...candidates.map((r) => conditionSpecificity(r.condition)));
  const best = candidates.filter((r) => conditionSpecificity(r.condition) === maxSpec);
  if (best.length > 1) {
    // Для BASE_TIER одинаковой специфичности берём наибольший qtyFrom, но
    // одинаковый qtyFrom — уже неоднозначность.
    const maxFrom = Math.max(...best.map((r) => r.qtyFrom ?? 0));
    const ties = best.filter((r) => (r.qtyFrom ?? 0) === maxFrom);
    if (ties.length > 1) throw new EngineConfigError('Неоднозначные базовые правила прайса');
    return ties[0];
  }
  return best[0];
}

/** Площадь в м² из DIMENSION-параметров w/h с учётом единиц и ограничений. */
function computeArea(
  def: EngineDefinition,
  ctx: Record<string, string | number>,
  warnings: string[],
  errors: FieldError[],
): number {
  const unit = def.area?.unit ?? 'm';
  const scaleMm = AREA_UNIT_TO_MM[unit];
  const w = Number(ctx.w);
  const h = Number(ctx.h);
  if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(h) || h <= 0) {
    errors.push({ param: 'w', message: 'Укажите ширину и высоту' });
    return 0;
  }
  // Точная конвертация: сперва в целые мм (входные шаги ≥ 0.1 единицы),
  // затем одно деление — без накопления float-ошибок.
  const wMm = Math.round(w * scaleMm);
  const hMm = Math.round(h * scaleMm);
  let areaSqm = (wMm * hMm) / 1_000_000;
  if (def.area?.maxSqm !== undefined && areaSqm > def.area.maxSqm) {
    errors.push({ param: 'w', message: `Максимальная площадь — ${def.area.maxSqm} м²` });
    return 0;
  }
  if (def.area?.minBillableSqm !== undefined && areaSqm < def.area.minBillableSqm) {
    warnings.push(`Минимальная оплачиваемая площадь — ${def.area.minBillableSqm} м²`);
    areaSqm = def.area.minBillableSqm;
  }
  return areaSqm;
}

// ---------------------------------------------------------------------------
// Производные метрики (площадь/периметр/интервалы)
// ---------------------------------------------------------------------------

/** Business caps: защита от переполнения/абсурдных конфигураций. */
const MAX_DIMENSION_MM = 10_000_000; // 10 км
const MAX_INTERVAL_COUNT = 1_000_000;

interface ComputedMetric {
  code: string;
  label: string;
  unitLabel: string;
  /** Значение на одно изделие (м², м или штук). */
  perItem: number;
  /** Для метрик длины — целые мм (точный источник для money-расчёта). */
  lengthMm?: number;
}

/** Округление публичных метрик до 4 знаков — убирает float-хвосты. */
function roundMetric(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/** DIMENSION-значение параметра в целых мм; null — параметра нет/некорректен. */
function dimensionMm(ctx: Record<string, string | number>, param: string, unit: 'mm' | 'cm' | 'm'): number | null {
  const raw = Number(ctx[param]);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  const mm = Math.round(raw * AREA_UNIT_TO_MM[unit]);
  if (mm <= 0 || mm > MAX_DIMENSION_MM) return null;
  return mm;
}

/** Шаг интервала в мм: параметр пользователя (если видим) либо fallback в метрах. */
function resolveIntervalMm(
  cfg: { interval?: number; intervalParam?: string; intervalUnit?: 'mm' | 'cm' | 'm' },
  ctx: Record<string, string | number>,
): number {
  if (cfg.intervalParam !== undefined && ctx[cfg.intervalParam] !== undefined) {
    const raw = Number(ctx[cfg.intervalParam]);
    if (Number.isFinite(raw) && raw > 0) {
      const mm = Math.round(raw * AREA_UNIT_TO_MM[cfg.intervalUnit ?? 'm']);
      if (mm > 0) return mm;
    }
  }
  if (cfg.interval !== undefined) {
    const mm = Math.round(cfg.interval * 1000); // interval задаётся в метрах
    if (mm > 0) return mm;
  }
  throw new EngineConfigError('Интервал метрики не задан или некорректен');
}

/** CEIL(длина/шаг) на целых мм + clamp по min/maxCount + cap. */
function computeIntervalCount(lengthMm: number, intervalMm: number, minCount?: number, maxCount?: number): number {
  let count = Math.ceil(lengthMm / intervalMm);
  if (minCount !== undefined) count = Math.max(count, minCount);
  if (maxCount !== undefined) count = Math.min(count, maxCount);
  if (count > MAX_INTERVAL_COUNT) {
    throw new EngineConfigError('Количество интервалов превышает допустимый предел');
  }
  return count;
}

/**
 * Вычисление производных метрик по порядку объявления. INTERVAL_COUNT может
 * ссылаться только на УЖЕ вычисленную метрику длины (цикл невозможен —
 * publish-валидатор дополнительно это гарантирует). Метрика с несовпавшим
 * when или отсутствующими размерами пропускается.
 */
function computeDerivedMetrics(
  def: EngineDefinition,
  ctx: Record<string, string | number>,
): Map<string, ComputedMetric> {
  const out = new Map<string, ComputedMetric>();
  for (const metric of def.metrics ?? []) {
    if (metric.when && !conditionMatches(metric.when as ConditionJson, ctx)) continue;
    if (metric.kind === 'AREA' || metric.kind === 'PERIMETER') {
      const wMm = dimensionMm(ctx, metric.widthParam, metric.unit);
      const hMm = dimensionMm(ctx, metric.heightParam, metric.unit);
      if (wMm === null || hMm === null) continue;
      if (metric.kind === 'AREA') {
        out.set(metric.code, {
          code: metric.code,
          label: metric.label,
          unitLabel: 'м²',
          perItem: roundMetric((wMm * hMm) / 1_000_000),
        });
      } else {
        const perimeterMm = 2 * (wMm + hMm);
        out.set(metric.code, {
          code: metric.code,
          label: metric.label,
          unitLabel: 'м',
          perItem: roundMetric(perimeterMm / 1000),
          lengthMm: perimeterMm,
        });
      }
    } else {
      const source = out.get(metric.sourceMetric);
      if (!source || source.lengthMm === undefined) {
        throw new EngineConfigError(
          `Метрика «${metric.code}» ссылается на отсутствующую метрику длины «${metric.sourceMetric}»`,
        );
      }
      const intervalMm = resolveIntervalMm(metric, ctx);
      const count = computeIntervalCount(source.lengthMm, intervalMm, metric.minCount, metric.maxCount);
      out.set(metric.code, { code: metric.code, label: metric.label, unitLabel: 'шт', perItem: count });
    }
  }
  return out;
}

function parseMultiDefault(raw: string): Record<string, number> {
  // Дефолт multi-qty в БД хранится строкой "key:count,key:count" (или пусто).
  const out: Record<string, number> = {};
  for (const part of raw.split(',')) {
    const [key, count] = part.split(':');
    const n = Number(count);
    if (key && Number.isInteger(n) && n > 0) out[key] = n;
  }
  return out;
}

function validateParamValue(
  param: EngineParameter,
  supplied: unknown,
  errors: FieldError[],
): string | number | Record<string, number> | undefined {
  if (param.type === 'MULTI_QTY') {
    if (!isPlainObject(supplied)) {
      errors.push({ param: param.urlKey, message: `«${param.label}» — ожидается объект количеств` });
      return undefined;
    }
    const cfg = param.multiQty ?? { maxLines: 50, lineMin: 0, lineMax: 100000, lineStep: 1 };
    const activeOptions = param.options.filter((o) => o.isActive);
    const allowed = new Set(activeOptions.map((o) => o.value));
    const raw: Record<string, number> = {};
    const entries = Object.entries(supplied);
    if (entries.length > cfg.maxLines) {
      errors.push({ param: param.urlKey, message: `Не более ${cfg.maxLines} строк количества` });
      return undefined;
    }
    for (const [key, value] of entries) {
      if (allowed.size > 0 && !allowed.has(key)) {
        errors.push({ param: param.urlKey, message: `Недопустимая строка «${key}»` });
        continue;
      }
      // Индивидуальные границы строки поверх общих (напр. большие форматы
      // печатаются от 1, мелкие — пачками).
      const override = cfg.lineOverrides?.[key] ?? {};
      const lineMin = override.min ?? cfg.lineMin;
      const lineMax = override.max ?? cfg.lineMax;
      const lineStep = override.step ?? cfg.lineStep;
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0) {
        errors.push({ param: param.urlKey, message: `Недопустимое количество в строке «${key}»` });
        continue;
      }
      if (n === 0) continue; // нулевая строка = отсутствие строки, удаляется до проверки границ
      if (n < lineMin || n > lineMax) {
        errors.push({ param: param.urlKey, message: `Недопустимое количество в строке «${key}»` });
        continue;
      }
      if (lineStep > 1 && n % lineStep !== 0) {
        errors.push({ param: param.urlKey, message: `Количество в «${key}» должно быть кратно ${lineStep}` });
        continue;
      }
      raw[key] = n;
    }
    // Стабильный порядок строк = порядок options в definition.
    const lines: Record<string, number> = {};
    for (const option of activeOptions) {
      if (raw[option.value] !== undefined) lines[option.value] = raw[option.value];
    }
    return lines;
  }
  if (param.options.length > 0) {
    const str = String(supplied);
    const option = param.options.find((o) => o.isActive && o.value === str);
    if (!option) {
      errors.push({ param: param.urlKey, message: `Недопустимое значение параметра «${param.label}»` });
      return String(defaultFor(param) ?? '');
    }
    return str;
  }
  if (param.type === 'DIMENSION') {
    // Только парсинг типа: границы (min/max/step) проверяются позже, после
    // объединения базовых bounds с условными SET_BOUNDS (шаг 4c) — иначе
    // условные границы не могли бы ослабить/ужесточить базовые.
    const n = Number(supplied);
    if (!Number.isFinite(n)) {
      errors.push({ param: param.urlKey, message: `«${param.label}» должно быть числом` });
      return Number(defaultFor(param) ?? 0);
    }
    return n;
  }
  if (param.type === 'TOGGLE') {
    const truthy = supplied === true || supplied === '1' || supplied === 1 || supplied === 'true';
    const falsy = supplied === false || supplied === '0' || supplied === 0 || supplied === 'false';
    if (!truthy && !falsy) {
      errors.push({ param: param.urlKey, message: `«${param.label}» — недопустимое значение` });
      return '0';
    }
    return truthy ? '1' : '0';
  }
  return String(supplied);
}
