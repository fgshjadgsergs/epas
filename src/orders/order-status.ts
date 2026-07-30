import { OrderStatus } from '@prisma/client';

/**
 * Карта допустимых переходов статуса заказа.
 *
 * Полный производственный workflow (в работе / готов / выдан / доставка …) в
 * ТЗ не определён, поэтому здесь заложен минимум, который не придётся
 * переделывать: заказ можно только отменить, обратного пути нет. Расширение
 * набора статусов и переходов — после согласования с заказчиком (см. отчёт).
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.NEW]: [OrderStatus.CANCELLED],
  [OrderStatus.CANCELLED]: [],
};

/** Все известные статусы — для валидации входного значения (не любой строки). */
export const ORDER_STATUSES: OrderStatus[] = Object.values(OrderStatus);

/** Допустим ли переход from → to по карте. Переход в тот же статус — не переход. */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Допустимые целевые статусы из текущего. Единственный источник карты переходов
 * для фронта — он не дублирует её у себя, а показывает ровно эти действия.
 * Возвращается копия, чтобы вызывающий не мутировал карту.
 */
export function allowedTransitions(from: OrderStatus): OrderStatus[] {
  return [...(ORDER_STATUS_TRANSITIONS[from] ?? [])];
}
