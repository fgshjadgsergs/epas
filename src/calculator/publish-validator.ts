/**
 * Publish-time валидация — отдельно от runtime-расчёта (Codex review, блок 5).
 * Чистые функции: то, что должно останавливать публикацию прайс-листа,
 * НЕ должно останавливать уже опубликованный расчёт (там — fail-closed
 * EngineConfigError, см. pricing-engine.ts). Здесь мы не даём дойти до этого.
 */

export interface PublishValidationIssue {
  code: string;
  message: string;
}

interface TierLike {
  id: string;
  condition: Record<string, string | string[]> | null;
  qtyFrom: number | null;
  qtyTo: number | null;
  sortOrder: number;
}

/** Стабильная строка условия для группировки правил по «одному и тому же случаю». */
function conditionKey(condition: Record<string, string | string[]> | null): string {
  if (!condition) return '∅';
  const entries = Object.entries(condition)
    .map(([k, v]) => [k, Array.isArray(v) ? [...v].sort() : v] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

/**
 * Проверка диапазонов правил одного KIND в рамках одного condition: нет
 * пересечений, нет дублей qtyFrom, открытый диапазон (qtyTo=null) — последний.
 *
 * BASE_TIER и QTY_DISCOUNT — РАЗНЫЕ лестницы и валидируются РАЗДЕЛЬНО:
 *  - BASE_TIER задаёт базовую цену → должна быть непрерывной и покрывать minQty
 *    (requireMinCoverage + forbidGaps = true);
 *  - QTY_DISCOUNT — модификатор результата (скидка от порога): базовое покрытие
 *    обеспечивает другая механика (BASE_TIER или BASE_PER_SQM), поэтому пороги
 *    скидок НЕ обязаны покрывать minQty и МОГУТ иметь разрывы
 *    (requireMinCoverage + forbidGaps = false), но пересекаться — нельзя.
 */
export function validateTierRanges(
  rules: TierLike[],
  minQty: number,
  options: { requireMinCoverage?: boolean; forbidGaps?: boolean } = {},
): PublishValidationIssue[] {
  const { requireMinCoverage = true, forbidGaps = true } = options;
  const issues: PublishValidationIssue[] = [];
  const groups = new Map<string, TierLike[]>();
  for (const rule of rules) {
    const key = conditionKey(rule.condition);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(rule);
  }

  for (const [key, group] of groups) {
    const sorted = [...group].sort((a, b) => (a.qtyFrom ?? 0) - (b.qtyFrom ?? 0));
    const seenFrom = new Set<number>();
    for (let i = 0; i < sorted.length; i++) {
      const rule = sorted[i];
      const from = rule.qtyFrom ?? 0;
      if (seenFrom.has(from)) {
        issues.push({
          code: 'DUPLICATE_TIER_START',
          message: `Несколько правил тиража начинаются с ${from} (условие ${key})`,
        });
      }
      seenFrom.add(from);

      const next = sorted[i + 1];
      if (rule.qtyTo != null && rule.qtyTo < from) {
        issues.push({ code: 'INVALID_TIER_RANGE', message: `qtyTo меньше qtyFrom в правиле ${rule.id}` });
      }
      if (next) {
        const thisEnd = rule.qtyTo ?? Infinity;
        if (thisEnd === Infinity) {
          issues.push({
            code: 'OPEN_RANGE_NOT_LAST',
            message: `Открытый диапазон (правило ${rule.id}) должен быть последним в условии ${key}`,
          });
        } else if (thisEnd >= (next.qtyFrom ?? 0)) {
          issues.push({
            code: 'OVERLAPPING_TIERS',
            message: `Пересекающиеся диапазоны тиража: правила ${rule.id} и ${next.id} (условие ${key})`,
          });
        } else if (forbidGaps && thisEnd + 1 < (next.qtyFrom ?? 0)) {
          issues.push({
            code: 'GAP_IN_TIERS',
            message: `Разрыв в диапазонах тиража между правилами ${rule.id} и ${next.id} (условие ${key})`,
          });
        }
      }
    }
    // Требование покрытия minQty относится только к безусловной («базовой»)
    // лестнице тиражей. Условные группы (напр. отдельная сетка для
    // subtype=plastic) — override для подмножества; их нижнюю границу
    // ограничивают правила совместимости (MIN_QTY/SET_BOUNDS). Для правил-
    // модификаторов (QTY_DISCOUNT) покрытие не требуется (requireMinCoverage=false).
    if (requireMinCoverage && key === '∅' && sorted.length > 0 && (sorted[0].qtyFrom ?? 0) > minQty) {
      issues.push({
        code: 'TIER_DOES_NOT_COVER_MIN_QTY',
        message: `Диапазоны тиража не покрывают минимальный тираж ${minQty} (условие ${key})`,
      });
    }
  }
  return issues;
}

interface OrderedRuleLike {
  id: string;
  kind: string;
  condition: Record<string, string | string[]> | null;
  sortOrder: number;
}

/**
 * Детерминированный порядок: два правила одного kind с одинаковым condition
 * и одинаковым sortOrder — неоднозначность (порядок применения не определён).
 */
export function validateDeterministicOrder(rules: OrderedRuleLike[]): PublishValidationIssue[] {
  const issues: PublishValidationIssue[] = [];
  const seen = new Map<string, string>();
  for (const rule of rules) {
    const key = `${rule.kind}::${conditionKey(rule.condition)}::${rule.sortOrder}`;
    const existing = seen.get(key);
    if (existing) {
      issues.push({
        code: 'AMBIGUOUS_SORT_ORDER',
        message: `Правила ${existing} и ${rule.id} имеют одинаковый sortOrder при равном условии (${rule.kind})`,
      });
    } else {
      seen.set(key, rule.id);
    }
  }
  return issues;
}

interface SetBoundsRuleLike {
  id: string;
  kind: string;
  when: Record<string, string | string[]>;
  target: { param?: string; min?: number; max?: number; step?: number; required?: boolean };
}

interface BoundedParamLike {
  urlKey: string;
  type: string;
  minValue: number | null;
  maxValue: number | null;
}

/**
 * Publish-time проверка SET_BOUNDS (Codex review v2, блок 4):
 * - target.param должен существовать (или быть «qty»);
 * - min/max/step применимы только к qty и DIMENSION-параметрам;
 * - effective-диапазон (override поверх базового) не должен быть пустым;
 * - step > 0;
 * - никаких циклов: when не может ссылаться на параметр, который сам является
 *   числовой целью какого-либо SET_BOUNDS (иначе порядок применения границ
 *   влиял бы на контекст сопоставления условий), и не может ссылаться на qty.
 */
export function validateSetBoundsRules(
  rules: SetBoundsRuleLike[],
  parameters: BoundedParamLike[],
): PublishValidationIssue[] {
  const issues: PublishValidationIssue[] = [];
  const setBounds = rules.filter((r) => r.kind === 'SET_BOUNDS');
  const paramsByKey = new Map(parameters.map((p) => [p.urlKey, p]));
  const numericTargets = new Set<string>();
  for (const rule of setBounds) {
    const t = rule.target;
    if (t.param && (t.min !== undefined || t.max !== undefined || t.step !== undefined)) {
      numericTargets.add(t.param);
    }
  }

  for (const rule of setBounds) {
    const targetKey = rule.target.param;
    if (!targetKey) {
      issues.push({ code: 'SET_BOUNDS_NO_TARGET', message: `SET_BOUNDS ${rule.id} без target.param` });
      continue;
    }
    const hasNumeric =
      rule.target.min !== undefined || rule.target.max !== undefined || rule.target.step !== undefined;
    const param = paramsByKey.get(targetKey);
    if (targetKey !== 'qty' && !param) {
      issues.push({
        code: 'SET_BOUNDS_UNKNOWN_TARGET',
        message: `SET_BOUNDS ${rule.id}: неизвестный параметр «${targetKey}»`,
      });
      continue;
    }
    if (hasNumeric && targetKey !== 'qty' && param && param.type !== 'DIMENSION') {
      issues.push({
        code: 'SET_BOUNDS_INCOMPATIBLE_TYPE',
        message: `SET_BOUNDS ${rule.id}: min/max/step неприменимы к параметру «${targetKey}» типа ${param.type}`,
      });
    }
    if (rule.target.step !== undefined && rule.target.step <= 0) {
      issues.push({ code: 'SET_BOUNDS_STEP_NOT_POSITIVE', message: `SET_BOUNDS ${rule.id}: step должен быть > 0` });
    }
    // Effective-диапазон: override поверх базовых границ параметра.
    const baseMin = targetKey === 'qty' ? null : param?.minValue ?? null;
    const baseMax = targetKey === 'qty' ? null : param?.maxValue ?? null;
    const effMin = rule.target.min ?? baseMin;
    const effMax = rule.target.max ?? baseMax;
    if (effMin != null && effMax != null && effMin > effMax) {
      issues.push({
        code: 'SET_BOUNDS_IMPOSSIBLE_RANGE',
        message: `SET_BOUNDS ${rule.id}: пустой диапазон min=${effMin} > max=${effMax} для «${targetKey}»`,
      });
    }
    // Циклы: условие не может зависеть от числовой цели SET_BOUNDS или qty —
    // границы меняют значение (выравнивание по шагу), а значит и контекст.
    for (const whenKey of Object.keys(rule.when ?? {})) {
      if (whenKey === 'qty' || numericTargets.has(whenKey)) {
        issues.push({
          code: 'SET_BOUNDS_CYCLE',
          message: `SET_BOUNDS ${rule.id}: условие по «${whenKey}» создаёт циклическую зависимость границ`,
        });
      }
    }
  }
  return issues;
}

interface MetricLike {
  kind: 'AREA' | 'PERIMETER' | 'INTERVAL_COUNT';
  code: string;
  widthParam?: string;
  heightParam?: string;
  sourceMetric?: string;
  interval?: number;
  intervalParam?: string;
  minCount?: number;
  maxCount?: number;
}

interface MetricParamLike {
  urlKey: string;
  type: string;
}

/**
 * Publish-проверка производных метрик (блок формульных надбавок):
 * - уникальные коды;
 * - width/height существуют и имеют тип DIMENSION;
 * - INTERVAL_COUNT ссылается только на РАНЕЕ объявленную метрику длины
 *   (PERIMETER) — циклические зависимости невозможны;
 * - interval > 0, intervalParam существует и DIMENSION;
 * - minCount ≤ maxCount.
 */
export function validateDerivedMetrics(
  metrics: MetricLike[],
  parameters: MetricParamLike[],
): PublishValidationIssue[] {
  const issues: PublishValidationIssue[] = [];
  const paramsByKey = new Map(parameters.map((p) => [p.urlKey, p]));
  const seenCodes = new Map<string, MetricLike>();

  for (const metric of metrics) {
    if (seenCodes.has(metric.code)) {
      issues.push({ code: 'METRIC_DUPLICATE_CODE', message: `Метрика «${metric.code}» объявлена дважды` });
    }
    if (metric.kind === 'AREA' || metric.kind === 'PERIMETER') {
      for (const key of [metric.widthParam, metric.heightParam]) {
        if (!key) {
          issues.push({ code: 'METRIC_NO_DIMENSIONS', message: `Метрика «${metric.code}» без width/height` });
          continue;
        }
        const param = paramsByKey.get(key);
        if (!param) {
          issues.push({ code: 'METRIC_UNKNOWN_PARAM', message: `Метрика «${metric.code}»: нет параметра «${key}»` });
        } else if (param.type !== 'DIMENSION') {
          issues.push({
            code: 'METRIC_INCOMPATIBLE_PARAM',
            message: `Метрика «${metric.code}»: параметр «${key}» не DIMENSION`,
          });
        }
      }
    } else {
      const source = metric.sourceMetric ? seenCodes.get(metric.sourceMetric) : undefined;
      if (!source) {
        issues.push({
          code: 'METRIC_UNKNOWN_SOURCE',
          message: `Метрика «${metric.code}» ссылается на необъявленную ранее «${metric.sourceMetric ?? ''}»`,
        });
      } else if (source.kind !== 'PERIMETER') {
        issues.push({
          code: 'METRIC_SOURCE_NOT_LENGTH',
          message: `Метрика «${metric.code}»: источник «${source.code}» не является метрикой длины`,
        });
      }
      if (metric.interval !== undefined && metric.interval <= 0) {
        issues.push({ code: 'METRIC_INTERVAL_NOT_POSITIVE', message: `Метрика «${metric.code}»: interval ≤ 0` });
      }
      if (metric.interval === undefined && metric.intervalParam === undefined) {
        issues.push({ code: 'METRIC_NO_INTERVAL', message: `Метрика «${metric.code}» без interval/intervalParam` });
      }
      if (metric.intervalParam !== undefined) {
        const param = paramsByKey.get(metric.intervalParam);
        if (!param) {
          issues.push({
            code: 'METRIC_UNKNOWN_INTERVAL_PARAM',
            message: `Метрика «${metric.code}»: нет параметра шага «${metric.intervalParam}»`,
          });
        } else if (param.type !== 'DIMENSION') {
          issues.push({
            code: 'METRIC_INCOMPATIBLE_INTERVAL_PARAM',
            message: `Метрика «${metric.code}»: параметр шага «${metric.intervalParam}» не DIMENSION`,
          });
        }
      }
      if (metric.minCount !== undefined && metric.maxCount !== undefined && metric.minCount > metric.maxCount) {
        issues.push({ code: 'METRIC_COUNT_RANGE', message: `Метрика «${metric.code}»: minCount > maxCount` });
      }
    }
    seenCodes.set(metric.code, metric);
  }
  return issues;
}

interface MetricRuleLike {
  id: string;
  kind: string;
  config: {
    sourceMetric?: string;
    interval?: number;
    intervalParam?: string;
    minCount?: number;
    maxCount?: number;
  } | null;
}

/**
 * Publish-проверка метрических прайс-правил: PER_LENGTH требует метрику
 * длины (PERIMETER), INTERVAL_COUNT — метрику длины и валидный шаг.
 */
export function validateMetricPriceRules(
  rules: MetricRuleLike[],
  metrics: MetricLike[],
  parameters: MetricParamLike[],
): PublishValidationIssue[] {
  const issues: PublishValidationIssue[] = [];
  const metricsByCode = new Map(metrics.map((m) => [m.code, m]));
  const paramsByKey = new Map(parameters.map((p) => [p.urlKey, p]));

  for (const rule of rules) {
    if (rule.kind !== 'SURCHARGE_PER_LENGTH' && rule.kind !== 'SURCHARGE_PER_INTERVAL_COUNT') continue;
    const cfg = rule.config;
    if (!cfg?.sourceMetric) {
      issues.push({ code: 'RULE_NO_SOURCE_METRIC', message: `Правило ${rule.id} без sourceMetric` });
      continue;
    }
    const source = metricsByCode.get(cfg.sourceMetric);
    if (!source) {
      issues.push({
        code: 'RULE_UNKNOWN_METRIC',
        message: `Правило ${rule.id} ссылается на несуществующую метрику «${cfg.sourceMetric}»`,
      });
      continue;
    }
    if (source.kind !== 'PERIMETER') {
      issues.push({
        code: 'RULE_METRIC_NOT_LENGTH',
        message: `Правило ${rule.id}: метрика «${cfg.sourceMetric}» не является длиной`,
      });
    }
    if (rule.kind === 'SURCHARGE_PER_INTERVAL_COUNT') {
      if (cfg.interval === undefined && cfg.intervalParam === undefined) {
        issues.push({ code: 'RULE_NO_INTERVAL', message: `Правило ${rule.id} без interval/intervalParam` });
      }
      if (cfg.interval !== undefined && cfg.interval <= 0) {
        issues.push({ code: 'RULE_INTERVAL_NOT_POSITIVE', message: `Правило ${rule.id}: interval ≤ 0` });
      }
      if (cfg.intervalParam !== undefined && paramsByKey.get(cfg.intervalParam)?.type !== 'DIMENSION') {
        issues.push({
          code: 'RULE_BAD_INTERVAL_PARAM',
          message: `Правило ${rule.id}: параметр шага «${cfg.intervalParam}» отсутствует или не DIMENSION`,
        });
      }
      if (cfg.minCount !== undefined && cfg.maxCount !== undefined && cfg.minCount > cfg.maxCount) {
        issues.push({ code: 'RULE_COUNT_RANGE', message: `Правило ${rule.id}: minCount > maxCount` });
      }
    }
  }
  return issues;
}

interface MultiQtyRuleLike {
  id: string;
  kind: string;
  condition: Record<string, string | string[]> | null;
  qtyFrom: number | null;
  qtyTo: number | null;
  amountMinor: number | null;
  config: { sourceParameter?: string; lineKey?: string } | null;
  sortOrder: number;
}

interface MultiQtyParamLike {
  urlKey: string;
  type: string;
  options: { value: string; isActive: boolean }[];
  multiQty: { lineMin: number; lineOverrides?: Record<string, { min?: number }> } | null;
}

/**
 * Publish-проверка построчных правил MULTI_QTY:
 * - построчная база не смешивается с BASE_TIER/BASE_PER_SQM;
 * - sourceParameter существует и имеет тип MULTI_QTY;
 * - lineKey — активная опция строки;
 * - в рамках строки (и одного condition) диапазоны line-qty не пересекаются,
 *   не имеют дыр и покрывают минимум строки (reuse validateTierRanges);
 * - каждая АКТИВНАЯ строка имеет безусловное ценовое покрытие — иначе
 *   расчёт для неё падал бы fail-closed.
 */
export function validateMultiQtyLineRules(
  rules: MultiQtyRuleLike[],
  parameters: MultiQtyParamLike[],
): PublishValidationIssue[] {
  const issues: PublishValidationIssue[] = [];
  const lineRules = rules.filter((r) => r.kind === 'BASE_PER_MULTI_QTY_LINE');
  if (lineRules.length === 0) return issues;

  if (rules.some((r) => r.kind === 'BASE_TIER' || r.kind === 'BASE_PER_SQM')) {
    issues.push({
      code: 'MIXED_BASE_KINDS',
      message: 'Построчная база (BASE_PER_MULTI_QTY_LINE) несовместима с BASE_TIER/BASE_PER_SQM',
    });
  }

  const multiParams = new Map(
    parameters.filter((p) => p.type === 'MULTI_QTY').map((p) => [p.urlKey, p]),
  );

  const byParam = new Map<string, MultiQtyRuleLike[]>();
  for (const rule of lineRules) {
    const source = rule.config?.sourceParameter;
    const lineKey = rule.config?.lineKey;
    if (!source || !lineKey) {
      issues.push({ code: 'LINE_RULE_NO_CONFIG', message: `Правило ${rule.id} без sourceParameter/lineKey` });
      continue;
    }
    const param = multiParams.get(source);
    if (!param) {
      issues.push({
        code: 'LINE_RULE_UNKNOWN_SOURCE',
        message: `Правило ${rule.id}: параметр «${source}» отсутствует или не MULTI_QTY`,
      });
      continue;
    }
    if (!param.options.some((o) => o.isActive && o.value === lineKey)) {
      issues.push({
        code: 'LINE_RULE_UNKNOWN_LINE',
        message: `Правило ${rule.id}: строка «${lineKey}» не является активной опцией «${source}»`,
      });
      continue;
    }
    if (!byParam.has(source)) byParam.set(source, []);
    byParam.get(source)!.push(rule);
  }

  for (const [source, paramRules] of byParam) {
    const param = multiParams.get(source)!;
    for (const option of param.options.filter((o) => o.isActive)) {
      const ofLine = paramRules.filter((r) => r.config?.lineKey === option.value);
      const unconditional = ofLine.filter((r) => r.condition === null);
      if (unconditional.length === 0) {
        issues.push({
          code: 'LINE_WITHOUT_PRICE',
          message: `Активная строка «${option.value}» параметра «${source}» без безусловной цены`,
        });
        continue;
      }
      // Минимальное ТАРИФИЦИРУЕМОЕ количество строки: нулевые строки удаляются
      // при нормализации, поэтому покрытие требуется от max(1, min строки).
      const lineMin = Math.max(
        1,
        param.multiQty?.lineOverrides?.[option.value]?.min ?? param.multiQty?.lineMin ?? 1,
      );
      issues.push(
        ...validateTierRanges(
          ofLine.map((r) => ({
            id: r.id,
            condition: r.condition,
            qtyFrom: r.qtyFrom ?? 1,
            qtyTo: r.qtyTo,
            sortOrder: r.sortOrder,
          })),
          lineMin,
        ).map((issue) => ({ ...issue, message: `Строка «${option.value}»: ${issue.message}` })),
      );
      for (const rule of ofLine) {
        if (rule.amountMinor === null || rule.amountMinor < 0) {
          issues.push({ code: 'LINE_RULE_BAD_AMOUNT', message: `Правило ${rule.id}: некорректный amountMinor` });
        }
      }
    }
  }
  return issues;
}

interface PresetParamLike {
  urlKey: string;
  type: string;
  minValue: number | null;
  maxValue: number | null;
  options: { value: string; isActive: boolean }[];
}

/**
 * Валидация preset страницы/binding по definition: preset — только стартовое
 * состояние, он не может содержать неизвестные параметры (в т.ч. price/promo/
 * b2b/upsells — таких параметров в definition нет) и недопустимые значения,
 * и не может обходить границы. Используется при отдаче binding наружу
 * (fail-closed) и пригодна для будущего admin-сохранения binding.
 */
export function validatePresetAgainstDefinition(
  preset: Record<string, string>,
  definition: { minQty: number; maxQty: number; parameters: PresetParamLike[] },
): PublishValidationIssue[] {
  const issues: PublishValidationIssue[] = [];
  const byKey = new Map(definition.parameters.map((p) => [p.urlKey, p]));
  for (const [key, value] of Object.entries(preset)) {
    if (key === 'qty') {
      const qty = Number(value);
      if (!Number.isInteger(qty) || qty < definition.minQty || qty > definition.maxQty) {
        issues.push({ code: 'PRESET_QTY_OUT_OF_RANGE', message: `qty=${value} вне диапазона тиража` });
      }
      continue;
    }
    const param = byKey.get(key);
    if (!param) {
      issues.push({ code: 'PRESET_UNKNOWN_PARAM', message: `Неизвестный параметр «${key}» в preset` });
      continue;
    }
    if (param.options.length > 0) {
      if (!param.options.some((o) => o.isActive && o.value === value)) {
        issues.push({ code: 'PRESET_INVALID_OPTION', message: `Недопустимое значение «${value}» параметра «${key}»` });
      }
    } else if (param.type === 'DIMENSION') {
      const n = Number(value);
      if (
        !Number.isFinite(n) ||
        (param.minValue != null && n < param.minValue) ||
        (param.maxValue != null && n > param.maxValue)
      ) {
        issues.push({ code: 'PRESET_DIMENSION_OUT_OF_RANGE', message: `«${key}»=${value} вне допустимого диапазона` });
      }
    } else if (param.type === 'TOGGLE' && value !== '0' && value !== '1') {
      issues.push({ code: 'PRESET_INVALID_TOGGLE', message: `«${key}» должен быть «0» или «1»` });
    }
  }
  return issues;
}

interface PeriodLike {
  id: string;
  validFrom: Date | null;
  validTo: Date | null;
}

/** validFrom < validTo, если оба заданы. */
export function validatePeriod(period: { validFrom: Date | null; validTo: Date | null }): PublishValidationIssue[] {
  if (period.validFrom && period.validTo && period.validFrom >= period.validTo) {
    return [{ code: 'INVALID_PERIOD', message: 'validFrom должен быть раньше validTo' }];
  }
  return [];
}

/** Пересекаются ли два периода (null = открытая граница). */
function periodsOverlap(a: PeriodLike, b: PeriodLike): boolean {
  const aFrom = a.validFrom?.getTime() ?? -Infinity;
  const aTo = a.validTo?.getTime() ?? Infinity;
  const bFrom = b.validFrom?.getTime() ?? -Infinity;
  const bTo = b.validTo?.getTime() ?? Infinity;
  return aFrom < bTo && bFrom < aTo;
}

/** Прайс-листы, конфликтующие по периоду с публикуемым (для 409). */
export function findConflictingPeriods(candidate: PeriodLike, activeOthers: PeriodLike[]): PeriodLike[] {
  return activeOthers.filter((other) => other.id !== candidate.id && periodsOverlap(candidate, other));
}
