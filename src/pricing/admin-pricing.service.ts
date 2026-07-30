import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PriceListStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PricingEnvironmentService } from '../config/pricing-environment.service';
import { PublishService } from '../calculator/publish.service';
import { CalculatorService } from '../calculator/calculator.service';
import { priceRuleFieldsSchema } from '../calculator/rule-schemas';
import { AuditLogService } from '../audit/audit-log.service';
import { CreateDraftRuleDto, UpdateDraftRuleDto } from './dto/draft-rule.dto';
import { DryRunDto } from './dto/pricing-query.dto';

/** Advisory-lock seed для операций над версиями одного определения (как publish). */
const DEFINITION_LOCK_SEED = 42;
/** Advisory-lock seed для правок правил одного DRAFT. */
const DRAFT_EDIT_LOCK_SEED = 55;

const PRICE_LIST_DEF_INCLUDE = {
  definition: { include: { parameters: { include: { options: true } } } },
} satisfies Prisma.PriceListInclude;

type DefinitionWithParams = Prisma.CalculatorDefinitionGetPayload<{
  include: { parameters: { include: { options: true } } };
}>;

/** DB-триггер неизменяемости → доменный 409 вместо 500. */
function isImmutableTriggerError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes('is immutable') || error.message.includes('are immutable'))
  );
}

/**
 * Admin Pricing API поверх Pricing Engine и PublishService.
 *
 * Управляет ТОЛЬКО ценовой частью существующих CalculatorDefinition
 * (PriceList + PriceRule). Определение, параметры, опции, совместимости и
 * bindings — read-only: их структура меняется отдельным техническим workflow.
 */
