/**
 * Runtime-валидация JSON-конфигурации движка (Codex review, блок 6).
 *
 * Все JSON-поля БД (visibleIf/when/target/condition/preset/config) проходят
 * через zod-схемы:
 * - при записи/публикации (publish-сервис);
 * - повторно при загрузке бандла для расчёта (fail-closed: повреждённое или
 *   неизвестное правило → конфигурационная ошибка, цена не считается).
 *
 * Версионируемость: дискриминированные объединения по `kind`; неизвестный
 * kind не проходит схему и отклоняется, а не игнорируется.
 */
import { z } from 'zod';

/** Версия алгоритма движка — пишется в CalculationSnapshot.engineVersion. */
export const ENGINE_VERSION = 'engine/2';

const SAFE_KEY = /^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export const safeKeySchema = z
  .string()
  .regex(SAFE_KEY, 'Недопустимый ключ параметра')
  .refine((k) => !FORBIDDEN_KEYS.has(k), 'Запрещённый ключ');

const conditionValueSchema = z.union([
  z.string().max(100),
  z.array(z.string().max(100)).min(1).max(50),
]);

/** {"param": "value" | ["v1","v2"]} — до 10 пар, значения ≤100 симв. */
export const conditionSchema = z
  .record(safeKeySchema, conditionValueSchema)
  .refine((obj) => Object.keys(obj).length <= 10, 'Слишком много условий в правиле');

export const compatRuleSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('DISABLE_OPTIONS'),
    when: conditionSchema,
    target: z.object({
      param: safeKeySchema,
      options: z.array(z.string().max(100)).min(1).max(100),
    }),
  }),
  z.object({
    kind: z.literal('HIDE_PARAMS'),
    when: conditionSchema,
    target: z.object({ params: z.array(safeKeySchema).min(1).max(20) }),
  }),
  z.object({
    kind: z.literal('MIN_QTY'),
    when: conditionSchema,
    target: z.object({ minQty: z.number().int().positive() }),
  }),
  z.object({
    kind: z.literal('MAX_QTY'),
    when: conditionSchema,
    target: z.object({ maxQty: z.number().int().positive() }),
  }),
  // Условные границы (блок 7): min/max/step/required для qty или параметра.
  z.object({
    kind: z.literal('SET_BOUNDS'),
    when: conditionSchema,
    target: z
      .object({
        param: safeKeySchema, // 'qty' или urlKey DIMENSION-параметра
        min: z.number().optional(),
        max: z.number().optional(),
        step: z.number().positive().optional(),
        required: z.boolean().optional(),
      })
      .refine(
        (t) => t.min !== undefined || t.max !== undefined || t.step !== undefined || t.required !== undefined,
        'SET_BOUNDS без эффекта',
      ),
  }),
]);

/** Единицы длины (совпадают с единицами площади: mm/cm/m). */
export const lengthUnitSchema = z.enum(['mm', 'cm', 'm']);

/**
 * Производные метрики (Codex-класс задач «формульные надбавки»): строго
 * типизированный ограниченный набор операций, БЕЗ произвольных формул и
 * исполняемого кода из БД. Вычисляются на одно изделие; порядок в массиве
 * фиксирует порядок вычисления (INTERVAL_COUNT может ссылаться только на
 * метрику, объявленную РАНЬШЕ — цикл невозможен по построению).
 */
export const derivedMetricSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('AREA'),
    code: safeKeySchema,
    label: z.string().max(60),
    widthParam: safeKeySchema,
    heightParam: safeKeySchema,
    unit: lengthUnitSchema,
    when: conditionSchema.nullish(),
  }),
  z.object({
    kind: z.literal('PERIMETER'),
    code: safeKeySchema,
    label: z.string().max(60),
    widthParam: safeKeySchema,
    heightParam: safeKeySchema,
    unit: lengthUnitSchema,
    when: conditionSchema.nullish(),
  }),
  z.object({
    kind: z.literal('INTERVAL_COUNT'),
    code: safeKeySchema,
    label: z.string().max(60),
    /** Код ранее объявленной метрики длины (напр. периметр). */
    sourceMetric: safeKeySchema,
    /** Фиксированный шаг в МЕТРАХ (fallback, если параметр не задан/скрыт). */
    interval: z.number().positive().max(1000).optional(),
    /** DIMENSION-параметр, которым пользователь выбирает шаг. */
    intervalParam: safeKeySchema.optional(),
    /** Единица значения intervalParam. */
    intervalUnit: lengthUnitSchema.optional(),
    rounding: z.literal('CEIL'),
    minCount: z.number().int().min(0).optional(),
    maxCount: z.number().int().positive().optional(),
    when: conditionSchema.nullish(),
  }).refine((m) => m.interval !== undefined || m.intervalParam !== undefined, 'INTERVAL_COUNT без interval/intervalParam'),
]);

