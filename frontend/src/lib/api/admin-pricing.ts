import { apiFetch } from './client';

/**
 * Typed-клиент Admin Pricing API. Управляет только ценовой частью
 * существующих калькуляторов (PriceList + PriceRule). UI /admin/pricing здесь
 * не делается — только контракт.
 *
 * actorId клиент НЕ отправляет: он берётся из проверенной backend-сессии.
 * Мутации DRAFT передают expectedRevision (оптимистичная блокировка).
 */

export type PriceListStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type PricingMode = 'DEMO' | 'LIVE';

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

export interface PricingMoney {
  amountMinor: number;
  currency: string;
}

export interface PricingDefinitionSummary {
  id: string;
  code: string;
  title: string;
  version: number;
  status: PriceListStatus;
  isDemo: boolean;
  pricingMode: string;
  priceListCount: number;
}

export interface PricingDefinitionOption {
  value: string;
  label: string;
  isActive: boolean;
}

export interface PricingDefinitionParameter {
  urlKey: string;
  label: string;
  type: string;
  unit: string | null;
  isRequired: boolean;
  options: PricingDefinitionOption[];
}

export interface PricingDefinitionDetail {
  id: string;
  code: string;
  title: string;
  version: number;
  status: PriceListStatus;
  isDemo: boolean;
  pricingMode: string;
  minQty: number;
  maxQty: number;
  parameters: PricingDefinitionParameter[];
  readOnly: true;
}

export interface PriceListSummary {
  id: string;
  definitionId: string;
  version: number;
  status: PriceListStatus;
  isDemo: boolean;
  pricingMode: PricingMode;
  currency: string;
  validFrom: string | null;
  validTo: string | null;
  revision: number;
  updatedAt: string;
  ruleCount?: number;
}

export interface PriceRuleView {
  id: string;
  kind: PriceRuleKind;
  condition: Record<string, unknown> | null;
  qtyFrom: number | null;
  qtyTo: number | null;
  amountMinor: number | null;
  multiplier: number | null;
  config: Record<string, unknown> | null;
  priority: number;
}

export interface ProductionTimeRuleView {
  id: string;
  condition: Record<string, unknown> | null;
  workingDays: number;
  cutoff: string;
  priority: number;
  readOnly: true;
}

