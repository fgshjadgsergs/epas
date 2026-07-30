import { ConflictException, ForbiddenException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, PriceListStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

/** Структурированная ошибка валидации прайса для admin API (validate endpoint). */
export interface PriceListValidationIssue {
  code: string;
  message: string;
  ruleId?: string;
}

type PriceListForPublish = Prisma.PriceListGetPayload<{
  include: { rules: true; definition: { include: { parameters: { include: { options: true } } } } };
}>;
import { PricingEnvironmentService } from '../config/pricing-environment.service';
import {
  compatRuleSchema,
  definitionConfigSchema,
  parameterConfigSchema,
  parseOrThrow,
  priceRuleFieldsSchema,
  productionRuleSchema,
} from './rule-schemas';
import {
  findConflictingPeriods,
  validateDerivedMetrics,
  validateDeterministicOrder,
  validateMetricPriceRules,
  validateMultiQtyLineRules,
  validatePeriod,
  validateSetBoundsRules,
  validateTierRanges,
} from './publish-validator';


/**
 * Publish flow (Codex review, блок 5) — отдельный от runtime-расчёта путь.
 * Публикация — единственный способ перевести PriceList/CalculatorDefinition
 * в ACTIVE; всё проверяется и меняется статус в одной транзакции.
 * Нет CMS UI — сервис для будущего admin-контроллера и для тестов.
 */
@Injectable()
export class PublishService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingEnv: PricingEnvironmentService,
  ) {}

  /**
   * Публикация прайс-листа: DRAFT/ARCHIVED → ACTIVE.
   * 409 — конфликт периода с другим ACTIVE прайсом того же определения.
   * 422 — invalid period, повреждённые правила, неоднозначный порядок,
   * пересекающиеся/непокрытые диапазоны тиража.
   */
  async publishPriceList(priceListId: string): Promise<{ id: string; version: number; status: PriceListStatus }> {
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.priceList.findUnique({
        where: { id: priceListId },
        select: { definitionId: true },
      });
      if (!target) throw new UnprocessableEntityException('Прайс-лист не найден');

      // Блок 6: сериализация конкурентных публикаций одного definition.
      // Advisory transaction lock (снимается на commit/rollback) гарантирует,
      // что проверка периодов и смена статуса не гоняются с параллельной
      // транзакцией; PostgreSQL exclusion constraint на ACTIVE-периодах
      // (price_lists_active_period_excl) остаётся жёсткой второй линией.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${target.definitionId}, 42))`;

      // Повторное чтение ПОСЛЕ захвата lock: видим состояние, зафиксированное
      // конкурентной транзакцией, которая держала lock до нас.
      const priceList = await tx.priceList.findUnique({
        where: { id: priceListId },
        include: { rules: true, definition: { include: { parameters: { include: { options: true } } } } },
      });
      if (!priceList) throw new UnprocessableEntityException('Прайс-лист не найден');

      // Демо-прайс публикуется только там, где демо-цены разрешены
      // (development, либо staging с ALLOW_DEMO_PRICING=true). Тройная защита:
      // (1) demo-seed отказывается работать на боевом стенде, (2) здесь
      // блокируется публикация, (3) CalculatorService всё равно исключает
      // isDemo из выборки, даже если строка как-то оказалась ACTIVE.
      if (priceList.isDemo && !this.pricingEnv.demoPricingAllowed) {
        throw new ForbiddenException('Демо-прайс нельзя активировать в этом окружении');
      }
      if (priceList.status !== 'DRAFT') {
        // Публикуется только DRAFT (блок 5 v2): ACTIVE уже опубликован,
        // ARCHIVED неизменяем навсегда — изменения оформляются новой версией.
        // Это же правило enforce'ится триггерами БД (immutable published rows).
        throw new UnprocessableEntityException('Публиковать можно только черновик; создайте новую версию для изменений');
      }

      // Полная валидация прайса (та же, что и в validate endpoint) — throw'ит
      // категорийные 422 при повреждённых правилах/диапазонах/метриках.
      this.assertDraftRulesValid(priceList);

      const others = await tx.priceList.findMany({
        where: { definitionId: priceList.definitionId, status: 'ACTIVE', id: { not: priceList.id } },
        select: { id: true, validFrom: true, validTo: true },
      });
      const conflicts = findConflictingPeriods(
        { id: priceList.id, validFrom: priceList.validFrom, validTo: priceList.validTo },
        others,
      );
      if (conflicts.length > 0) {
        throw new ConflictException({
          message: 'Период пересекается с уже активным прайс-листом',
          conflictingPriceListIds: conflicts.map((c) => c.id),
        });
      }

      try {
        const updated = await tx.priceList.update({
          where: { id: priceList.id },
          data: { status: 'ACTIVE', publishedAt: new Date() },
        });
        return { id: updated.id, version: updated.version, status: updated.status };
      } catch (error) {
        // Backstop: если что-то обошло advisory lock (другой сервис, ручной
        // SQL), exclusion constraint БД всё равно не допустит два ACTIVE
        // прайса с пересекающимися периодами — транслируем в тот же 409.
        if (error instanceof Error && error.message.includes('price_lists_active_period_excl')) {
          throw new ConflictException({
            message: 'Период пересекается с уже активным прайс-листом',
            conflictingPriceListIds: [],
          });
        }
        throw error;
      }
    });
  }

  /**
   * Публикация DRAFT с атомарной архивацией предыдущего ACTIVE того же
   * определения (admin publish-flow). Одна транзакция под advisory-lock:
   * проверка revision → полная валидация → архивация прежнего ACTIVE →
   * DRAFT становится ACTIVE. GiST-конфликт транслируется в 409.
   *
   * Возвращает id заархивированных прайсов (для аудита). Повторная публикация
   * того же DRAFT невозможна: после первой он уже не DRAFT.
   */
  async publishDraftReplacingActive(
    priceListId: string,
    opts: { expectedRevision?: number } = {},
  ): Promise<{ id: string; version: number; status: PriceListStatus; archivedIds: string[] }> {
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.priceList.findUnique({
        where: { id: priceListId },
        select: { definitionId: true },
      });
      if (!target) throw new UnprocessableEntityException('Прайс-лист не найден');

      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${target.definitionId}, 42))`;

      const priceList = await tx.priceList.findUnique({
        where: { id: priceListId },
        include: { rules: true, definition: { include: { parameters: { include: { options: true } } } } },
      });
      if (!priceList) throw new UnprocessableEntityException('Прайс-лист не найден');

      if (priceList.isDemo && !this.pricingEnv.demoPricingAllowed) {
        throw new ForbiddenException('Демо-прайс нельзя активировать в этом окружении');
      }
      if (priceList.status !== 'DRAFT') {
        throw new UnprocessableEntityException('Публиковать можно только черновик; создайте новую версию для изменений');
      }
      // Оптимистичная блокировка: DRAFT не должен измениться между чтением в UI
      // и публикацией. Несовпадение → 409 с доменным кодом.
      if (opts.expectedRevision !== undefined && priceList.revision !== opts.expectedRevision) {
        throw new ConflictException({
          message: 'Черновик изменился с момента загрузки — обновите данные',
          code: 'PRICING_DRAFT_CONFLICT',
          currentRevision: priceList.revision,
        });
      }

      // Повторная полная валидация непосредственно во время публикации.
      this.assertDraftRulesValid(priceList);

      // Архивируем прежние ACTIVE этого определения В ТОЙ ЖЕ транзакции —
      // после этого проверка пересечения периодов не найдёт конфликта, а
      // ACTIVE останется ровно один (новый).
      const priorActive = await tx.priceList.findMany({
        where: { definitionId: priceList.definitionId, status: 'ACTIVE', id: { not: priceList.id } },
        select: { id: true },
      });
      for (const p of priorActive) {
        await tx.priceList.update({ where: { id: p.id }, data: { status: 'ARCHIVED' } });
      }

      try {
        const updated = await tx.priceList.update({
          where: { id: priceList.id },
          data: { status: 'ACTIVE', publishedAt: new Date() },
        });
        return {
          id: updated.id,
          version: updated.version,
          status: updated.status,
          archivedIds: priorActive.map((p) => p.id),
        };
      } catch (error) {
        if (error instanceof Error && error.message.includes('price_lists_active_period_excl')) {
          throw new ConflictException({
            message: 'Период пересекается с уже активным прайс-листом',
            conflictingPriceListIds: [],
          });
        }
        throw error;
      }
    });
  }

  /**
   * Структурированная валидация DRAFT для admin validate endpoint. Использует
   * ТЕ ЖЕ проверки, что публикация (publish-validator + rule-schemas), но
   * собирает ошибки в список вместо throw. Не публикует и не меняет DRAFT.
   */
  async collectDraftIssues(priceListId: string): Promise<{
    priceList: { id: string; status: PriceListStatus; revision: number } | null;
    issues: PriceListValidationIssue[];
  }> {
    const priceList = await this.prisma.priceList.findUnique({
      where: { id: priceListId },
      include: { rules: true, definition: { include: { parameters: { include: { options: true } } } } },
    });
    if (!priceList) return { priceList: null, issues: [] };
    return {
      priceList: { id: priceList.id, status: priceList.status, revision: priceList.revision },
      issues: this.collectRuleIssues(priceList),
    };
  }

  /**
   * Все проверки правил прайса. throw'ит категорийный 422 на первой группе
   * проблем — общий код для обеих публикаций (обычной и archive-replace).
   */
  private assertDraftRulesValid(priceList: PriceListForPublish): void {
    const periodIssues = validatePeriod({ validFrom: priceList.validFrom, validTo: priceList.validTo });
    if (periodIssues.length > 0) {
      throw new UnprocessableEntityException({ message: 'Некорректный период действия', errors: periodIssues });
    }

    const ruleIssues: string[] = [];
    for (const rule of priceList.rules) {
      const result = priceRuleFieldsSchema.safeParse({
        kind: rule.kind,
        condition: rule.condition,
        qtyFrom: rule.qtyFrom,
        qtyTo: rule.qtyTo,
        amountMinor: rule.amountMinor,
        multiplier: rule.multiplier !== null ? Number(rule.multiplier) : undefined,
        config: rule.config ?? undefined,
      });
      if (!result.success) ruleIssues.push(`PriceRule(${rule.id}): ${result.error.issues[0]?.message}`);
    }
    if (ruleIssues.length > 0) {
      throw new UnprocessableEntityException({ message: 'Повреждённые правила прайса', errors: ruleIssues });
    }

    const configParsed = priceList.definition.config
      ? definitionConfigSchema.safeParse(priceList.definition.config)
      : null;
    if (configParsed && !configParsed.success) {
      throw new UnprocessableEntityException({
        message: 'Повреждённая конфигурация определения',
        errors: [configParsed.error.issues[0]?.message ?? 'config'],
      });
    }
    const metricIssues = validateMetricPriceRules(
      priceList.rules.map((r) => ({
        id: r.id,
        kind: r.kind,
        config: (r.config ?? null) as Parameters<typeof validateMetricPriceRules>[0][number]['config'],
      })),
      (configParsed?.data?.metrics ?? []) as Parameters<typeof validateMetricPriceRules>[1],
      priceList.definition.parameters.map((p) => ({ urlKey: p.urlKey, type: p.type })),
    );
    if (metricIssues.length > 0) {
      throw new UnprocessableEntityException({ message: 'Некорректные метрические правила', errors: metricIssues });
    }

    const lineIssues = validateMultiQtyLineRules(
      priceList.rules.map((r) => ({
        id: r.id,
        kind: r.kind,
        condition: (r.condition ?? null) as Record<string, string | string[]> | null,
        qtyFrom: r.qtyFrom,
        qtyTo: r.qtyTo,
        amountMinor: r.amountMinor,
        config: (r.config ?? null) as { sourceParameter?: string; lineKey?: string } | null,
        sortOrder: r.sortOrder,
      })),
      priceList.definition.parameters.map((p) => {
        const parsedConfig = p.config ? parameterConfigSchema.safeParse(p.config) : null;
        return {
          urlKey: p.urlKey,
          type: p.type,
          options: p.options.map((o) => ({ value: o.value, isActive: o.isActive })),
          multiQty: parsedConfig?.success ? parsedConfig.data.multiQty ?? null : null,
        };
      }),
    );
    if (lineIssues.length > 0) {
      throw new UnprocessableEntityException({ message: 'Некорректные построчные правила', errors: lineIssues });
    }

    const orderIssues = validateDeterministicOrder(
      priceList.rules.map((r) => ({
        id: r.id,
        kind: r.kind,
        condition: (r.condition ?? null) as Record<string, string | string[]> | null,
        sortOrder: r.sortOrder,
      })),
    );
    if (orderIssues.length > 0) {
      throw new UnprocessableEntityException({ message: 'Неоднозначный порядок правил', errors: orderIssues });
    }

    const toTier = (r: (typeof priceList.rules)[number]) => ({
      id: r.id,
      condition: (r.condition ?? null) as Record<string, string | string[]> | null,
      qtyFrom: r.qtyFrom,
      qtyTo: r.qtyTo,
      sortOrder: r.sortOrder,
    });
    // BASE_TIER — строгая базовая лестница; QTY_DISCOUNT — модификатор (см. validateTierRanges).
    const tierIssues = [
      ...validateTierRanges(priceList.rules.filter((r) => r.kind === 'BASE_TIER').map(toTier), priceList.definition.minQty, { requireMinCoverage: true, forbidGaps: true }),
      ...validateTierRanges(priceList.rules.filter((r) => r.kind === 'QTY_DISCOUNT').map(toTier), priceList.definition.minQty, { requireMinCoverage: false, forbidGaps: false }),
    ];
    if (tierIssues.length > 0) {
      throw new UnprocessableEntityException({ message: 'Некорректные диапазоны тиража', errors: tierIssues });
    }
  }

  /** Те же проверки, но собранные в структурированный список (validate endpoint). */
  private collectRuleIssues(priceList: PriceListForPublish): PriceListValidationIssue[] {
    const issues: PriceListValidationIssue[] = [];

    for (const issue of validatePeriod({ validFrom: priceList.validFrom, validTo: priceList.validTo })) {
      issues.push({ code: issue.code, message: issue.message });
    }

    for (const rule of priceList.rules) {
      const result = priceRuleFieldsSchema.safeParse({
        kind: rule.kind,
        condition: rule.condition,
        qtyFrom: rule.qtyFrom,
        qtyTo: rule.qtyTo,
        amountMinor: rule.amountMinor,
        multiplier: rule.multiplier !== null ? Number(rule.multiplier) : undefined,
        config: rule.config ?? undefined,
      });
      if (!result.success) {
        issues.push({
          code: 'RULE_MALFORMED',
          message: result.error.issues[0]?.message ?? 'invalid rule',
          ruleId: rule.id,
        });
      }
    }

    const configParsed = priceList.definition.config
      ? definitionConfigSchema.safeParse(priceList.definition.config)
      : null;
    if (configParsed && !configParsed.success) {
      issues.push({ code: 'DEFINITION_CONFIG_MALFORMED', message: configParsed.error.issues[0]?.message ?? 'config' });
    }

    for (const issue of validateMetricPriceRules(
      priceList.rules.map((r) => ({
        id: r.id,
        kind: r.kind,
        config: (r.config ?? null) as Parameters<typeof validateMetricPriceRules>[0][number]['config'],
      })),
      (configParsed?.data?.metrics ?? []) as Parameters<typeof validateMetricPriceRules>[1],
      priceList.definition.parameters.map((p) => ({ urlKey: p.urlKey, type: p.type })),
    )) {
      issues.push({ code: issue.code, message: issue.message });
    }

    for (const issue of validateMultiQtyLineRules(
      priceList.rules.map((r) => ({
        id: r.id,
        kind: r.kind,
        condition: (r.condition ?? null) as Record<string, string | string[]> | null,
        qtyFrom: r.qtyFrom,
        qtyTo: r.qtyTo,
        amountMinor: r.amountMinor,
        config: (r.config ?? null) as { sourceParameter?: string; lineKey?: string } | null,
        sortOrder: r.sortOrder,
      })),
      priceList.definition.parameters.map((p) => {
        const parsedConfig = p.config ? parameterConfigSchema.safeParse(p.config) : null;
        return {
          urlKey: p.urlKey,
          type: p.type,
          options: p.options.map((o) => ({ value: o.value, isActive: o.isActive })),
          multiQty: parsedConfig?.success ? parsedConfig.data.multiQty ?? null : null,
        };
      }),
    )) {
      issues.push({ code: issue.code, message: issue.message });
    }

    for (const issue of validateDeterministicOrder(
      priceList.rules.map((r) => ({
        id: r.id,
        kind: r.kind,
        condition: (r.condition ?? null) as Record<string, string | string[]> | null,
        sortOrder: r.sortOrder,
      })),
    )) {
      issues.push({ code: issue.code, message: issue.message });
    }

    const toTier = (r: (typeof priceList.rules)[number]) => ({
      id: r.id,
      condition: (r.condition ?? null) as Record<string, string | string[]> | null,
      qtyFrom: r.qtyFrom,
      qtyTo: r.qtyTo,
      sortOrder: r.sortOrder,
    });
    const tierIssues = [
      ...validateTierRanges(priceList.rules.filter((r) => r.kind === 'BASE_TIER').map(toTier), priceList.definition.minQty, { requireMinCoverage: true, forbidGaps: true }),
      ...validateTierRanges(priceList.rules.filter((r) => r.kind === 'QTY_DISCOUNT').map(toTier), priceList.definition.minQty, { requireMinCoverage: false, forbidGaps: false }),
    ];
    for (const issue of tierIssues) {
      issues.push({ code: issue.code, message: issue.message });
    }

    return issues;
  }

  /**
   * Публикация определения: DRAFT → ACTIVE. Проверяет схемы совместимости/
   * production-правил и запрещает demo-активацию в production.
   */
  async publishDefinition(definitionId: string): Promise<{ id: string; version: number; status: PriceListStatus }> {
    return this.prisma.$transaction(async (tx) => {
      const definition = await tx.calculatorDefinition.findUnique({
        where: { id: definitionId },
        include: { compatibilityRules: true, productionRules: true, parameters: true },
      });
      if (!definition) throw new UnprocessableEntityException('Определение не найдено');

      // Симметрично publishPriceList: демо-определение активируется только
      // там, где демо-цены разрешены.
      if (definition.isDemo && !this.pricingEnv.demoPricingAllowed) {
        throw new ForbiddenException('Демо-определение нельзя активировать в этом окружении');
      }
      if (definition.status !== 'DRAFT') {
        throw new UnprocessableEntityException('Публиковать можно только черновик; создайте новую версию для изменений');
      }

      const issues: string[] = [];
      for (const rule of definition.compatibilityRules) {
        const result = compatRuleSchema.safeParse({ kind: rule.kind, when: rule.when, target: rule.target });
        if (!result.success) issues.push(`CompatibilityRule(${rule.id}): ${result.error.issues[0]?.message}`);
      }
      for (const rule of definition.productionRules) {
        const result = productionRuleSchema.safeParse({
          condition: rule.condition,
          workingDays: rule.workingDays,
          cutoff: rule.cutoff,
          priority: rule.priority,
        });
        if (!result.success) issues.push(`ProductionTimeRule(${rule.id}): ${result.error.issues[0]?.message}`);
      }
      // Производные метрики: схема + ссылочная целостность (unknown param,
      // источник объявлен раньше, шаг > 0, min/maxCount).
      if (definition.config) {
        const configResult = definitionConfigSchema.safeParse(definition.config);
        if (!configResult.success) {
          issues.push(`CalculatorDefinition.config: ${configResult.error.issues[0]?.message}`);
        } else if (configResult.data.metrics) {
          const metricIssues = validateDerivedMetrics(
            configResult.data.metrics as Parameters<typeof validateDerivedMetrics>[0],
            definition.parameters.map((p) => ({ urlKey: p.urlKey, type: p.type })),
          );
          issues.push(...metricIssues.map((i) => `${i.code}: ${i.message}`));
        }
      }

      // Блок 4 v2: SET_BOUNDS проверяется на публикации — неизвестный target,
      // несовместимый тип, пустой effective-диапазон, step<=0, циклы.
      const setBoundsIssues = validateSetBoundsRules(
        definition.compatibilityRules.map((r) => ({
          id: r.id,
          kind: r.kind,
          when: (r.when ?? {}) as Record<string, string | string[]>,
          target: (r.target ?? {}) as { param?: string; min?: number; max?: number; step?: number; required?: boolean },
        })),
        definition.parameters.map((p) => ({
          urlKey: p.urlKey,
          type: p.type,
          minValue: p.minValue !== null ? Number(p.minValue) : null,
          maxValue: p.maxValue !== null ? Number(p.maxValue) : null,
        })),
      );
      issues.push(...setBoundsIssues.map((i) => `${i.code}: ${i.message}`));

      // Неоднозначность приоритетов срока — тот же принцип, что у прайс-правил.
      const priorityGroups = new Map<string, number>();
      for (const rule of definition.productionRules) {
        const key = `${JSON.stringify(rule.condition ?? null)}::${rule.priority}`;
        if (priorityGroups.has(key)) {
          issues.push(`Неоднозначный priority у правил срока изготовления (условие ${key})`);
        }
        priorityGroups.set(key, rule.priority);
      }
      if (issues.length > 0) {
        throw new UnprocessableEntityException({ message: 'Повреждённая конфигурация определения', errors: issues });
      }

      const updated = await tx.calculatorDefinition.update({
        where: { id: definition.id },
        data: { status: 'ACTIVE', publishedAt: new Date() },
      });
      return { id: updated.id, version: updated.version, status: updated.status };
    });
  }
}

/** Для тестов/типов, если понадобится JSON-InputValue у вызывающей стороны. */
export type { Prisma };
