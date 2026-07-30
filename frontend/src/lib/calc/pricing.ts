import type { CalcConfig, CalcState, QtyTier } from './types';

export interface CalcResult {
  ok: boolean;
  price: number;
  pricePerUnit: number;
  priceWithVat: number;
  readyDateLabel: string;
  /** Время отсечки для текущего срока (ТЗ: стандарт 14:00, экспресс 12:00). */
  cutoff: string;
  /** Выгода по сравнению с минимальным тиражом, % (для динамики цены). */
  savingsPct: number;
}

/**
 * ВНИМАНИЕ: клиентская заглушка расчёта. На проде заменяется вызовом
 * POST /api/v1/calculate (форма ответа уже совпадает — см. CalcResult).
 * Цены индикативные.
 */

function tierPerUnit(tiers: QtyTier[], qty: number): number {
  let perUnit = tiers[0].perUnit;
  for (const t of tiers) if (qty >= t.qty) perUnit = t.perUnit;
  return perUnit;
}

/** Разбор значения multi-qty группы: «10x15:24,20x30:2» → {10x15: 24, 20x30: 2}. */
export function parseCounts(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of String(v ?? '').split(',')) {
    const [id, n] = part.split(':');
    const cnt = Number(n);
    if (id && Number.isFinite(cnt) && cnt > 0) out[id] = Math.floor(cnt);
  }
  return out;
}

/** Сериализация счётчиков обратно в строку состояния. */
export function serializeCounts(counts: Record<string, number>): string {
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => `${id}:${n}`)
    .join(',');
}

/** Суммарное количество по multi-qty группе (0, если группы нет). */
export function multiTotal(config: CalcConfig, sel: CalcState['params']): number {
  const g = config.groups.find((x) => x.type === 'multi-qty');
  if (!g) return -1;
  return Object.values(parseCounts(sel[g.id])).reduce((s, n) => s + n, 0);
}

/** Минимальный тираж при текущем выборе параметров. */
export function minQtyFor(config: CalcConfig, sel: CalcState['params']): number {
  return config.getMinQty?.(sel) ?? config.qtyTiers?.[0]?.qty ?? config.qtyRange?.min ?? 1;
}

/**
 * Доступно ли срочное изготовление при текущем выборе (правила из ТЗ:
 * ограничения по тиражу и совместимости параметров).
 */
export function expressAvailability(
  config: CalcConfig,
  state: Pick<CalcState, 'params' | 'qty'>,
): { ok: boolean; reason?: string } {
  const rule = config.express;
  if (!rule) return { ok: false, reason: 'для этой услуги недоступно' };
  if (rule.maxQty != null && state.qty > rule.maxQty)
    return { ok: false, reason: `только для тиража до ${rule.maxQty.toLocaleString('ru-RU')} шт.` };
  if (rule.minQty != null && state.qty < rule.minQty)
    return { ok: false, reason: `только от ${rule.minQty.toLocaleString('ru-RU')} шт.` };
  if (rule.available && !rule.available(state.params))
    return { ok: false, reason: rule.hint ?? 'недоступно для выбранных параметров' };
  return { ok: true };
}

function optionCoeffs(config: CalcConfig, state: CalcState) {
  let coeff = 1;
  let perUnitAdd = 0;
  let flatAdd = 0;
  let priceOverride: number | null = null;
  let daysOverride: number | null = null;
  const hidden = new Set(config.getHidden?.(state.params) ?? []);
  for (const g of config.groups) {
    if (!g.options || hidden.has(g.id)) continue;
    const opt = g.options.find((o) => o.id === state.params[g.id]);
    if (!opt) continue;
    coeff *= opt.coeff ?? 1;
    perUnitAdd += opt.perUnitAdd ?? 0;
    flatAdd += opt.add ?? 0;
    if (opt.price != null) priceOverride = opt.price;
    // Ступени срочности (напр. «экспресс 4 ч») сокращают срок готовности.
    if (opt.daysOverride != null)
      daysOverride = daysOverride == null ? opt.daysOverride : Math.min(daysOverride, opt.daysOverride);
  }
  return { coeff, perUnitAdd, flatAdd, priceOverride, daysOverride };
}

