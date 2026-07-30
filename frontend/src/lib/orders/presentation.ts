/**
 * Отображение заказа: подписи статусов, стили бейджей, формат даты.
 * Общий модуль для страницы успеха, списка заказов и карточки заказа.
 */
import type { OrderDto } from '@/lib/api/orders';

type OrderStatus = OrderDto['status'];

/** Набор статусов задан backend (enum OrderStatus): NEW и CANCELLED. */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  NEW: 'Принят',
  CANCELLED: 'Отменён',
};

export const ORDER_STATUS_BADGE: Record<OrderStatus, string> = {
  NEW: 'bg-primary/15 text-primary',
  CANCELLED: 'bg-danger/15 text-danger',
};

/** Неизвестный статус (backend добавит новые) показываем как есть, без падения. */
export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABEL[status as OrderStatus] ?? status;
}

export function orderStatusBadge(status: string): string {
  return ORDER_STATUS_BADGE[status as OrderStatus] ?? 'bg-surface-2 text-muted';
}

/** ISO-дата от backend → «23 июля 2026, 14:05». */
export function formatOrderDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Ссылка на карточку заказа. Идентификатор — uuid, не порядковый номер. */
export function orderDetailPath(orderId: string): string {
  return `/lichnyy-kabinet/moi-zakazy/${encodeURIComponent(orderId)}/`;
}
