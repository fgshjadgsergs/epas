/**
 * Универсальный URL-state слой калькуляторов (ТЗ «URL-адреса в калькуляторах»).
 *
 * Чистые функции без window — работают и на сервере, и в тестах.
 * Правила:
 * - в URL только shareable-параметры со стабильными машинными значениями;
 * - порядок ключей фиксирован (spec.order) → одна конфигурация = один URL;
 * - значения по умолчанию в URL не пишутся;
 * - promo/b2b/upsells и прочие запрещённые данные в spec не включаются
 *   вообще либо помечаются shareable: false;
 * - неизвестные ключи чужих систем (utm_* и т.п.) не трогаем;
 * - некорректное значение игнорируется (используется default), ключ
 *   попадает в invalidKeys — вызывающий код нормализует URL replaceState'ом.
 */

export interface UrlParamSpec {
  key: string;
  /** false — параметр никогда не сериализуется и не читается из URL. */
  shareable: boolean;
  /** Строковый дефолт; совпадающие с ним значения в URL не пишутся. */
  defaultValue: string;
  /** Допустимые машинные значения (для параметров с вариантами). */
  allowedValues?: string[];
  /** Числовой параметр: валидация диапазона. */
  numeric?: { min?: number; max?: number };
  /**
   * MULTI_QTY-параметр: значение — строка «key:qty,key:qty» (формат общий для
   * фотопечати и будущих футболок; в ТЗ формат не задан — решение
   * задокументировано в docs/calculator-machine-values.md). Список ключей
   * задаёт и белый список строк, и канонический порядок сериализации.
   */
  multiQtyKeys?: string[];
}

/** Верхняя крышка длины multi-qty значения в URL. */
const MULTI_QTY_MAX_LENGTH = 500;
const MULTI_QTY_MAX_LINE_QTY = 1_000_000;

/**
 * Канонизация multi-qty строки «key:qty,…»: неизвестные ключи и некорректные
 * количества отбрасываются, дубликаты схлопываются (первый выигрывает),
 * порядок строк — порядок allowedKeys (одна конфигурация = одна строка URL).
 * null — валидных строк не осталось (пустое значение в URL не пишется).
 */
export function canonicalizeMultiQty(raw: string, allowedKeys: string[]): string | null {
  if (raw.length > MULTI_QTY_MAX_LENGTH) return null;
  const counts = new Map<string, number>();
  for (const part of raw.split(',')) {
    if (!part) continue;
    const [key, qtyRaw] = part.split(':');
    if (!key || !allowedKeys.includes(key)) continue;
    if (counts.has(key)) continue;
    const qty = Number(qtyRaw);
    if (!Number.isInteger(qty) || qty <= 0 || qty > MULTI_QTY_MAX_LINE_QTY) continue;
    counts.set(key, qty);
  }
  if (counts.size === 0) return null;
  return allowedKeys.filter((k) => counts.has(k)).map((k) => `${k}:${counts.get(k)}`).join(',');
}

export interface UrlStateSpec {
  /** Порядок ключей в query string (urlOrder определения). */
  order: string[];
  params: UrlParamSpec[];
}

export interface ParsedUrlState {
  /** Валидные значения из URL (только shareable-ключи spec). */
  values: Record<string, string>;
  /** Наши ключи с некорректными значениями — повод для replaceState-нормализации. */
  invalidKeys: string[];
}

function specIndex(spec: UrlStateSpec): Map<string, UrlParamSpec> {
  return new Map(spec.params.map((p) => [p.key, p]));
}

function isValidValue(param: UrlParamSpec, value: string): boolean {
  if (param.allowedValues) return param.allowedValues.includes(value);
  if (param.numeric) {
    const n = Number(value);
    if (!Number.isFinite(n)) return false;
    if (param.numeric.min !== undefined && n < param.numeric.min) return false;
    if (param.numeric.max !== undefined && n > param.numeric.max) return false;
  }
  return true;
}

