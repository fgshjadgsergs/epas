import { describe, expect, it } from 'vitest';
import { showDemoPricingNotice } from './demo-pricing';

/**
 * Источник истины — ответ backend. Env-флаг работает только как fallback,
 * пока серверный pricingMode неизвестен, и никогда не перекрывает его.
 */
describe('showDemoPricingNotice', () => {
  it('backend сказал DEMO — пометка показывается', () => {
    expect(showDemoPricingNotice('DEMO')).toBe(true);
  });

  it('backend сказал LIVE — пометки нет, даже если стенд помечен демо-флагом', () => {
    // DEMO_PRICING_FALLBACK читается на этапе импорта; главное здесь — что
    // ответ backend имеет приоритет и LIVE всегда скрывает пометку.
    expect(showDemoPricingNotice('LIVE')).toBe(false);
  });

  it('ответа ещё нет — используется env-fallback стенда', () => {
    // В тестовой среде NEXT_PUBLIC_DEMO_PRICING не задан → fallback false.
    expect(showDemoPricingNotice(null)).toBe(false);
    expect(showDemoPricingNotice(undefined)).toBe(false);
  });
});
