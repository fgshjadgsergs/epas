import { apiFetch } from './client';

/**
 * Typed-клиент административного Orders API. Доступ на backend защищён
 * permissions (orders.read / orders.status.change) — здесь UI /admin ещё нет,
 * только контракт.
 *
 * Клиент НЕ отправляет цены, состав, totals, actorId и fromStatus: список и
 * заказ только читаются, а при смене статуса actorId берётся из backend-сессии.
 */

export type AdminOrderStatus = 'NEW' | 'CANCELLED';

export interface AdminOrderMoneyDto {
  amountMinor: number;
  currency: string;
}

export interface AdminOrderItemDto {
  id: string;
  serviceSlug: string;
  title: string;
  configuration: Record<string, unknown>;
  production: { workingDays: number };
  quantity: number;
  unitPrice: AdminOrderMoneyDto;
  lineTotal: AdminOrderMoneyDto;
}

/** Безопасное представление сотрудника: только отображаемое имя, без id и PII. */
export interface AdminOrderActorDto {
  displayName: string;
}

export interface AdminOrderStatusEntryDto {
  fromStatus: AdminOrderStatus | null;
  toStatus: AdminOrderStatus;
  /** Кто сменил статус (NULL — системное событие). */
  changedBy: AdminOrderActorDto | null;
  comment: string | null;
  createdAt: string;
}

export interface AdminOrderDto {
  id: string;
  orderNumber: string;
  status: AdminOrderStatus;
  currency: string;
  pricingMode: 'DEMO' | 'LIVE';
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  customerComment: string | null;
  items: AdminOrderItemDto[];
  totals: {
    itemsSubtotal: AdminOrderMoneyDto;
    discounts: AdminOrderMoneyDto;
    total: AdminOrderMoneyDto;
  };
  statusHistory: AdminOrderStatusEntryDto[];
  /** Разрешённые переходы из текущего статуса — вычисляет backend. */
  allowedTransitions: AdminOrderStatus[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrderSummaryDto {
  id: string;
  orderNumber: string;
  status: AdminOrderStatus;
  pricingMode: 'DEMO' | 'LIVE';
  contactName: string;
  total: AdminOrderMoneyDto;
  itemCount: number;
  createdAt: string;
}

export interface AdminOrderListDto {
  items: AdminOrderSummaryDto[];
  total: number;
  page: number;
  pageSize: number;
}

/** Полный набор фильтров admin-списка. Сортировка на backend всегда createdAt desc. */
export interface AdminOrdersQuery {
  page?: number;
  pageSize?: number;
  status?: AdminOrderStatus;
  from?: string;
  to?: string;
  orderNumber?: string;
  phone?: string;
  email?: string;
}

/** Есть ли в запросе персональный поиск (телефон/email). */
function hasContactSearch(query: AdminOrdersQuery): boolean {
  return Boolean(query.phone?.trim() || query.email?.trim());
}

/**
 * GET /admin/orders — только безопасные фильтры в query string. Телефон/email
 * сюда НЕ попадают: query string оседает в истории браузера и серверных логах.
 */
export function getAdminOrders(token: string, query: AdminOrdersQuery = {}): Promise<AdminOrderListDto> {
  return apiFetch<AdminOrderListDto>('admin/orders', {
    token,
    query: {
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
      from: query.from,
      to: query.to,
      orderNumber: query.orderNumber,
    },
    cache: 'no-store',
  });
}

/**
 * POST /admin/orders/search — поиск по телефону/email. Персональные данные идут
 * ТОЛЬКО в JSON body, никогда в query string, чтобы не утекать в access/proxy/
 * APM-логи. Безопасные фильтры передаются тем же телом.
 */
export function searchAdminOrders(token: string, query: AdminOrdersQuery = {}): Promise<AdminOrderListDto> {
  return apiFetch<AdminOrderListDto>('admin/orders/search', {
    method: 'POST',
    token,
    body: {
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
      from: query.from,
      to: query.to,
      orderNumber: query.orderNumber,
      phone: query.phone,
      email: query.email,
    },
    cache: 'no-store',
  });
}

/**
 * Единая точка загрузки списка: при поиске по контактам уходит POST search
 * (body-only), иначе — обычный GET. Вызывающему не нужно знать про PII-разделение.
 */
export function queryAdminOrders(token: string, query: AdminOrdersQuery = {}): Promise<AdminOrderListDto> {
  return hasContactSearch(query) ? searchAdminOrders(token, query) : getAdminOrders(token, query);
}

export function getAdminOrder(orderId: string, token: string): Promise<AdminOrderDto> {
  return apiFetch<AdminOrderDto>(`admin/orders/${encodeURIComponent(orderId)}`, {
    token,
    cache: 'no-store',
  });
}

/** Тело смены статуса: только целевой статус и комментарий. actorId — на backend. */
export interface UpdateAdminOrderStatusBody {
  status: AdminOrderStatus;
  comment?: string;
}

export function updateAdminOrderStatus(
  orderId: string,
  body: UpdateAdminOrderStatusBody,
  token: string,
): Promise<AdminOrderDto> {
  return apiFetch<AdminOrderDto>(`admin/orders/${encodeURIComponent(orderId)}/status`, {
    method: 'PATCH',
    body,
    token,
  });
}
