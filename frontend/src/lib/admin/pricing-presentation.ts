/**
 * Отображение admin-pricing: статусы прайса, режим DEMO/LIVE, подписи видов
 * правил, форматирование дат/денег/периодов. Без редизайна — те же токены.
 */
import type { PriceListStatus, PriceRuleKind, PricingMode } from '@/lib/api/admin-pricing';

export const PRICE_STATUS_LABEL: Record<PriceListStatus, string> = {
  DRAFT: 'Черновик',
  ACTIVE: 'Активный',
  ARCHIVED: 'Архив',
};

export const PRICE_STATUS_BADGE: Record<PriceListStatus, string> = {
  DRAFT: 'bg-warning/15 text-warning',
  ACTIVE: 'bg-success/15 text-success',
  ARCHIVED: 'bg-surface-2 text-muted',
};

export function priceStatusLabel(status: string): string {
  return PRICE_STATUS_LABEL[status as PriceListStatus] ?? status;
}

export function priceStatusBadge(status: string): string {
  return PRICE_STATUS_BADGE[status as PriceListStatus] ?? 'bg-surface-2 text-muted';
}

/** Бейдж режима цены. Источник истины — backend (isDemo/pricingMode). */
export function pricingModeBadge(mode: PricingMode): string {
  return mode === 'DEMO' ? 'bg-warning/15 text-warning' : 'bg-primary/15 text-primary';
}

/** Человеческие подписи видов правил (для технического редактора). */
export const RULE_KIND_LABEL: Record<PriceRuleKind, string> = {
  BASE_TIER: 'База: цена за штуку по тиражу',
  BASE_PER_SQM: 'База: цена за м²',
  MULTIPLIER: 'Множитель',
  SURCHARGE_FLAT: 'Надбавка разовая',
  SURCHARGE_PER_UNIT: 'Надбавка за единицу',
  QTY_DISCOUNT: 'Скидка по тиражу',
  MIN_TOTAL: 'Минимальная сумма',
  SURCHARGE_PER_LENGTH: 'Надбавка за длину',
  SURCHARGE_PER_INTERVAL_COUNT: 'Надбавка за интервалы',
  BASE_PER_MULTI_QTY_LINE: 'База: строка мультиколичества',
};

export const RULE_KINDS: PriceRuleKind[] = Object.keys(RULE_KIND_LABEL) as PriceRuleKind[];

export function ruleKindLabel(kind: string): string {
  return RULE_KIND_LABEL[kind as PriceRuleKind] ?? kind;
}

/** Какие денежные/числовые поля показывать для вида правила (технический редактор). */
export function ruleKindFields(kind: PriceRuleKind): {
  tier: boolean;
  amount: boolean;
  multiplier: boolean;
} {
  switch (kind) {
    case 'BASE_TIER':
    case 'QTY_DISCOUNT':
      return { tier: true, amount: kind === 'BASE_TIER', multiplier: kind === 'QTY_DISCOUNT' };
    case 'MULTIPLIER':
      return { tier: false, amount: false, multiplier: true };
    case 'BASE_PER_SQM':
    case 'SURCHARGE_FLAT':
    case 'SURCHARGE_PER_UNIT':
    case 'MIN_TOTAL':
    case 'SURCHARGE_PER_LENGTH':
    case 'SURCHARGE_PER_INTERVAL_COUNT':
    case 'BASE_PER_MULTI_QTY_LINE':
      return { tier: false, amount: true, multiplier: false };
    default:
      return { tier: false, amount: true, multiplier: false };
  }
}

/** Копейки → рубли-строка. */
export function minorToRub(amountMinor: number | null | undefined): string {
  if (amountMinor == null) return '—';
  return (amountMinor / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatPricingDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Период действия «с … по …» / «бессрочно». */
export function formatValidPeriod(validFrom: string | null, validTo: string | null): string {
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('ru-RU');
  if (!validFrom && !validTo) return 'Бессрочно';
  if (validFrom && !validTo) return `с ${fmt(validFrom)}`;
  if (!validFrom && validTo) return `по ${fmt(validTo)}`;
  return `${fmt(validFrom!)} — ${fmt(validTo!)}`;
}

/** Русские подписи действий аудита. */
export const AUDIT_ACTION_LABEL: Record<string, string> = {
  'pricing.draft.clone': 'создал черновик',
  'pricing.rule.create': 'добавил правило',
  'pricing.rule.update': 'изменил правило',
  'pricing.rule.delete': 'удалил правило',
  'pricing.publish': 'опубликовал версию',
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABEL[action] ?? action;
}

export const pricingDefinitionPath = (definitionId: string) => `/admin/pricing/${encodeURIComponent(definitionId)}/`;
export const priceListPath = (priceListId: string) => `/admin/pricing/price-lists/${encodeURIComponent(priceListId)}/`;
