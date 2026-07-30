import { apiFetch } from './client';

/**
 * Клиент заказов. Оформление доступно только авторизованному пользователю.
 *
 * Тело createOrder осознанно содержит ТОЛЬКО контакты и ключ идемпотентности:
 * состав, цены, суммы, снимки и скидки backend берёт из серверной корзины,
 * от клиента они не принимаются.
 */

export interface OrderMoneyDto {
  amountMinor: number;
  currency: string;
}

export interface OrderItemDto {
  id: string;
  serviceSlug: string;
  title: string;
  configuration: Record<string, unknown>;
  production: { workingDays: number };
  quantity: number;
  unitPrice: OrderMoneyDto;
  lineTotal: OrderMoneyDto;
}

export interface OrderStatusEntryDto {
  fromStatus: string | null;
  toStatus: string;
  comment: string | null;
  createdAt: string;
}

export interface OrderDto {
  id: string;
  orderNumber: string;
  status: 'NEW' | 'CANCELLED';
  currency: string;
  pricingMode: 'DEMO' | 'LIVE';
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  customerComment: string | null;
  items: OrderItemDto[];
  totals: {
    itemsSubtotal: OrderMoneyDto;
    discounts: OrderMoneyDto;
    total: OrderMoneyDto;
  };
  statusHistory: OrderStatusEntryDto[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderSummaryDto {
  id: string;
  orderNumber: string;
  status: 'NEW' | 'CANCELLED';
  pricingMode: 'DEMO' | 'LIVE';
  total: OrderMoneyDto;
  itemCount: number;
  createdAt: string;
}

export interface OrderListDto {
  items: OrderSummaryDto[];
  total: number;
  page: number;
  pageSize: number;
}

/** Тело оформления: только контакты + ключ идемпотентности. Без цен и состава. */
export interface CreateOrderBody {
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  customerComment?: string;
  idempotencyKey: string;
}

/**
 * Оформить заказ из активной корзины. Повторный вызов с тем же
 * idempotencyKey возвращает тот же заказ (двойной клик / retry безопасны).
 * Корзина уходит в cookie-сессии, поэтому credentials: 'include'.
 */
export function createOrder(body: CreateOrderBody, token: string): Promise<OrderDto> {
  return apiFetch<OrderDto>('orders', {
    method: 'POST',
    body,
    token,
    credentials: 'include',
  });
}

/** Список своих заказов (createdAt desc, пагинация). */
export function getOrders(
  token: string,
  params: { page?: number; pageSize?: number } = {},
): Promise<OrderListDto> {
  return apiFetch<OrderListDto>('orders', {
    token,
    query: { page: params.page, pageSize: params.pageSize },
    cache: 'no-store',
  });
}

/** Свой заказ по id (чужой — 404). */
export function getOrder(orderId: string, token: string): Promise<OrderDto> {
  return apiFetch<OrderDto>(`orders/${encodeURIComponent(orderId)}`, {
    token,
    cache: 'no-store',
  });
}