export interface PriceListDetail extends PriceListSummary {
  rules: PriceRuleView[];
  productionRules: ProductionTimeRuleView[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DraftRuleInput {
  kind: PriceRuleKind;
  priority?: number;
  condition?: Record<string, unknown> | null;
  qtyFrom?: number | null;
  qtyTo?: number | null;
  amountMinor?: number | null;
  multiplier?: number | null;
  config?: Record<string, unknown> | null;
}

export interface RuleMutationResult {
  revision: number;
  result: PriceRuleView | { deleted: true; ruleId: string };
}

export interface PricingValidationError {
  code: string;
  message: string;
  path?: string;
  ruleId?: string;
}

export interface ValidateDraftResult {
  valid: boolean;
  revision: number;
  errors: PricingValidationError[];
  warnings: unknown[];
}

export interface DryRunResult {
  priceListId: string;
  priceListVersion: number;
  status: PriceListStatus;
  pricingMode: PricingMode;
  isDemo: boolean;
  normalizedParameters: Record<string, unknown>;
  quantity: number;
  total: PricingMoney;
  unitPrice: PricingMoney;
  priceWithVat: PricingMoney;
  currency: string;
  production: { workingDays: number; readyDateLabel?: string; cutoff?: string };
  appliedUpsells: unknown[];
  derived: unknown[];
  lineItems: unknown[];
  totalQuantity: number;
  warnings: unknown[];
  calculationVersion: string;
  engineVersion: string;
}

export interface PublishDraftResult {
  id: string;
  version: number;
  status: PriceListStatus;
  archivedPriceListIds: string[];
}

/** Безопасное представление сотрудника: только имя, без id/PII. */
export interface PricingAuditActor {
  displayName: string;
}

export interface PricingAuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  changedBy: PricingAuditActor | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditQuery {
  definitionId?: string;
  priceListId?: string;
  entityId?: string;
  action?: string;
  page?: number;
  pageSize?: number;
}

// --- Read ---

export function getPricingDefinitions(
  token: string,
  query: { page?: number; pageSize?: number } = {},
): Promise<Paginated<PricingDefinitionSummary>> {
  return apiFetch('admin/pricing/definitions', {
    token,
    query: { page: query.page, pageSize: query.pageSize },
    cache: 'no-store',
  });
}

export function getPricingDefinition(definitionId: string, token: string): Promise<PricingDefinitionDetail> {
  return apiFetch(`admin/pricing/definitions/${encodeURIComponent(definitionId)}`, {
    token,
    cache: 'no-store',
  });
}

export function getPriceLists(
  definitionId: string,
  token: string,
  query: { page?: number; pageSize?: number } = {},
): Promise<Paginated<PriceListSummary>> {
  return apiFetch(`admin/pricing/definitions/${encodeURIComponent(definitionId)}/price-lists`, {
    token,
    query: { page: query.page, pageSize: query.pageSize },
    cache: 'no-store',
  });
}

export function getPriceList(priceListId: string, token: string): Promise<PriceListDetail> {
  return apiFetch(`admin/pricing/price-lists/${encodeURIComponent(priceListId)}`, {
    token,
    cache: 'no-store',
  });
}

export function getPricingAudit(token: string, query: AuditQuery = {}): Promise<Paginated<PricingAuditEntry>> {
  return apiFetch('admin/pricing/audit', {
    token,
    query: {
      definitionId: query.definitionId,
      priceListId: query.priceListId,
      entityId: query.entityId,
      action: query.action,
      page: query.page,
      pageSize: query.pageSize,
    },
    cache: 'no-store',
  });
}

// --- Create / Clone ---

/** Создать новый пустой DRAFT-прайс для определения (когда клонировать нечего). */
export function createPriceList(definitionId: string, token: string): Promise<PriceListDetail> {
  return apiFetch(`admin/pricing/definitions/${encodeURIComponent(definitionId)}/price-lists`, {
    method: 'POST',
    token,
  });
}

export function clonePriceListDraft(priceListId: string, token: string): Promise<PriceListDetail> {
  return apiFetch(`admin/pricing/price-lists/${encodeURIComponent(priceListId)}/clone-draft`, {
    method: 'POST',
    token,
  });
}

// --- DRAFT CRUD ---

export function createDraftRule(
  priceListId: string,
  body: DraftRuleInput & { expectedRevision: number },
  token: string,
): Promise<RuleMutationResult> {
  return apiFetch(`admin/pricing/price-lists/${encodeURIComponent(priceListId)}/rules`, {
    method: 'POST',
    body,
    token,
  });
}

export function updateDraftRule(
  priceListId: string,
  ruleId: string,
  body: DraftRuleInput & { expectedRevision: number },
  token: string,
): Promise<RuleMutationResult> {
  return apiFetch(
    `admin/pricing/price-lists/${encodeURIComponent(priceListId)}/rules/${encodeURIComponent(ruleId)}`,
    { method: 'PATCH', body, token },
  );
}

export function deleteDraftRule(
  priceListId: string,
  ruleId: string,
  expectedRevision: number,
  token: string,
): Promise<RuleMutationResult> {
  return apiFetch(
    `admin/pricing/price-lists/${encodeURIComponent(priceListId)}/rules/${encodeURIComponent(ruleId)}`,
    { method: 'DELETE', body: { expectedRevision }, token },
  );
}

// --- Validate / dry-run ---

export function validateDraft(priceListId: string, token: string): Promise<ValidateDraftResult> {
  return apiFetch(`admin/pricing/price-lists/${encodeURIComponent(priceListId)}/validate`, {
    method: 'POST',
    token,
  });
}

export function dryRunDraft(
  priceListId: string,
  body: { parameters?: Record<string, unknown>; upsells?: string[] },
  token: string,
): Promise<DryRunResult> {
  return apiFetch(`admin/pricing/price-lists/${encodeURIComponent(priceListId)}/dry-run`, {
    method: 'POST',
    body,
    token,
  });
}

// --- Publish ---

export function publishDraft(
  priceListId: string,
  expectedRevision: number,
  token: string,
): Promise<PublishDraftResult> {
  return apiFetch(`admin/pricing/price-lists/${encodeURIComponent(priceListId)}/publish`, {
    method: 'POST',
    body: { expectedRevision },
    token,
  });
}