/**
 * Конфигурация правила «базовая цена строки MULTI_QTY»: тарифицирует ОДНУ
 * конкретную строку (формат фотопечати, размер футболки) её собственным
 * количеством. Диапазоны qtyFrom/qtyTo применяются к количеству СТРОКИ,
 * не к общему количеству заказа (скидка от общего объёма — отдельная
 * семантика QTY_DISCOUNT).
 */
export const multiQtyLineRuleConfigSchema = z
  .object({
    /** urlKey MULTI_QTY-параметра. */
    sourceParameter: safeKeySchema,
    /** Machine key строки (значение CalculatorOption). */
    lineKey: z.string().min(1).max(60),
  })
  .strict();

/** Конфигурация правила «надбавка за длину» (за единицу длины метрики). */
export const perLengthRuleConfigSchema = z
  .object({
    /** Код метрики-источника длины (PERIMETER). */
    sourceMetric: safeKeySchema,
    /** Единица, за которую задан amountMinor (напр. «за метр»). */
    unit: lengthUnitSchema,
    /** Надбавка на каждое изделие (умножается на qty); false — на весь заказ. */
    perItem: z.boolean().default(true),
  })
  .strict();

/** Конфигурация правила «надбавка за количество интервалов» (люверсы и т.п.). */
export const perIntervalRuleConfigSchema = z
  .object({
    sourceMetric: safeKeySchema,
    /** Фиксированный шаг в МЕТРАХ (fallback). */
    interval: z.number().positive().max(1000).optional(),
    /** DIMENSION-параметр с пользовательским шагом. */
    intervalParam: safeKeySchema.optional(),
    intervalUnit: lengthUnitSchema.optional(),
    rounding: z.literal('CEIL'),
    minCount: z.number().int().min(0).optional(),
    maxCount: z.number().int().positive().optional(),
    perItem: z.boolean().default(true),
  })
  .strict()
  .refine((c) => c.interval !== undefined || c.intervalParam !== undefined, 'Нет interval/intervalParam');

export const priceRuleFieldsSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('BASE_TIER'),
    condition: conditionSchema.nullish(),
    qtyFrom: z.number().int().positive(),
    qtyTo: z.number().int().positive().nullish(),
    amountMinor: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal('BASE_PER_SQM'),
    condition: conditionSchema.nullish(),
    amountMinor: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal('MULTIPLIER'),
    condition: conditionSchema.nullish(),
    multiplier: z.number().positive().max(100),
  }),
  z.object({
    kind: z.literal('SURCHARGE_FLAT'),
    condition: conditionSchema.nullish(),
    amountMinor: z.number().int(),
  }),
  z.object({
    kind: z.literal('SURCHARGE_PER_UNIT'),
    condition: conditionSchema.nullish(),
    amountMinor: z.number().int(),
  }),
  z.object({
    kind: z.literal('QTY_DISCOUNT'),
    condition: conditionSchema.nullish(),
    qtyFrom: z.number().int().positive(),
    qtyTo: z.number().int().positive().nullish(),
    multiplier: z.number().positive().max(1),
  }),
  z.object({
    kind: z.literal('MIN_TOTAL'),
    condition: conditionSchema.nullish(),
    amountMinor: z.number().int().nonnegative(),
  }),
  // Базовая цена одной строки MULTI_QTY: amountMinor — копейки за единицу
  // строки; qtyFrom/qtyTo — диапазон по количеству ЭТОЙ строки.
  z.object({
    kind: z.literal('BASE_PER_MULTI_QTY_LINE'),
    condition: conditionSchema.nullish(),
    qtyFrom: z.number().int().positive().nullish(),
    qtyTo: z.number().int().positive().nullish(),
    amountMinor: z.number().int().min(0).max(10_000_000),
    config: multiQtyLineRuleConfigSchema,
  }),
  // Универсальная надбавка «за длину» (подгиб/обшивка по периметру и т.п.):
  // amountMinor — копейки за одну config.unit длины метрики sourceMetric.
  z.object({
    kind: z.literal('SURCHARGE_PER_LENGTH'),
    condition: conditionSchema.nullish(),
    amountMinor: z.number().int().min(0).max(10_000_000),
    config: perLengthRuleConfigSchema,
  }),
  // Универсальная надбавка «за количество интервалов» (люверсы каждые N см):
  // count = CEIL(длина / шаг), amountMinor — копейки за единицу count.
  z.object({
    kind: z.literal('SURCHARGE_PER_INTERVAL_COUNT'),
    condition: conditionSchema.nullish(),
    amountMinor: z.number().int().min(0).max(10_000_000),
    config: perIntervalRuleConfigSchema,
  }),
]);

