import { OrderStatus } from '@prisma/client';
import { ORDER_STATUS_TRANSITIONS, ORDER_STATUSES, canTransition } from './order-status';

describe('order status transitions', () => {
  it('NEW → CANCELLED разрешён', () => {
    expect(canTransition(OrderStatus.NEW, OrderStatus.CANCELLED)).toBe(true);
  });

  it('обратный переход CANCELLED → NEW запрещён', () => {
    expect(canTransition(OrderStatus.CANCELLED, OrderStatus.NEW)).toBe(false);
  });

  it('переход в тот же статус не считается допустимым', () => {
    expect(canTransition(OrderStatus.NEW, OrderStatus.NEW)).toBe(false);
    expect(canTransition(OrderStatus.CANCELLED, OrderStatus.CANCELLED)).toBe(false);
  });

  it('CANCELLED — терминальный статус (нет исходящих переходов)', () => {
    expect(ORDER_STATUS_TRANSITIONS[OrderStatus.CANCELLED]).toEqual([]);
  });

  it('ORDER_STATUSES содержит все значения enum — валидация не пропустит чужой статус', () => {
    expect(new Set(ORDER_STATUSES)).toEqual(new Set(Object.values(OrderStatus)));
  });
});
