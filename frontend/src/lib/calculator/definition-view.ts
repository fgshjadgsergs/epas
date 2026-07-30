/**
 * Проекция backend definition в структуры UI калькулятора.
 *
 * Backend definition — единственный источник истины по составу параметров,
 * порядку, options/labels, дефолтам, required, min/max/step, видимости и
 * совместимости. Локальный CalcConfig при наличии definition поставляет
 * ТОЛЬКО presentation-данные: цвета свотчей, бейджи, подписи-примечания,
 * тип превью. Никаких дефолтов, опций и бизнес-правил из него не берётся.
 *
 * Все функции чистые — тестируются без DOM.
 */
import type { CalculatorDefinitionDto } from '@/lib/api/calculator';
import type { CalcConfig, ParamGroup, ParamType, Selection } from '@/lib/calc/types';

export type DefinitionDto = CalculatorDefinitionDto;
type DefinitionParam = DefinitionDto['parameters'][number];

/** Значения для сопоставления условий правил (плоские строки/числа). */
export type RuleValues = Record<string, string | number>;

/** Та же семантика, что у движка backend: все пары условия должны совпасть. */
export function conditionMatches(
  condition: Record<string, string | string[]> | null | undefined,
  values: RuleValues,
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

const TYPE_MAP: Record<string, ParamType> = {
  SEGMENTED: 'segmented',
  SWATCH: 'swatch',
  SELECT: 'select',
  SEARCH_SELECT: 'search-select',
  DIMENSION: 'dimension',
  TOGGLE: 'toggle',
  MULTI_QTY: 'multi-qty',
};

/**
 * Строит группы UI из definition, подмешивая ИЗ ЛОКАЛЬНОГО конфига только
 * presentation-поля (swatch/badge/note) по совпадению id. Состав, порядок,
 * подписи и дефолты — строго из definition. Параметр express исключается:
 * у него отдельный кастомный UX (тумблер срочности).
 */
export function buildGroupsFromDefinition(def: DefinitionDto, presentation?: CalcConfig): ParamGroup[] {
  return def.parameters
    .filter((p) => p.urlKey !== 'express')
    .map((p) => {
      const localGroup = presentation?.groups.find((g) => g.id === p.urlKey);
      return {
        id: p.urlKey,
        label: p.label,
        type: TYPE_MAP[p.type] ?? 'segmented',
        default: p.type === 'DIMENSION' ? Number(p.default ?? 0) : p.default ?? '',
        // MULTI_QTY: границы строки из публичной multiQty-конфигурации.
        min: p.type === 'MULTI_QTY' ? p.multiQty?.lineMin : p.min ?? undefined,
        max: p.type === 'MULTI_QTY' ? p.multiQty?.lineMax : p.max ?? undefined,
        step: p.type === 'MULTI_QTY' ? p.multiQty?.lineStep : p.step ?? undefined,
        unit: p.unit ?? localGroup?.unit,
        options: p.options.map((o) => {
          const localOption = localGroup?.options?.find((lo) => lo.id === o.value);
          return {
            id: o.value,
            label: o.label,
            // Presentation-only поля; цен/коэффициентов здесь нет и быть не может.
            swatch: localOption?.swatch,
            badge: localOption?.badge,
            note: localOption?.note,
          };
        }),
      } satisfies ParamGroup;
    });
}

/** Дефолтные значения параметров по definition (для инициализации состояния). */
export function defaultsFromDefinition(def: DefinitionDto): Selection {
  const out: Selection = {};
  for (const p of def.parameters) {
    if (p.urlKey === 'express') continue;
    if (p.default == null || p.default === '') continue;
    out[p.urlKey] = p.type === 'DIMENSION' ? Number(p.default) : p.default;
  }
  return out;
}

/** Недоступные опции по параметрам (DISABLE_OPTIONS) при текущих значениях. */
export function disabledOptionsFromDefinition(def: DefinitionDto, values: RuleValues): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const rule of def.compatibility) {
    if (rule.kind !== 'DISABLE_OPTIONS') continue;
    if (!conditionMatches(rule.when, values)) continue;
    const param = rule.target.param as string | undefined;
    const options = rule.target.options as string[] | undefined;
    if (!param || !options) continue;
    out[param] = [...(out[param] ?? []), ...options];
  }
  return out;
}

/** Скрытые параметры: visibleIf параметра + правила HIDE_PARAMS. */
export function hiddenParamsFromDefinition(def: DefinitionDto, values: RuleValues): Set<string> {
  const hidden = new Set<string>();
  for (const p of def.parameters) {
    if (p.visibleIf && !conditionMatches(p.visibleIf, values)) hidden.add(p.urlKey);
  }
  for (const rule of def.compatibility) {
    if (rule.kind !== 'HIDE_PARAMS') continue;
    if (!conditionMatches(rule.when, values)) continue;
    for (const key of (rule.target.params as string[] | undefined) ?? []) hidden.add(key);
  }
  return hidden;
}

