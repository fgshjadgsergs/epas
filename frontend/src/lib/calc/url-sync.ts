import type { CalcConfig, CalcState } from './types';

/**
 * Синхронизация состояния калькулятора с URL (ТЗ «URL-адреса в калькуляторах»).
 * Порядок параметров фиксирован; значения по умолчанию в URL не пишем;
 * b2b и промокод — не шарим.
 */

export function stateToSearch(config: CalcConfig, state: CalcState): string {
  const sp = new URLSearchParams();
  for (const g of config.groups) {
    const v = state.params[g.id];
    if (v === undefined || v === null) continue;
    if (v === g.default) continue; // дефолты не включаем
    sp.set(g.id, String(v));
  }
  if (state.qty !== config.defaultQty) sp.set('qty', String(state.qty));
  if (state.express) sp.set('express', '1');
  // upsells, b2b и промокод в URL не включаются (ТЗ URL калькулятора).
  return sp.toString();
}

export function searchToState(config: CalcConfig, search: string, base: CalcState): CalcState {
  const sp = new URLSearchParams(search);
  const params = { ...base.params };
  for (const g of config.groups) {
    const raw = sp.get(g.id);
    if (raw === null) continue;
    params[g.id] = g.type === 'dimension' ? Number(raw) : raw;
  }
  const qty = sp.get('qty');
  return {
    params,
    qty: qty ? Number(qty) : base.qty,
    express: sp.get('express') === '1',
    upsells: base.upsells,
    b2b: base.b2b,
  };
}

export function buildDefaultState(config: CalcConfig, preset?: Record<string, string | number>): CalcState {
  const params: Record<string, string | number> = {};
  for (const g of config.groups) params[g.id] = g.default;
  return {
    params: { ...params, ...preset },
    qty: config.defaultQty,
    express: false,
    upsells: [],
    b2b: false,
  };
}
