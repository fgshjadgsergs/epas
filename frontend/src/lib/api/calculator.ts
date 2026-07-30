import { apiFetch } from './client';
import type { FetchOptions } from './categories';

/** DTO определения калькулятора — GET /services/:slug/calculator. */
export interface CalculatorDefinitionDto {
  serviceSlug: string;
  code: string;
  title: string;
  version: number;
  pricingMode: 'TIER' | 'AREA';
  urlOrder: string[];
  qty: { min: number; max: number; step: number; default: number };
  /**
   * Производный тираж: если задан, тираж выводит сервер (произведение
   * параметров, ТЗ 2.2 «оригиналы × копии»), а поле «Тираж» не показывается.
   */
  quantityFrom?: { product: string[] } | null;
  preset: Record<string, string> | null;
  parameters: {
    urlKey: string;
    label: string;
    type: string;
    unit: string | null;
    min: number | null;
    max: number | null;
    step: number | null;
    /** Публичные границы MULTI_QTY-параметра (без цен). */
    multiQty?: {
      maxLines: number;
      lineMin: number;
      lineMax: number;
      lineStep: number;
      totalMin?: number;
      totalMax?: number;
      lineOverrides?: Record<string, { min?: number; max?: number; step?: number }>;
    } | null;
    default: string | null;
    required: boolean;
    shareable: boolean;
    visibleIf: Record<string, string | string[]> | null;
    options: { value: string; label: string; isDefault: boolean; meta: unknown }[];
  }[];
  compatibility: {
    kind: string;
    when: Record<string, string | string[]>;
    target: Record<string, unknown>;
    message: string | null;
  }[];
  // Публичный DTO намеренно не раскрывает amountMinor/multiplier — это
  // внутренние детали ценообразования; дельту цены сообщает ответ
  // /calculate.appliedUpsells. visibleIf — условие доступности опции.
  upsells: { code: string; label: string; visibleIf: Record<string, string | string[]> | null }[];
  hasActivePriceList: boolean;
  calculationVersion: string | null;
}

/** Производная метрика расчёта (площадь/периметр/люверсы) — считает только сервер. */
export interface DerivedMetricDto {
  code: string;
  label: string;
  unit: string;
  perItem: number;
  total: number;
}

/** Ответ POST /services/:slug/calculate. Деньги — целые копейки. */
export interface CalculateResponseDto {
  serviceSlug: string;
  normalizedParameters: Record<string, string | number>;
  quantity: number;
  price: { amountMinor: number; currency: string };
  unitPrice: { amountMinor: number; currency: string };
  priceWithVat: { amountMinor: number; currency: string } | null;
  production: {
    workingDays: number;
    readyAt: string | null;
    readyDateLabel: string;
    cutoff: string;
  };
  appliedUpsells: { code: string; label: string; amountMinor: number }[];
  /** Режим прайса, определённый backend по фактическому PriceList. */
  pricingMode?: 'DEMO' | 'LIVE';
  derived?: DerivedMetricDto[];
  /** Построчная разбивка MULTI_QTY (фотопечать и т.п.) — считает только сервер. */
  lineItems?: CalculationLineItemDto[];
  totalQuantity?: number;
  warnings: string[];
  calculationVersion: string;
}

/** Публичная строка расчёта MULTI_QTY. */
export interface CalculationLineItemDto {
  key: string;
  label: string;
  quantity: number;
  unitPrice: { amountMinor: number; currency: string };
  lineTotal: { amountMinor: number; currency: string };
}

export interface CalculateRequestBody {
  parameters: Record<string, string | number | Record<string, number>>;
  upsells?: string[];
}

export function getCalculatorDefinition(
  serviceSlug: string,
  options: FetchOptions = {},
): Promise<CalculatorDefinitionDto> {
  return apiFetch<CalculatorDefinitionDto>(
    `services/${encodeURIComponent(serviceSlug)}/calculator`,
    options,
  );
}

export function postCalculate(
  serviceSlug: string,
  body: CalculateRequestBody,
  signal?: AbortSignal,
): Promise<CalculateResponseDto> {
  return apiFetch<CalculateResponseDto>(`services/${encodeURIComponent(serviceSlug)}/calculate`, {
    method: 'POST',
    body,
    signal,
  });
}

export interface ConfirmCalculationResponseDto {
  snapshotId: string;
  price: { amountMinor: number; currency: string };
  calculationVersion: string;
  normalizedParameters: Record<string, unknown>;
  upsells: string[];
  derived?: DerivedMetricDto[];
  lineItems?: CalculationLineItemDto[];
  totalQuantity?: number;
}

/**
 * Подтверждение расчёта — создаёт неизменяемый CalculationSnapshot на
 * сервере. Единственный источник цены, которую можно класть в корзину:
 * backend пересчитывает ТОТ ЖЕ вход, что и preview (parameters + upsells),
 * не доверяя клиентскому calculationVersion/hash/сумме.
 */
export function postConfirmCalculation(
  serviceSlug: string,
  body: CalculateRequestBody,
): Promise<ConfirmCalculationResponseDto> {
  return apiFetch<ConfirmCalculationResponseDto>(
    `services/${encodeURIComponent(serviceSlug)}/calculate/confirm`,
    { method: 'POST', body },
  );
}
