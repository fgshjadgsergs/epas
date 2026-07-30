import { Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PricingEnvironmentService, type PricingMode } from '../config/pricing-environment.service';
import { CalculateRequestDto } from './dto/calculate-request.dto';
import { ConfirmCalculationDto } from './dto/confirm-calculation.dto';
import {
  CalculationResult,
  ConditionJson,
  CustomerContext,
  EngineConfigError,
  EngineDefinition,
  PUBLIC_CUSTOMER_CONTEXT,
  runCalculation,
} from './pricing-engine';
import {
  compatRuleSchema,
  definitionConfigSchema,
  parameterConfigSchema,
  parseOrThrow,
  presetSchema,
  priceRuleFieldsSchema,
  productionRuleSchema,
  RuleValidationError,
  visibleIfSchema,
} from './rule-schemas';
import { validatePresetAgainstDefinition } from './publish-validator';

const DEFINITION_INCLUDE = {
  parameters: {
    orderBy: { sortOrder: 'asc' },
    include: { options: { orderBy: { sortOrder: 'asc' } } },
  },
  compatibilityRules: { orderBy: { sortOrder: 'asc' } },
  upsells: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
  productionRules: true,
} satisfies Prisma.CalculatorDefinitionInclude;

type DefinitionWithRelations = Prisma.CalculatorDefinitionGetPayload<{
  include: typeof DEFINITION_INCLUDE;
}>;

type ActivePriceList = Prisma.PriceListGetPayload<{ include: { rules: true } }>;

@Injectable()
export class CalculatorService {
  private readonly logger = new Logger(CalculatorService.name);

  constructor(
    private readonly prisma: PrismaService,
    // Единственный источник правила «доступны ли демо-прайсы» (APP_ENV +
    // ALLOW_DEMO_PRICING); собственных проверок process.env здесь нет.
    private readonly pricingEnv: PricingEnvironmentService,
  ) {}

  async getDefinitionBySlug(slug: string) {
    const { definition, preset } = await this.loadDefinition(slug);
    const priceList = await this.findActivePriceList(definition.id);
    const config = definition.config
      ? parseOrThrow(definitionConfigSchema, definition.config, `CalculatorDefinition(${definition.code}).config`)
      : null;

    return {
      serviceSlug: slug,
      code: definition.code,
      title: definition.title,
      version: definition.version,
      pricingMode: definition.pricingMode,
      urlOrder: definition.urlOrder,
      qty: {
        min: definition.minQty,
        max: definition.maxQty,
        step: definition.qtyStep,
        default: definition.defaultQty,
      },
      // Производный тираж: если задан, тираж выводит сервер (произведение
      // параметров), а frontend не показывает поле «Тираж» (ТЗ 2.2).
      quantityFrom: config?.quantityFrom ?? null,
      preset: preset ?? null,
      parameters: definition.parameters.map((p) => ({
        urlKey: p.urlKey,
        label: p.label,
        type: p.type,
        unit: p.unit,
        min: p.minValue !== null ? Number(p.minValue) : null,
        max: p.maxValue !== null ? Number(p.maxValue) : null,
        step: p.stepValue !== null ? Number(p.stepValue) : null,
        // Публичные границы MULTI_QTY (maxLines/lineMin/lineMax/lineStep/
        // totalMin/totalMax/lineOverrides) — для рендера контрола; цен нет.
        multiQty: this.publicMultiQty(p.config),
        default:
          p.options.length > 0
            ? (p.options.find((o) => o.isDefault && o.isActive) ?? p.options.find((o) => o.isActive))
                ?.value ?? null
            : p.defaultValue,
        required: p.isRequired,
        shareable: p.shareable,
        visibleIf: p.visibleIf ?? null,
        options: p.options
          .filter((o) => o.isActive)
          .map((o) => ({ value: o.value, label: o.label, isDefault: o.isDefault, meta: o.meta ?? null })),
      })),
      compatibility: definition.compatibilityRules.map((r) => ({
        kind: r.kind,
        when: r.when,
        target: r.target,
        message: r.message,
      })),
      // Публичный DTO: только то, что нужно для отображения upsell-чекбокса.
      // amountMinor/multiplier — внутренние детали ценообразования, наружу
      // не отдаём (блок 8); дельту цены сообщает /calculate.appliedUpsells.
      // visibleIf — данные доступности (не ценообразование): frontend по нему
      // скрывает опции, недоступные для выбранных параметров.
      upsells: definition.upsells.map((u) => ({
        code: u.code,
        label: u.label,
        visibleIf: u.visibleIf ?? null,
      })),
      hasActivePriceList: priceList !== null,
      calculationVersion: priceList
        ? `${definition.code}:v${definition.version}:p${priceList.version}`
        : null,
      // isDemo намеренно НЕ отдаётся: frontend его не использует, а публичный
      // DTO не должен раскрывать внутренние флаги данных (блок 8 v2).
    };
  }