/**
 * Сериализация состояния в query string. Детерминированная: одинаковые
 * значения дают побайтово одинаковую строку. Пустая строка = «без ?».
 */
export function serializeUrlState(
  spec: UrlStateSpec,
  values: Record<string, string | number | boolean | undefined>,
): string {
  const byKey = specIndex(spec);
  const orderedKeys = [
    ...spec.order,
    ...spec.params.map((p) => p.key).filter((k) => !spec.order.includes(k)),
  ];
  const sp = new URLSearchParams();
  const seen = new Set<string>();
  for (const key of orderedKeys) {
    if (seen.has(key)) continue;
    seen.add(key);
    const param = byKey.get(key);
    if (!param || !param.shareable) continue;
    const raw = values[key];
    if (raw === undefined || raw === null || raw === '') continue;
    const str = typeof raw === 'boolean' ? (raw ? '1' : '0') : String(raw);
    if (param.multiQtyKeys) {
      const canonical = canonicalizeMultiQty(str, param.multiQtyKeys);
      if (canonical === null) continue; // пустой multi-qty не мусорит query
      const canonicalDefault = canonicalizeMultiQty(param.defaultValue, param.multiQtyKeys);
      if (canonical === canonicalDefault) continue;
      sp.set(key, canonical);
      continue;
    }
    if (str === param.defaultValue) continue; // дефолты не включаем
    sp.set(key, str);
  }
  return sp.toString();
}

/** Восстановление состояния из query string (init и popstate). */
export function parseUrlState(spec: UrlStateSpec, search: string | URLSearchParams): ParsedUrlState {
  const sp = typeof search === 'string' ? new URLSearchParams(search) : search;
  const byKey = specIndex(spec);
  const values: Record<string, string> = {};
  const invalidKeys: string[] = [];
  for (const [key, value] of sp.entries()) {
    const param = byKey.get(key);
    if (!param) continue; // чужие ключи (utm и т.п.) игнорируем
    if (!param.shareable) continue; // запрещённые к шарингу не читаем из URL
    if (param.multiQtyKeys) {
      // Multi-qty: неизвестные строки/дубликаты/мусор канонизируются; если
      // строка изменилась — помечаем на replaceState-нормализацию.
      const canonical = canonicalizeMultiQty(value, param.multiQtyKeys);
      if (canonical === null) {
        invalidKeys.push(key);
        continue;
      }
      if (canonical !== value) invalidKeys.push(key);
      values[key] = canonical;
      continue;
    }
    if (!isValidValue(param, value)) {
      // Legacy-регистр machine value (a4 vs A4): принимаем и приводим к
      // каноническому значению; ключ помечается на нормализацию URL —
      // replaceState перепишет query без pushState и без нового hit.
      const canonical = param.allowedValues?.find((v) => v.toLowerCase() === value.toLowerCase());
      if (canonical !== undefined) {
        values[key] = canonical;
        invalidKeys.push(key);
        continue;
      }
      invalidKeys.push(key); // некорректное значение → default + нормализация URL
      continue;
    }
    values[key] = value;
  }
  return { values, invalidKeys };
}

/**
 * Итоговая строка поиска для адресной строки: наши ключи в каноническом
 * порядке + чужие параметры (utm-метки и пр.) без изменений.
 */
export function mergeSearch(
  spec: UrlStateSpec,
  serialized: string,
  currentSearch: string | URLSearchParams,
): string {
  const ours = new Set(spec.params.map((p) => p.key));
  const current = typeof currentSearch === 'string' ? new URLSearchParams(currentSearch) : currentSearch;
  const foreign = new URLSearchParams();
  for (const [key, value] of current.entries()) {
    if (!ours.has(key)) foreign.append(key, value);
  }
  const parts = [serialized, foreign.toString()].filter(Boolean);
  return parts.join('&');
}

/** Полный URL без домена; пустой search не добавляет «?». */
export function buildUrl(pathname: string, search: string): string {
  return search ? `${pathname}?${search}` : pathname;
}
