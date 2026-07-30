/**
 * Отображение админ-заказов: подписи статусов, действия перехода, путь к карточке.
 * Статусы совпадают с клиентскими, но действия («Отменить заказ») — админские.
 */
import type { AdminOrderStatus } from '@/lib/api/admin-orders';

export const ADMIN_ORDER_STATUS_LABEL: Record<AdminOrderStatus, string> = {
  NEW: 'Принят',
  CANCELLED: 'Отменён',
};

export const ADMIN_ORDER_STATUS_BADGE: Record<AdminOrderStatus, string> = {
  NEW: 'bg-primary/15 text-primary',
  CANCELLED: 'bg-danger/15 text-danger',
};

/** Подпись действия перехода в целевой статус (для кнопки). */
export const ADMIN_TRANSITION_ACTION: Record<AdminOrderStatus, string> = {
  NEW: 'Вернуть в работу',
  CANCELLED: 'Отменить заказ',
};

export function adminStatusLabel(status: string): string {
  return ADMIN_ORDER_STATUS_LABEL[status as AdminOrderStatus] ?? status;
}

export function adminStatusBadge(status: string): string {
  return ADMIN_ORDER_STATUS_BADGE[status as AdminOrderStatus] ?? 'bg-surface-2 text-muted';
}

export function adminTransitionAction(status: string): string {
  return ADMIN_TRANSITION_ACTION[status as AdminOrderStatus] ?? `Перевести в «${adminStatusLabel(status)}»`;
}

export function adminOrderDetailPath(orderId: string): string {
  return `/admin/orders/${encodeURIComponent(orderId)}/`;
}

/** ISO-дата → «24 июля 2026, 14:05». */
export function formatAdminDate(iso: string): string {
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