  /**
   * Preview-расчёт. Не создаёт snapshot (блок 4 п.6) — только показ цены.
   * Коммерческий контекст — ТОЛЬКО стандартный публичный (блок 3): b2b/скидки
   * из тела запроса не принимаются, их там больше и нет в DTO.
   */
  async calculateBySlug(slug: string, dto: CalculateRequestDto) {
    const { priceList, bundle, holidays } = await this.loadCalculationBundleFull(slug);
    const outcome = this.runSafely(bundle, dto, holidays, PUBLIC_CUSTOMER_CONTEXT);
    const { result } = outcome;
    return {
      serviceSlug: slug,
      // Режим прайса определяется ФАКТИЧЕСКИ использованным PriceList, а не
      // env-флагом фронтенда: DEMO → интерфейс показывает пометку.
      pricingMode: this.pricingEnv.pricingModeOf(priceList),
      normalizedParameters: result.normalizedParameters,
      quantity: result.quantity,
      price: result.price,
      unitPrice: result.unitPrice,
      // Информационное поле — не право на отличающуюся итоговую цену (блок 3 п.3).
      priceWithVat: result.priceWithVat,
      customerContext: PUBLIC_CUSTOMER_CONTEXT,
      production: result.production,
      appliedUpsells: result.appliedUpsells,
      // Производные метрики (площадь/периметр/люверсы) — публичные значения,
      // без раскрытия внутренних pricing-правил; считаются только сервером.
      derived: result.derived,
      // Построчная разбивка MULTI_QTY: без rule id/priority/условий.
      lineItems: result.lineItems,
      totalQuantity: result.quantity,
      warnings: result.warnings,
      calculationVersion: result.calculationVersion,
      engineVersion: result.engineVersion,
      // Сервер объявляет расчёт «свежим» — frontend помечает предыдущий stale
      // по факту изменения параметров, не дожидаясь этого поля (блок 2).
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Подтверждение расчёта — единственная точка создания CalculationSnapshot.
   * Вход ИДЕНТИЧЕН /calculate (общий CalculationInputDto): параметры и upsells
   * пересчитываются заново на сервере через тот же runSafely (клиентский
   * hash/version — не источник истины); в snapshot фиксируются normalized
   * input (параметры + upsells), applied rules и applied upsells.
   */
  async confirmCalculation(
    slug: string,
    dto: ConfirmCalculationDto,
    owner: { userId: string | null; anonymousSessionId: string | null } = { userId: null, anonymousSessionId: null },
  ): Promise<{
    snapshotId: string;
    price: { amountMinor: number; currency: string };
    calculationVersion: string;
    normalizedParameters: Record<string, unknown>;
    upsells: string[];
    derived: CalculationResult['derived'];
    lineItems: CalculationResult['lineItems'];
    totalQuantity: number;
    pricingMode: PricingMode;
  }> {
    const { definition, priceList, bundle, holidays } = await this.loadCalculationBundleFull(slug);
    const outcome = this.runSafely(bundle, dto, holidays, PUBLIC_CUSTOMER_CONTEXT);
    const r: CalculationResult = outcome.result;

    const snapshot = await this.prisma.calculationSnapshot.create({
      data: {
        definitionId: definition.id,
        priceListId: priceList.id,
        definitionVersion: definition.version,
        priceListVersion: priceList.version,
        engineVersion: r.engineVersion,
        serviceSlug: slug,
        parameters: r.normalizedParameters as Prisma.InputJsonValue,
        upsells: r.normalizedUpsells as unknown as Prisma.InputJsonValue,
        appliedRules: r.appliedRules as unknown as Prisma.InputJsonValue,
        appliedUpsells: r.appliedUpsells as unknown as Prisma.InputJsonValue,
        customerContext: PUBLIC_CUSTOMER_CONTEXT as unknown as Prisma.InputJsonValue,
        totalMinor: r.price.amountMinor,
        unitMinor: r.unitPrice.amountMinor,
        vatMinor: r.priceWithVat.amountMinor - r.price.amountMinor,
        currency: r.price.currency,
        workingDays: r.production.workingDays,
        b2b: PUBLIC_CUSTOMER_CONTEXT.customerType === 'BUSINESS',
        // Владелец расчёта: корзина примет snapshot только этого пользователя/сессии.
        userId: owner.userId,
        anonymousSessionId: owner.anonymousSessionId,
      },
    });
    return {
      snapshotId: snapshot.id,
      price: r.price,
      calculationVersion: r.calculationVersion,
      normalizedParameters: r.normalizedParameters,
      upsells: r.normalizedUpsells,
      derived: r.derived,
      lineItems: r.lineItems,
      totalQuantity: r.quantity,
      pricingMode: this.pricingEnv.pricingModeOf(priceList),
    };
  }

  /**
   * Dry-run расчёт по КОНКРЕТНОМУ прайс-листу (admin preview черновика).
   * Принудительно считает по переданному priceListId, НЕ выбирая ACTIVE через
   * обычный production-lookup. Использует тот же движок (toEngineDefinition +
   * runSafely) и НЕ создаёт CalculationSnapshot/Cart/Order — только цену.
   */
  async dryRunPriceList(priceListId: string, dto: CalculateRequestDto) {
    const priceList = await this.prisma.priceList.findUnique({
      where: { id: priceListId },
      include: {
        rules: { orderBy: { sortOrder: 'asc' } },
        definition: { include: DEFINITION_INCLUDE },
      },
    });
    if (!priceList) throw new NotFoundException('Прайс-лист не найден');

    const definition = priceList.definition;
    const holidays = await this.loadHolidays();
    // Тот же путь сборки бандла, что и у production-расчёта — но на явном прайсе.
    const bundle = this.toEngineDefinition(definition, priceList);
    const outcome = this.runSafely(bundle, dto, holidays, PUBLIC_CUSTOMER_CONTEXT);
    const { result } = outcome;

    return {
      priceListId: priceList.id,
      priceListVersion: priceList.version,
      status: priceList.status,
      pricingMode: this.pricingEnv.pricingModeOf(priceList),
      isDemo: priceList.isDemo,
      normalizedParameters: result.normalizedParameters,
      quantity: result.quantity,
      total: result.price,
      unitPrice: result.unitPrice,
      priceWithVat: result.priceWithVat,
      currency: result.price.currency,
      production: result.production,
      appliedUpsells: result.appliedUpsells,
      derived: result.derived,
      lineItems: result.lineItems,
      totalQuantity: result.quantity,
      warnings: result.warnings,
      calculationVersion: result.calculationVersion,
      engineVersion: result.engineVersion,
    };
  }

  /** Безопасная публичная проекция multiQty-конфигурации параметра (без цен). */
  private publicMultiQty(config: Prisma.JsonValue | null) {
    if (!config) return null;
    const parsed = parameterConfigSchema.safeParse(config);
    return parsed.success ? parsed.data.multiQty ?? null : null;
  }

  /** Общий путь calculate/confirm: запуск движка + перевод EngineConfigError в 422/500-safe ответ. */
  private runSafely(
    bundle: EngineDefinition,
    dto: { parameters: Record<string, unknown>; upsells?: string[] },
    holidays: Set<string>,
    customer: CustomerContext,
  ): { result: CalculationResult } {
    try {
      const outcome = runCalculation(
        bundle,
        { parameters: dto.parameters ?? {}, upsells: dto.upsells },
        new Date(),
        holidays,
        customer,
      );
      if (!outcome.ok) {
        throw new UnprocessableEntityException({ message: 'Неверные параметры расчёта', errors: outcome.errors });
      }
      return { result: outcome.result };
    } catch (error) {
      if (error instanceof EngineConfigError) {
        // Fail-closed: конфигурация повреждена/неоднозначна — цену не считаем,
        // безопасный лог (без параметров клиента, чтобы не писать чужой ввод).
        this.logger.error(`Ошибка конфигурации калькулятора: ${error.message}`);
        throw new UnprocessableEntityException({
          message: 'Калькулятор временно недоступен: ошибка конфигурации цены',
          errors: [{ param: 'qty', message: 'Обратитесь позже — прайс-лист требует проверки' }],
        });
      }
      throw error;
    }
  }

  private async loadDefinition(slug: string): Promise<{
    definition: DefinitionWithRelations;
    preset: Prisma.JsonValue | null;
  }> {
    const service = await this.prisma.service.findUnique({
      where: { slug },
      include: { calculator: { include: { definition: { include: DEFINITION_INCLUDE } } } },
    });
    const definition = service?.calculator?.definition;
    if (!service || !service.isActive || !definition || !definition.isActive || definition.status !== 'ACTIVE') {
      throw new NotFoundException('Калькулятор для этой услуги не настроен');
    }
    // Демо-определение недоступно там, где демо-прайсы запрещены (всегда в
    // production, в staging — без ALLOW_DEMO_PRICING). Защита работает даже
    // если запись почему-то помечена ACTIVE — например, восстановленная копия БД.
    if (definition.isDemo && !this.pricingEnv.demoPricingAllowed) {
      throw new NotFoundException('Калькулятор для этой услуги не настроен');
    }
    if (service.calculator?.preset) {
      // Binding-preset страницы: сначала форма (zod), затем сверка с definition —
      // неизвестные параметры (в т.ч. price/promo/b2b/upsells), недопустимые
      // options и значения вне границ блокируются fail-closed.
      try {
        const parsedPreset = parseOrThrow(
          presetSchema,
          service.calculator.preset,
          `ServiceCalculator(${service.id}).preset`,
        );
        const presetIssues = validatePresetAgainstDefinition(parsedPreset, {
          minQty: definition.minQty,
          maxQty: definition.maxQty,
          parameters: definition.parameters.map((p) => ({
            urlKey: p.urlKey,
            type: p.type,
            minValue: p.minValue !== null ? Number(p.minValue) : null,
            maxValue: p.maxValue !== null ? Number(p.maxValue) : null,
            options: p.options.map((o) => ({ value: o.value, isActive: o.isActive })),
          })),
        });
        if (presetIssues.length > 0) {
          throw new RuleValidationError(
            `ServiceCalculator(${service.id}).preset`,
            presetIssues.map((i) => `${i.code}: ${i.message}`),
          );
        }
      } catch (error) {
        if (error instanceof RuleValidationError) {
          this.logger.error(`${error.message}: ${error.issues.join('; ')}`);
          throw new UnprocessableEntityException({
            message: 'Калькулятор временно недоступен: ошибка конфигурации',
            errors: [{ param: 'qty', message: 'Конфигурация калькулятора повреждена, обратитесь позже' }],
          });
        }
        throw error;
      }
    }
    return { definition, preset: service.calculator?.preset ?? null };
  }

  private findActivePriceList(definitionId: string): Promise<ActivePriceList | null> {
    const now = new Date();
    return this.prisma.priceList.findFirst({
      where: {
        definitionId,
        status: 'ACTIVE',
        // Блок 1 п.6: production никогда не выбирает demo-прайс.
        ...(this.pricingEnv.demoPricingAllowed ? {} : { isDemo: false }),
        OR: [{ validFrom: null }, { validFrom: { lte: now } }],
        AND: [{ OR: [{ validTo: null }, { validTo: { gt: now } }] }],
      },
      // Публикация гарантирует отсутствие пересекающихся ACTIVE-прайсов
      // (Block 5) — при их отсутствии единственный кандидат виден сразу;
      // version desc — единственный tie-breaker, если это всё же нарушено.
      orderBy: { version: 'desc' },
      include: { rules: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  private async loadHolidays(): Promise<Set<string>> {
    const rows = await this.prisma.holiday.findMany({ select: { date: true } });
    return new Set(rows.map((r) => r.date.toISOString().slice(0, 10)));
  }

  private async loadCalculationBundle(
    slug: string,
  ): Promise<{ bundle: EngineDefinition; holidays: Set<string> }> {
    const full = await this.loadCalculationBundleFull(slug);
    return { bundle: full.bundle, holidays: full.holidays };
  }

  private async loadCalculationBundleFull(slug: string): Promise<{
    definition: DefinitionWithRelations;
    priceList: ActivePriceList;
    bundle: EngineDefinition;
    holidays: Set<string>;
  }> {
    const { definition } = await this.loadDefinition(slug);
    const priceList = await this.findActivePriceList(definition.id);
    if (!priceList) {
      throw new UnprocessableEntityException({
        message: 'Прайс-лист услуги не настроен',
        errors: [{ param: 'qty', message: 'Прайс-лист услуги не настроен' }],
      });
    }
    const holidays = await this.loadHolidays();
    const bundle = this.toEngineDefinition(definition, priceList);
    return { definition, priceList, bundle, holidays };
  }

  /**
   * Runtime-валидация JSON-конфигурации перед сборкой бандла (блок 6):
   * повреждённое/неизвестное правило → RuleValidationError → 422,
   * цена не считается (fail-closed).
   */
  private toEngineDefinition(
    definition: DefinitionWithRelations,
    priceList: ActivePriceList,
  ): EngineDefinition {
    try {
      const definitionConfig = definition.config
        ? parseOrThrow(definitionConfigSchema, definition.config, `CalculatorDefinition(${definition.code}).config`)
        : null;

      return {
        code: definition.code,
        version: definition.version,
        pricingMode: definition.pricingMode,
        urlOrder: definition.urlOrder,
        minQty: definition.minQty,
        maxQty: definition.maxQty,
        qtyStep: definition.qtyStep,
        defaultQty: definition.defaultQty,
        currency: priceList.currency,
        priceListVersion: priceList.version,
        area: definitionConfig?.area ?? null,
        metrics: definitionConfig?.metrics ?? null,
        quantityFrom: definitionConfig?.quantityFrom ?? null,
        parameters: definition.parameters.map((p) => {
          const visibleIf = p.visibleIf
            ? parseOrThrow(visibleIfSchema, p.visibleIf, `CalculatorParameter(${p.urlKey}).visibleIf`)
            : null;
          const paramConfig = p.config
            ? parseOrThrow(parameterConfigSchema, p.config, `CalculatorParameter(${p.urlKey}).config`)
            : null;
          return {
            urlKey: p.urlKey,
            label: p.label,
            type: p.type,
            isRequired: p.isRequired,
            shareable: p.shareable,
            unit: p.unit,
            minValue: p.minValue !== null ? Number(p.minValue) : null,
            maxValue: p.maxValue !== null ? Number(p.maxValue) : null,
            stepValue: p.stepValue !== null ? Number(p.stepValue) : null,
            defaultValue: p.defaultValue,
            visibleIf: visibleIf as ConditionJson | null,
            areaUnit: paramConfig?.unit ?? null,
            multiQty: paramConfig?.multiQty ?? null,
            options: p.options.map((o) => ({
              value: o.value,
              label: o.label,
              isDefault: o.isDefault,
              isActive: o.isActive,
            })),
          };
        }),
        compatibilityRules: definition.compatibilityRules.map((r) => {
          const parsed = parseOrThrow(
            compatRuleSchema,
            { kind: r.kind, when: r.when, target: r.target },
            `CalculatorCompatibilityRule(${r.id})`,
          );
          return {
            id: r.id,
            kind: parsed.kind,
            when: parsed.when as ConditionJson,
            target: parsed.target as EngineDefinition['compatibilityRules'][number]['target'],
            message: r.message,
            sortOrder: r.sortOrder,
          };
        }),
        priceRules: priceList.rules.map((r) => {
          const parsed = parseOrThrow(
            priceRuleFieldsSchema,
            {
              kind: r.kind,
              condition: r.condition,
              qtyFrom: r.qtyFrom,
              qtyTo: r.qtyTo,
              amountMinor: r.amountMinor,
              multiplier: r.multiplier !== null ? Number(r.multiplier) : undefined,
              config: r.config ?? undefined,
            },
            `PriceRule(${r.id})`,
          );
          return {
            id: r.id,
            kind: parsed.kind,
            condition: (parsed.condition ?? null) as ConditionJson | null,
            qtyFrom: 'qtyFrom' in parsed ? parsed.qtyFrom ?? null : null,
            qtyTo: 'qtyTo' in parsed ? parsed.qtyTo ?? null : null,
            amountMinor: 'amountMinor' in parsed ? parsed.amountMinor ?? null : null,
            multiplier: 'multiplier' in parsed ? parsed.multiplier ?? null : null,
            config: 'config' in parsed ? parsed.config : null,
            sortOrder: r.sortOrder,
          };
        }),
        productionRules: definition.productionRules.map((r) => {
          const parsed = parseOrThrow(
            productionRuleSchema,
            { condition: r.condition, workingDays: r.workingDays, cutoff: r.cutoff, priority: r.priority },
            `ProductionTimeRule(${r.id})`,
          );
          return {
            id: r.id,
            condition: (parsed.condition ?? null) as ConditionJson | null,
            workingDays: parsed.workingDays,
            cutoff: parsed.cutoff,
            priority: parsed.priority,
          };
        }),
        upsells: definition.upsells.map((u) => ({
          code: u.code,
          label: u.label,
          pricing: u.pricing,
          amountMinor: u.amountMinor,
          multiplier: u.multiplier !== null ? Number(u.multiplier) : null,
          isActive: u.isActive,
          visibleIf: u.visibleIf
            ? (parseOrThrow(visibleIfSchema, u.visibleIf, `CalculatorUpsell(${u.code}).visibleIf`) as ConditionJson)
            : null,
        })),
      };
    } catch (error) {
      if (error instanceof RuleValidationError) {
        this.logger.error(`${error.message}: ${error.issues.join('; ')}`);
        throw new UnprocessableEntityException({
          message: 'Калькулятор временно недоступен: ошибка конфигурации',
          errors: [{ param: 'qty', message: 'Конфигурация калькулятора повреждена, обратитесь позже' }],
        });
      }
      throw error;
    }
  }
}
