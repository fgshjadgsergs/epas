import { PRIVATE_SEARCH_KEYS } from './order-filters';

/**
 * Запоминает последнюю строку фильтров списка заказов, чтобы возврат с карточки
 * восстанавливал только безопасные фильтры (status, даты, номер заказа,
 * страница). Персональные параметры (телефон/email) вырезаются перед записью —
 * они не должны попадать ни в URL, ни в sessionStorage.
 */
const KEY = 'kp_admin_orders_search';

/** Убрать персональные ключи из query-строки (defensive: не полагаемся на вызывающего). */
function stripPrivate(search: string): string {
  const query = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(query);
  for (const key of PRIVATE_SEARCH_KEYS) params.delete(key);
  const s = params.toString();
  return s ? `?${s}` : '';
}

export function rememberListSearch(search: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(KEY, stripPrivate(search));
  } catch {
    // приватный режим без storage — не критично
  }
}

/** Путь к списку с восстановленными безопасными фильтрами (или чистый список). */
export function ordersListPathWithFilters(): string {
  const base = '/admin/orders/';
  if (typeof window === 'undefined') return base;
  try {
    const search = stripPrivate(window.sessionStorage.getItem(KEY) ?? '');
    return search ? `${base}${search}` : base;
  } catch {
    return base;
  }
}
