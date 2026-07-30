// @vitest-environment jsdom
/**
 * Ключ идемпотентности: стабилен для версии корзины, меняется при её мутации,
 * снимается после успешного заказа.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearIdempotencyKey, idempotencyKeyFor } from './idempotency';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('idempotencyKeyFor', () => {
  beforeEach(() => window.sessionStorage.clear());
  afterEach(() => window.sessionStorage.clear());

  it('возвращает uuid — формат, который принимает @IsUUID() на backend', () => {
    expect(idempotencyKeyFor('cart-1', 3)).toMatch(UUID);
  });

  it('повторный вызов для той же версии корзины даёт ТОТ ЖЕ ключ (retry не создаст второй заказ)', () => {
    const first = idempotencyKeyFor('cart-1', 3);
    expect(idempotencyKeyFor('cart-1', 3)).toBe(first);
    expect(idempotencyKeyFor('cart-1', 3)).toBe(first);
  });

  it('изменение корзины (version+1) даёт новый ключ', () => {
    const before = idempotencyKeyFor('cart-1', 3);
    const after = idempotencyKeyFor('cart-1', 4);
    expect(after).not.toBe(before);
  });

  it('другая корзина — другой ключ', () => {
    expect(idempotencyKeyFor('cart-2', 3)).not.toBe(idempotencyKeyFor('cart-1', 3));
  });

  it('после успешного заказа ключ очищается и следующий заказ получает новый', () => {
    const first = idempotencyKeyFor('cart-1', 3);
    clearIdempotencyKey();
    expect(window.sessionStorage.getItem('kp_checkout_idempotency')).toBeNull();
    expect(idempotencyKeyFor('cart-1', 3)).not.toBe(first);
  });

  it('в sessionStorage не попадают цены и состав заказа', () => {
    idempotencyKeyFor('cart-1', 3);
    const raw = window.sessionStorage.getItem('kp_checkout_idempotency') ?? '';
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual(['cartId', 'cartVersion', 'key']);
  });

  it('повреждённое значение не ломает оформление — выдаётся свежий ключ', () => {
    window.sessionStorage.setItem('kp_checkout_idempotency', '{не json');
    expect(idempotencyKeyFor('cart-1', 3)).toMatch(UUID);
  });
});