function applyUpsells(config: CalcConfig, state: CalcState, qty: number, subtotal: number) {
  let coeff = 1;
  let add = 0;
  for (const id of state.upsells) {
    const u = config.upsells?.find((x) => x.id === id);
    if (!u) continue;
    if (u.coeff) coeff *= u.coeff;
    if (u.add) add += u.add;
    if (u.perUnitAdd) add += u.perUnitAdd * qty;
  }
  return subtotal * coeff + add;
}

function readyDateLabel(days: number): string {
  if (days <= 0) return 'сегодня до 18:00';
  const d = new Date();
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) added++; // только рабочие дни
  }
  return new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' }).format(d);
}

export function calculate(config: CalcConfig, state: CalcState): CalcResult {
  // Мультиколичество: тираж = сумма счётчиков (мультиформат/мультиразмер, ТЗ п.3.1/8.1).
  const multiQty = multiTotal(config, state.params);
  const multiGroup = config.groups.find((g) => g.type === 'multi-qty');
  const qty =
    multiGroup != null
      ? Math.max(1, multiQty)
      : Math.max(minQtyFor(config, state.params), state.qty, 1);
  const { coeff, perUnitAdd, flatAdd, priceOverride, daysOverride } = optionCoeffs(config, state);

  // Срочность: правило и коэффициент индивидуальны для услуги (ТЗ).
  const express = state.express && expressAvailability(config, { params: state.params, qty }).ok;
  const expressCoeff = express && config.express ? config.express.coeff : 1;

  let subtotal: number;
  let savingsPct = 0;

  if (multiGroup) {
    // Каждая строка: количество × (фикс-цена опции ИЛИ пороговая цена от общего
    // тиража × коэффициент опции); итог в API — разбивка по форматам.
    const counts = parseCounts(state.params[multiGroup.id]);
    const tiers = config.qtyTiers ?? [{ qty: 1, perUnit: 10 }];
    const per = tierPerUnit(tiers, qty);
    let sum = 0;
    for (const opt of multiGroup.options ?? []) {
      const cnt = counts[opt.id] ?? 0;
      if (!cnt) continue;
      sum += cnt * (opt.price != null ? opt.price : per * (opt.coeff ?? 1));
    }
    subtotal = sum * coeff;
    savingsPct = Math.round((1 - per / tiers[0].perUnit) * 100);
  } else if (config.pricing === 'area') {
    const w = Number(state.params.width) || 1;
    const h = Number(state.params.height) || 1;
    const area = w * h;
    const perimeter = (w + h) * 2;
    // Люверсы: каждые 50 см (with) или пользовательский шаг (custom) — ТЗ п.4.1.
    const lugMode = String(state.params.lugs ?? 'none');
    const lugStepM =
      lugMode === 'custom' ? Math.max(0.2, (Number(state.params.lugstep) || 50) / 100) : 0.5;
    const lugs = lugMode !== 'none' ? Math.ceil(perimeter / lugStepM) * 15 : 0;
    subtotal = (area * (config.pricePerSqm ?? 450) * coeff + lugs) * qty;
  } else if (priceOverride != null) {
    // Фиксированная цена за единицу (селектор, напр. фото на документы).
    subtotal = (priceOverride + perUnitAdd) * qty * coeff;
  } else {
    const tiers = config.qtyTiers ?? [{ qty: 1, perUnit: config.pricePerSqm ?? 10 }];
    const per = tierPerUnit(tiers, qty);
    subtotal = (per + perUnitAdd) * qty * coeff;
    savingsPct = Math.round((1 - per / tiers[0].perUnit) * 100);
  }

  // Скидка от количества (для селекторов с фикс-ценой).
  if (config.qtyDiscount) {
    let dc = 1;
    for (const d of config.qtyDiscount) if (qty >= d.from) dc = d.coeff;
    subtotal *= dc;
    if (priceOverride != null) savingsPct = Math.round((1 - dc) * 100);
  }

  subtotal += flatAdd;
  subtotal *= expressCoeff;
  let total = applyUpsells(config, state, qty, subtotal);
  total = Math.round(total / 10) * 10;

  const days = express && config.express ? config.express.days : (daysOverride ?? config.productionDays);

  return {
    ok: true,
    price: total,
    pricePerUnit: Math.round(total / qty),
    priceWithVat: Math.round((total * 1.2) / 10) * 10,
    readyDateLabel: readyDateLabel(days),
    cutoff: express || days <= 0 ? '12:00' : '14:00',
    savingsPct: Math.max(0, savingsPct),
  };
}