export const productionRuleSchema = z.object({
  condition: conditionSchema.nullish(),
  workingDays: z.number().int().min(0).max(365),
  // Часы 00–23, минуты 00–59: «99:99» отклоняется (Codex review v2, блок 8).
  cutoff: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, 'cutoff должен быть временем HH:MM (00:00–23:59)'),
  priority: z.number().int(),
});

export const presetSchema = z.record(safeKeySchema, z.string().max(100));

export const visibleIfSchema = conditionSchema;

/** Единицы измерения DIMENSION-параметров площади. */
export const areaUnitSchema = z.enum(['mm', 'cm', 'm']);

/** Настройки definition (config Json). */
export const definitionConfigSchema = z
  .object({
    area: z
      .object({
        unit: areaUnitSchema,
        /** Минимальная оплачиваемая площадь, м² (Decimal-строка или число). */
        minBillableSqm: z.number().positive().optional(),
        /** Максимальная площадь одной позиции, м². */
        maxSqm: z.number().positive().optional(),
      })
      .optional(),
    /** Производные метрики изделия (площадь/периметр/кол-во интервалов). */
    metrics: z.array(derivedMetricSchema).max(10).optional(),
    /**
     * Производный тираж: qty = произведение перечисленных целочисленных
     * параметров (ТЗ 2.2 «оригиналы × копии»). Пользователь тираж не вводит.
     */
    quantityFrom: z
      .object({ product: z.array(safeKeySchema).min(1).max(4) })
      .strict()
      .optional(),
  })
  .strict();

/** Настройки параметра (config Json). Для MULTI_QTY — типизированная структура. */
export const parameterConfigSchema = z
  .object({
    multiQty: z
      .object({
        /** Максимум независимых строк количества. */
        maxLines: z.number().int().min(1).max(50).default(20),
        lineMin: z.number().int().min(0).default(0),
        lineMax: z.number().int().positive().default(100000),
        lineStep: z.number().int().positive().default(1),
        totalMin: z.number().int().min(0).optional(),
        totalMax: z.number().int().positive().optional(),
        /** Индивидуальные границы конкретных строк поверх общих. */
        lineOverrides: z
          .record(
            z.string().min(1).max(60),
            z
              .object({
                min: z.number().int().min(0).optional(),
                max: z.number().int().positive().optional(),
                step: z.number().int().positive().optional(),
              })
              .strict(),
          )
          .optional(),
      })
      .optional(),
    /** Единица DIMENSION-параметра для area-расчёта. */
    unit: areaUnitSchema.optional(),
  })
  .strict();

export type CompatRuleParsed = z.infer<typeof compatRuleSchema>;
export type PriceRuleParsed = z.infer<typeof priceRuleFieldsSchema>;
export type DefinitionConfig = z.infer<typeof definitionConfigSchema>;
export type ParameterConfig = z.infer<typeof parameterConfigSchema>;
export type DerivedMetricConfig = z.infer<typeof derivedMetricSchema>;
export type PerLengthRuleConfig = z.infer<typeof perLengthRuleConfigSchema>;
export type PerIntervalRuleConfig = z.infer<typeof perIntervalRuleConfigSchema>;
export type MultiQtyLineRuleConfig = z.infer<typeof multiQtyLineRuleConfigSchema>;

export class RuleValidationError extends Error {
  constructor(
    public readonly where: string,
    public readonly issues: string[],
  ) {
    super(`Некорректная конфигурация калькулятора (${where})`);
    this.name = 'RuleValidationError';
  }
}

function formatIssues(error: z.ZodError): string[] {
  return error.issues.slice(0, 5).map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`);
}

/** Валидация с fail-closed: бросает RuleValidationError с безопасным описанием. */
export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, where: string): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new RuleValidationError(where, formatIssues(result.error));
  return result.data;
}