@Injectable()
export class AdminPricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingEnv: PricingEnvironmentService,
    private readonly publishService: PublishService,
    private readonly calculatorService: CalculatorService,
    private readonly audit: AuditLogService,
  ) {}

  // --- Read -----------------------------------------------------------------

  async listDefinitions(query: { page?: number; pageSize?: number }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const [rows, total] = await Promise.all([
      this.prisma.calculatorDefinition.findMany({
        orderBy: [{ code: 'asc' }, { version: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { priceLists: true } } },
      }),
      this.prisma.calculatorDefinition.count(),
    ]);
    return {
      items: rows.map((d) => ({
        id: d.id,
        code: d.code,
        title: d.title,
        version: d.version,
        status: d.status,
        isDemo: d.isDemo,
        pricingMode: d.pricingMode,
        priceListCount: d._count.priceLists,
      })),
      total,
      page,
      pageSize,
    };
  }

  async getDefinition(definitionId: string) {
    const def = await this.prisma.calculatorDefinition.findUnique({
      where: { id: definitionId },
      include: { parameters: { orderBy: { sortOrder: 'asc' }, include: { options: { orderBy: { sortOrder: 'asc' } } } } },
    });
    if (!def) throw new NotFoundException('Определение не найдено');
    return {
      id: def.id,
      code: def.code,
      title: def.title,
      version: def.version,
      status: def.status,
      isDemo: def.isDemo,
      pricingMode: def.pricingMode,
      minQty: def.minQty,
      maxQty: def.maxQty,
      // Read-only: параметры/опции нужны UI для построения понятных условий,
      // но менять их через этот API нельзя.
      parameters: def.parameters.map((p) => ({
        urlKey: p.urlKey,
        label: p.label,
        type: p.type,
        unit: p.unit,
        isRequired: p.isRequired,
        options: p.options.map((o) => ({ value: o.value, label: o.label, isActive: o.isActive })),
      })),
      readOnly: true,
    };
  }

  async listPriceLists(definitionId: string, query: { page?: number; pageSize?: number }) {
    const def = await this.prisma.calculatorDefinition.findUnique({ where: { id: definitionId }, select: { id: true } });
    if (!def) throw new NotFoundException('Определение не найдено');
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const [rows, total] = await Promise.all([
      this.prisma.priceList.findMany({
        where: { definitionId },
        orderBy: { version: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { rules: true } } },
      }),
      this.prisma.priceList.count({ where: { definitionId } }),
    ]);
    return {
      items: rows.map((pl) => this.priceListSummary(pl)),
      total,
      page,
      pageSize,
    };
  }

  async getPriceList(priceListId: string) {
    const pl = await this.prisma.priceList.findUnique({
      where: { id: priceListId },
      include: { rules: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!pl) throw new NotFoundException('Прайс-лист не найден');
    // Production-time rules принадлежат definition (read-only), но полезны UI.
    const productionRules = await this.prisma.productionTimeRule.findMany({
      where: { definitionId: pl.definitionId },
      orderBy: { priority: 'desc' },
    });
    return {
      ...this.priceListSummary(pl),
      rules: pl.rules.map((r) => this.ruleView(r)),
      productionRules: productionRules.map((r) => ({
        id: r.id,
        condition: r.condition,
        workingDays: r.workingDays,
        cutoff: r.cutoff,
        priority: r.priority,
        readOnly: true,
      })),
    };
  }

  // --- Clone ----------------------------------------------------------------

  async cloneDraft(priceListId: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const source = await tx.priceList.findUnique({
        where: { id: priceListId },
        include: { rules: true },
      });
      if (!source) throw new NotFoundException('Прайс-лист не найден');

      // Сериализуем клон/публикацию версий одного определения.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${source.definitionId}, ${DEFINITION_LOCK_SEED}))`;

      if (source.status === 'DRAFT') {
        throw new ConflictException({
          message: 'Черновик редактируется напрямую — клонировать нужно ACTIVE или ARCHIVED',
          code: 'PRICING_SOURCE_IS_DRAFT',
        });
      }

      // Один editable DRAFT на определение: не плодим случайные черновики.
      const existingDraft = await tx.priceList.findFirst({
        where: { definitionId: source.definitionId, status: 'DRAFT' },
        select: { id: true },
      });
      if (existingDraft) {
        throw new ConflictException({
          message: 'Для этого определения уже есть черновик — отредактируйте или опубликуйте его',
          code: 'PRICING_DRAFT_EXISTS',
          draftId: existingDraft.id,
        });
      }

      const maxVersion = await tx.priceList.aggregate({
        where: { definitionId: source.definitionId },
        _max: { version: true },
      });
      const nextVersion = (maxVersion._max.version ?? 0) + 1;

      const draft = await tx.priceList.create({
        data: {
          definitionId: source.definitionId,
          version: nextVersion,
          status: 'DRAFT',
          // currency наследуется от источника (менять её в MVP нельзя).
          currency: source.currency,
          isDemo: source.isDemo,
          validFrom: source.validFrom,
          validTo: source.validTo,
          comment: source.comment,
          revision: 0,
          rules: {
            create: source.rules.map((r) => ({
              kind: r.kind,
              condition: (r.condition ?? Prisma.JsonNull) as Prisma.InputJsonValue,
              qtyFrom: r.qtyFrom,
              qtyTo: r.qtyTo,
              amountMinor: r.amountMinor,
              multiplier: r.multiplier,
              config: (r.config ?? Prisma.JsonNull) as Prisma.InputJsonValue,
              sortOrder: r.sortOrder,
            })),
          },
        },
        include: { rules: { orderBy: { sortOrder: 'asc' } } },
      });

      await this.audit.record(
        {
          actorId,
          action: 'pricing.draft.clone',
          entityType: 'PriceList',
          entityId: draft.id,
          before: { sourcePriceListId: source.id, sourceVersion: source.version, sourceStatus: source.status },
          after: { version: draft.version, status: draft.status, ruleCount: draft.rules.length },
        },
        tx,
      );

      return {
        ...this.priceListSummary(draft),
        rules: draft.rules.map((r) => this.ruleView(r)),
      };
    });
  }

  // --- Create (пустой прайс с нуля) -----------------------------------------

  /**
   * Создать НОВЫЙ пустой DRAFT-прайс для определения (когда клонировать нечего —
   * например у боевого определения ещё нет ни одного прайса). Правила добавляет
   * оператор через createRule → validate → publish. `isDemo` наследуется от
   * определения: боевое определение (isDemo=false) получает боевой прайс.
   */
  async createPriceList(definitionId: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const definition = await tx.calculatorDefinition.findUnique({
        where: { id: definitionId },
        select: { id: true, isDemo: true },
      });
      if (!definition) throw new NotFoundException('Определение не найдено');

      // Сериализуем создание/публикацию версий одного определения (как clone).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${definitionId}, ${DEFINITION_LOCK_SEED}))`;

      // Один editable DRAFT на определение: не плодим случайные черновики.
      const existingDraft = await tx.priceList.findFirst({
        where: { definitionId, status: 'DRAFT' },
        select: { id: true },
      });
      if (existingDraft) {
        throw new ConflictException({
          message: 'Для этого определения уже есть черновик — отредактируйте или опубликуйте его',
          code: 'PRICING_DRAFT_EXISTS',
          draftId: existingDraft.id,
        });
      }

      const maxVersion = await tx.priceList.aggregate({
        where: { definitionId },
        _max: { version: true },
      });
      const nextVersion = (maxVersion._max.version ?? 0) + 1;

      const draft = await tx.priceList.create({
        data: {
          definitionId,
          version: nextVersion,
          status: 'DRAFT',
          currency: 'RUB',
          isDemo: definition.isDemo,
          revision: 0,
        },
        include: { rules: { orderBy: { sortOrder: 'asc' } } },
      });

      await this.audit.record(
        {
          actorId,
          action: 'pricing.draft.create',
          entityType: 'PriceList',
          entityId: draft.id,
          before: null,
          after: { version: draft.version, status: draft.status, isDemo: draft.isDemo },
        },
        tx,
      );

      return {
        ...this.priceListSummary(draft),
        rules: draft.rules.map((r) => this.ruleView(r)),
      };
    });
  }

  // --- DRAFT rule CRUD ------------------------------------------------------

  async createRule(priceListId: string, dto: CreateDraftRuleDto, actorId: string) {
    return this.mutateDraft(priceListId, dto.expectedRevision, actorId, async (tx, draft, definition) => {
      this.assertRuleValid(dto, definition);
      const created = await tx.priceRule.create({
        data: {
          priceListId: draft.id,
          kind: dto.kind,
          condition: (dto.condition ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          qtyFrom: dto.qtyFrom ?? null,
          qtyTo: dto.qtyTo ?? null,
          amountMinor: dto.amountMinor ?? null,
          multiplier: dto.multiplier ?? null,
          config: (dto.config ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          sortOrder: dto.priority ?? 0,
        },
      });
      return {
        audit: { action: 'pricing.rule.create', entityId: created.id, before: null, after: this.ruleView(created) },
        result: this.ruleView(created),
      };
    });
  }

  async updateRule(priceListId: string, ruleId: string, dto: UpdateDraftRuleDto, actorId: string) {
    return this.mutateDraft(priceListId, dto.expectedRevision, actorId, async (tx, draft, definition) => {
      const existing = await tx.priceRule.findUnique({ where: { id: ruleId } });
      if (!existing || existing.priceListId !== draft.id) {
        throw new NotFoundException('Правило не найдено в этом прайс-листе');
      }
      this.assertRuleValid(dto, definition);
      const before = this.ruleView(existing);
      let updated;
      try {
        updated = await tx.priceRule.update({
          where: { id: ruleId },
          data: {
            kind: dto.kind,
            condition: (dto.condition ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            qtyFrom: dto.qtyFrom ?? null,
            qtyTo: dto.qtyTo ?? null,
            amountMinor: dto.amountMinor ?? null,
            multiplier: dto.multiplier ?? null,
            config: (dto.config ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            sortOrder: dto.priority ?? existing.sortOrder,
          },
        });
      } catch (error) {
        if (isImmutableTriggerError(error)) throw this.immutableConflict();
        throw error;
      }
      return {
        audit: { action: 'pricing.rule.update', entityId: updated.id, before, after: this.ruleView(updated) },
        result: this.ruleView(updated),
      };
    });
  }

  async deleteRule(priceListId: string, ruleId: string, expectedRevision: number, actorId: string) {
    return this.mutateDraft(priceListId, expectedRevision, actorId, async (tx, draft) => {
      const existing = await tx.priceRule.findUnique({ where: { id: ruleId } });
      if (!existing || existing.priceListId !== draft.id) {
        throw new NotFoundException('Правило не найдено в этом прайс-листе');
      }
      const before = this.ruleView(existing);
      try {
        await tx.priceRule.delete({ where: { id: ruleId } });
      } catch (error) {
        if (isImmutableTriggerError(error)) throw this.immutableConflict();
        throw error;
      }
      return {
        audit: { action: 'pricing.rule.delete', entityId: ruleId, before, after: null },
        result: { deleted: true, ruleId },
      };
    });
  }

  // --- Validate / dry-run ---------------------------------------------------

  async validateDraft(priceListId: string) {
    const { priceList, issues } = await this.publishService.collectDraftIssues(priceListId);
    if (!priceList) throw new NotFoundException('Прайс-лист не найден');
    if (priceList.status !== 'DRAFT') {
      throw new ConflictException({ message: 'Валидировать можно только черновик', code: 'PRICING_NOT_DRAFT' });
    }
    return {
      valid: issues.length === 0,
      revision: priceList.revision,
      errors: issues,
      warnings: [] as unknown[],
    };
  }

  async dryRun(priceListId: string, dto: DryRunDto) {
    const pl = await this.prisma.priceList.findUnique({ where: { id: priceListId }, select: { status: true } });
    if (!pl) throw new NotFoundException('Прайс-лист не найден');
    // Строго DRAFT: dry-run не должен случайно считать по ACTIVE.
    if (pl.status !== 'DRAFT') {
      throw new ConflictException({ message: 'Dry-run доступен только для черновика', code: 'PRICING_NOT_DRAFT' });
    }
    return this.calculatorService.dryRunPriceList(priceListId, {
      parameters: dto.parameters ?? {},
      upsells: dto.upsells,
    });
  }

  // --- Publish --------------------------------------------------------------

  async publishDraft(priceListId: string, expectedRevision: number, actorId: string) {
    const before = await this.prisma.priceList.findUnique({
      where: { id: priceListId },
      select: { status: true, version: true, revision: true, definitionId: true },
    });
    if (!before) throw new NotFoundException('Прайс-лист не найден');

    let published;
    try {
      published = await this.publishService.publishDraftReplacingActive(priceListId, { expectedRevision });
    } catch (error) {
      if (isImmutableTriggerError(error)) throw this.immutableConflict();
      throw error;
    }

    await this.audit.record({
      actorId,
      action: 'pricing.publish',
      entityType: 'PriceList',
      entityId: published.id,
      before: { status: before.status, revision: before.revision },
      after: { status: published.status, version: published.version, archivedIds: published.archivedIds },
    });

    return {
      id: published.id,
      version: published.version,
      status: published.status,
      archivedPriceListIds: published.archivedIds,
    };
  }

  // --- Audit read -----------------------------------------------------------

  /**
   * Безопасная история pricing-изменений. Фильтры: definitionId / priceListId /
   * entityId / action + пагинация. Сырой actorId наружу НЕ отдаётся — только
   * `changedBy: { displayName } | null` из firstName/lastName (без email/PII).
   * before/after — те же безопасные pricing-поля, что уже записаны.
   */
  async listAudit(query: {
    definitionId?: string;
    priceListId?: string;
    entityId?: string;
    action?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.AuditLogWhereInput = {};
    if (query.action) where.action = query.action;

    // Область по сущностям: точный entityId, либо все id прайса (сам прайс +
    // его правила), либо все прайсы+правила определения.
    const entityIds = await this.resolveAuditEntityIds(query);
    if (entityIds !== null) where.entityId = { in: entityIds };

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    // Резолвим отображаемые имена сотрудников одним запросом.
    const actorIds = [...new Set(rows.map((r) => r.actorId).filter((v): v is string => Boolean(v)))];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const nameById = new Map(actors.map((u) => [u.id, this.actorDisplayName(u)]));

    return {
      items: rows.map((r) => ({
        id: r.id,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        changedBy: r.actorId ? { displayName: nameById.get(r.actorId) ?? 'Сотрудник' } : null,
        before: r.before ?? null,
        after: r.after ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  /** Множество entityId для фильтра аудита; null — без ограничения по сущности. */
  private async resolveAuditEntityIds(query: {
    definitionId?: string;
    priceListId?: string;
    entityId?: string;
  }): Promise<string[] | null> {
    if (query.entityId) return [query.entityId];

    if (query.priceListId) {
      const rules = await this.prisma.priceRule.findMany({
        where: { priceListId: query.priceListId },
        select: { id: true },
      });
      return [query.priceListId, ...rules.map((r) => r.id)];
    }

    if (query.definitionId) {
      const priceLists = await this.prisma.priceList.findMany({
        where: { definitionId: query.definitionId },
        select: { id: true },
      });
      const plIds = priceLists.map((pl) => pl.id);
      const rules = plIds.length
        ? await this.prisma.priceRule.findMany({ where: { priceListId: { in: plIds } }, select: { id: true } })
        : [];
      return [...plIds, ...rules.map((r) => r.id)];
    }

    return null;
  }

  /** Безопасное имя сотрудника: имя+фамилия, иначе нейтральная подпись. */
  private actorDisplayName(actor: { firstName: string | null; lastName: string | null }): string {
    const name = [actor.firstName, actor.lastName].filter(Boolean).join(' ').trim();
    return name || 'Сотрудник';
  }

  // --- helpers --------------------------------------------------------------

  /**
   * Общий каркас мутации DRAFT: транзакция + advisory-lock + проверка статуса
   * и revision + инкремент revision + аудит. Гарантирует, что параллельные
   * правки двух админов не приведут к тихой потере обновления.
   */
  private async mutateDraft<T>(
    priceListId: string,
    expectedRevision: number,
    actorId: string,
    work: (
      tx: Prisma.TransactionClient,
      draft: { id: string; revision: number },
      definition: DefinitionWithParams,
    ) => Promise<{ audit: { action: string; entityId: string; before: unknown; after: unknown }; result: T }>,
  ): Promise<{ revision: number; result: T }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${priceListId}, ${DRAFT_EDIT_LOCK_SEED}))`;

      const draft = await tx.priceList.findUnique({
        where: { id: priceListId },
        include: PRICE_LIST_DEF_INCLUDE,
      });
      if (!draft) throw new NotFoundException('Прайс-лист не найден');
      if (draft.status !== 'DRAFT') {
        throw new ConflictException({
          message: 'Редактировать можно только черновик; ACTIVE/ARCHIVED неизменяемы',
          code: 'PRICING_NOT_DRAFT',
          status: draft.status,
        });
      }
      if (draft.revision !== expectedRevision) {
        throw new ConflictException({
          message: 'Черновик изменился с момента загрузки — обновите данные',
          code: 'PRICING_DRAFT_CONFLICT',
          currentRevision: draft.revision,
        });
      }

      const { audit, result } = await work(tx, { id: draft.id, revision: draft.revision }, draft.definition);

      // Инкремент revision — токен оптимистичной блокировки для следующей правки.
      const bumped = await tx.priceList.update({
        where: { id: draft.id },
        data: { revision: { increment: 1 } },
        select: { revision: true },
      });

      await this.audit.record(
        {
          actorId,
          action: audit.action,
          entityType: 'PriceRule',
          entityId: audit.entityId,
          before: (audit.before ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          after: (audit.after ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
        tx,
      );

      return { revision: bumped.revision, result };
    });
  }

  /**
   * Проверки правила перед БД: safe integer денег, корректная форма правила
   * (kind + поля через zod rule-schema, отклоняет несовместимые kind), условия
   * ссылаются на существующие параметры/опции текущего определения.
   */
  private assertRuleValid(dto: CreateDraftRuleDto | UpdateDraftRuleDto, definition: DefinitionWithParams): void {
    if (dto.amountMinor != null && !Number.isSafeInteger(dto.amountMinor)) {
      throw new BadRequestException('amountMinor должен быть safe integer');
    }
    if (dto.qtyFrom != null && !Number.isSafeInteger(dto.qtyFrom)) {
      throw new BadRequestException('qtyFrom должен быть safe integer');
    }
    if (dto.qtyTo != null && !Number.isSafeInteger(dto.qtyTo)) {
      throw new BadRequestException('qtyTo должен быть safe integer');
    }

    // Форма правила (kind + поля) — тот же zod, что использует движок/публикация.
    const parsed = priceRuleFieldsSchema.safeParse({
      kind: dto.kind,
      condition: dto.condition ?? null,
      qtyFrom: dto.qtyFrom ?? undefined,
      qtyTo: dto.qtyTo ?? undefined,
      amountMinor: dto.amountMinor ?? undefined,
      multiplier: dto.multiplier ?? undefined,
      config: dto.config ?? undefined,
    });
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Некорректное правило прайса',
        errors: parsed.error.issues.map((i) => i.message),
      });
    }

    // Условие ссылается на реальные параметры/опции определения.
    this.assertConditionRefsExist(dto.condition ?? null, definition);
  }

  private assertConditionRefsExist(
    condition: Record<string, unknown> | null,
    definition: DefinitionWithParams,
  ): void {
    if (!condition) return;
    const paramByKey = new Map(definition.parameters.map((p) => [p.urlKey, p]));
    for (const [key, raw] of Object.entries(condition)) {
      const param = paramByKey.get(key);
      if (!param) {
        throw new BadRequestException(`Условие ссылается на неизвестный параметр «${key}»`);
      }
      const activeValues = new Set(param.options.filter((o) => o.isActive).map((o) => o.value));
      // Параметры без опций (DIMENSION и т.п.) не проверяем на членство.
      if (activeValues.size === 0) continue;
      const values = Array.isArray(raw) ? raw : [raw];
      for (const v of values) {
        if (typeof v !== 'string' || !activeValues.has(v)) {
          throw new BadRequestException(`Условие «${key}» ссылается на несуществующую опцию «${String(v)}»`);
        }
      }
    }
  }

  private immutableConflict(): ConflictException {
    return new ConflictException({
      message: 'Опубликованный прайс неизменяем; создайте черновик новой версии',
      code: 'PRICING_IMMUTABLE',
    });
  }

  private priceListSummary(pl: {
    id: string;
    definitionId: string;
    version: number;
    status: PriceListStatus;
    isDemo: boolean;
    currency: string;
    validFrom: Date | null;
    validTo: Date | null;
    revision: number;
    updatedAt: Date;
    _count?: { rules: number };
  }) {
    return {
      id: pl.id,
      definitionId: pl.definitionId,
      version: pl.version,
      status: pl.status,
      isDemo: pl.isDemo,
      pricingMode: this.pricingEnv.pricingModeOf({ isDemo: pl.isDemo }),
      currency: pl.currency,
      validFrom: pl.validFrom ? pl.validFrom.toISOString() : null,
      validTo: pl.validTo ? pl.validTo.toISOString() : null,
      revision: pl.revision,
      updatedAt: pl.updatedAt.toISOString(),
      ruleCount: pl._count?.rules,
    };
  }

  private ruleView(r: {
    id: string;
    kind: string;
    condition: Prisma.JsonValue;
    qtyFrom: number | null;
    qtyTo: number | null;
    amountMinor: number | null;
    multiplier: Prisma.Decimal | null;
    config: Prisma.JsonValue;
    sortOrder: number;
  }) {
    return {
      id: r.id,
      kind: r.kind,
      condition: r.condition ?? null,
      qtyFrom: r.qtyFrom,
      qtyTo: r.qtyTo,
      amountMinor: r.amountMinor,
      multiplier: r.multiplier !== null ? Number(r.multiplier) : null,
      config: r.config ?? null,
      priority: r.sortOrder,
    };
  }
}
