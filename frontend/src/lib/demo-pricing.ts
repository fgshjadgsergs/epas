/**
 * Пометка демонстрационного прайса.
 *
 * Источник истины — backend: он возвращает `pricingMode` расчёта/корзины,
 * определяя его по фактически использованному PriceList (isDemo). Env-флаг
 * NEXT_PUBLIC_DEMO_PRICING оставлен только как временный fallback для
 * экранов, где серверный ответ ещё не получен, и никогда не перекрывает
 * значение от backend.
 */

/** Режим прайса, пришедший от backend. */
export type PricingMode = 'DEMO' | 'LIVE';

/** Fallback-флаг стенда: применяется, только если backend ещё не ответил. */
export const DEMO_PRICING_FALLBACK = process.env.NEXT_PUBLIC_DEMO_PRICING === 'true';

export const DEMO_PRICING_NOTICE = 'Стоимость рассчитана по демонстрационному прайсу';

/**
 * Показывать ли пометку. Ответ backend всегда важнее флага: LIVE от сервера
 * скрывает пометку даже при включённом NEXT_PUBLIC_DEMO_PRICING.
 */
export function showDemoPricingNotice(pricingMode: PricingMode | null | undefined): boolean {
  if (pricingMode) return pricingMode === 'DEMO';
  return DEMO_PRICING_FALLBACK;
}