/** Эффективные границы тиража: база definition + MIN_QTY/MAX_QTY/SET_BOUNDS. */
export function qtyBoundsFromDefinition(
  def: DefinitionDto,
  values: RuleValues,
): { min: number; max: number; step: number } {
  let { min, max, step } = def.qty;
  for (const rule of def.compatibility) {
    if (!conditionMatches(rule.when, values)) continue;
    if (rule.kind === 'MIN_QTY' && typeof rule.target.minQty === 'number') {
      min = Math.max(min, rule.target.minQty);
    } else if (rule.kind === 'SET_BOUNDS' && rule.target.param === 'qty') {
      if (typeof rule.target.min === 'number') min = rule.target.min;
      if (typeof rule.target.max === 'number') max = rule.target.max;
      if (typeof rule.target.step === 'number') step = rule.target.step;
    }
  }
  return { min, max, step };
}

/**
 * Доступность срочного изготовления по definition: параметр express должен
 * существовать, вариант «1» не должен быть отключён правилами, а MAX_QTY-
 * правила с условием по express — не должны нарушаться текущим тиражом.
 */
export function expressAvailabilityFromDefinition(
  def: DefinitionDto,
  values: RuleValues,
  qty: number,
): { ok: boolean; reason?: string } {
  if (!def.parameters.some((p) => p.urlKey === 'express')) return { ok: false };
  for (const rule of def.compatibility) {
    if (rule.kind === 'DISABLE_OPTIONS' && rule.target.param === 'express') {
      if (conditionMatches(rule.when, values) && ((rule.target.options as string[]) ?? []).includes('1')) {
        return { ok: false, reason: rule.message ?? undefined };
      }
    }
    if (rule.kind === 'MAX_QTY' && typeof rule.target.maxQty === 'number') {
      // Правило вида when {express:'1'}: проверяем гипотетическое включение.
      if (conditionMatches(rule.when, { ...values, express: '1' }) && qty > rule.target.maxQty) {
        return { ok: false, reason: rule.message ?? undefined };
      }
    }
  }
  return { ok: true };
}

/**
 * Нормализация выбора: если текущее значение параметра попало под
 * DISABLE_OPTIONS, выбирается первый доступный вариант из definition
 * (та же роль, что у normalizeParams для локального конфига).
 */
export function normalizeSelectionWithDefinition(def: DefinitionDto, params: Selection): Selection {
  const values: RuleValues = {};
  for (const [k, v] of Object.entries(params)) values[k] = v;
  const disabled = disabledOptionsFromDefinition(def, values);
  const fixed = { ...params };
  for (const [paramKey, disabledIds] of Object.entries(disabled)) {
    if (!disabledIds.includes(String(fixed[paramKey]))) continue;
    const param = def.parameters.find((p) => p.urlKey === paramKey);
    const fallback = param?.options.find((o) => !disabledIds.includes(o.value));
    if (fallback) fixed[paramKey] = fallback.value;
  }
  return fixed;
}

/**
 * Санитизация preset страницы по definition: остаются только известные
 * параметры с допустимыми значениями (+ qty в границах). Всё остальное —
 * неизвестные ключи, чужие option-значения, promo/b2b/upsells и т.п. —
 * молча отбрасывается: preset — только стартовое состояние, он не может
 * обойти правила definition.
 */
export function sanitizePresetForDefinition(
  def: DefinitionDto,
  preset: Record<string, unknown> | null | undefined,
): Selection {
  const out: Selection = {};
  if (!preset) return out;
  for (const [key, rawValue] of Object.entries(preset)) {
    if (rawValue === undefined || rawValue === null) continue;
    if (key === 'qty') {
      const qty = Number(rawValue);
      if (Number.isInteger(qty) && qty >= def.qty.min && qty <= def.qty.max) out.qty = qty;
      continue;
    }
    const param = def.parameters.find((p) => p.urlKey === key);
    if (!param) continue;
    const value = String(rawValue);
    if (param.options.length > 0) {
      if (param.options.some((o) => o.value === value)) out[key] = value;
    } else if (param.type === 'DIMENSION') {
      const n = Number(value);
      if (
        Number.isFinite(n) &&
        (param.min == null || n >= param.min) &&
        (param.max == null || n <= param.max)
      ) {
        out[key] = n;
      }
    } else if (param.type === 'TOGGLE') {
      if (value === '0' || value === '1') out[key] = value;
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Upsells, доступные при текущих значениях (visibleIf из definition). */
export function availableUpsellsFromDefinition(
  def: DefinitionDto,
  values: RuleValues,
): { code: string; label: string }[] {
  return def.upsells
    .filter((u) => conditionMatches(u.visibleIf, values))
    .map((u) => ({ code: u.code, label: u.label }));
}
