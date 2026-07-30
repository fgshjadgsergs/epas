import type { AdminOrderStatus, AdminOrdersQuery } from '@/lib/api/admin-orders';

/**
 * Фильтры admin-списка ↔ URL search params.
 *
 * В URL хранятся только НЕперсональные фильтры (status, даты, номер заказа,
 * страница) — ссылку можно открыть повторно и поделиться ею. Поиск по телефону
 * и email в URL НЕ попадает: это персональные данные клиента, а URL оседает в
 * истории браузера и access-логах. Контактный поиск живёт только в локальном
 * состоянии формы (см. ContactSearch).
 */
export interface AdminOrdersFilters {
  page: number;
  status: AdminOrderStatus | '';
  from: string;
  to: string;
  orderNumber: string;
}

/** Приватный поиск по контактам — только в памяти формы, не в URL/sessionStorage. */
export interface ContactSearch {
  phone: string;
  email: string;
}

export const ADMIN_ORDERS_PAGE_SIZE = 20;

export const EMPTY_FILTERS: AdminOrdersFilters = {
  page: 1,
  status: '',
  from: '',
  to: '',
  orderNumber: '',
};

export const EMPTY_CONTACT_SEARCH: ContactSearch = { phone: '', email: '' };

/** Параметры URL, которые НИКОГДА не должны попадать в адрес (персональные данные). */
export const PRIVATE_SEARCH_KEYS = ['phone', 'email'] as const;

const STATUSES: AdminOrderStatus[] = ['NEW', 'CANCELLED'];

/** Прочитать фильтры из URLSearchParams (устойчиво к мусору в значениях). */
export function filtersFromParams(params: URLSearchParams): AdminOrdersFilters {
  const rawStatus = params.get('status');
  const status = rawStatus && (STATUSES as string[]).includes(rawStatus) ? (rawStatus as AdminOrderStatus) : '';
  const page = Number.parseInt(params.get('page') ?? '1', 10);

  return {
    page: Number.isFinite(page) && page >= 1 ? page : 1,
    status,
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    orderNumber: params.get('orderNumber')?.trim() ?? '',
  };
}

/** Сериализовать фильтры в query-строку (пустые поля опускаются; без контактов). */
export function filtersToSearch(filters: AdminOrdersFilters): string {
  const params = new URLSearchParams();
  if (filters.page > 1) params.set('page', String(filters.page));
  if (filters.status) params.set('status', filters.status);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.orderNumber) params.set('orderNumber', filters.orderNumber);
  const s = params.toString();
  return s ? `?${s}` : '';
}

/**
 * Преобразовать фильтры и контактный поиск в запрос к API. Контакты приходят
 * отдельным аргументом (из локального состояния), а не из URL-фильтров.
 */
export function filtersToQuery(filters: AdminOrdersFilters, contacts: ContactSearch = EMPTY_CONTACT_SEARCH): AdminOrdersQuery {
  return {
    page: filters.page,
    pageSize: ADMIN_ORDERS_PAGE_SIZE,
    status: filters.status || undefined,
    from: filters.from ? `${filters.from}T00:00:00.000Z` : undefined,
    to: filters.to ? `${filters.to}T23:59:59.999Z` : undefined,
    orderNumber: filters.orderNumber || undefined,
    phone: contacts.phone.trim() || undefined,
    email: contacts.email.trim() || undefined,
  };
}

/** Диапазон дат валиден, если пусто или from <= to (по датам, без времени). */
export function isDateRangeValid(from: string, to: string): boolean {
  if (!from || !to) return true;
  return from <= to;
}
