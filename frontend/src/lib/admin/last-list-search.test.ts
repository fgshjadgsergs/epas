// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ordersListPathWithFilters, rememberListSearch } from './last-list-search';

const KEY = 'kp_admin_orders_search';

describe('last-list-search', () => {
  beforeEach(() => window.sessionStorage.clear());
  afterEach(() => window.sessionStorage.clear());

  it('сохраняет безопасные фильтры', () => {
    rememberListSearch('?status=NEW&page=2&orderNumber=KP-1');
    expect(window.sessionStorage.getItem(KEY)).toBe('?status=NEW&page=2&orderNumber=KP-1');
  });

  it('вырезает phone/email перед записью в sessionStorage', () => {
    rememberListSearch('?status=NEW&phone=9001234567&email=ivan@example.com');
    const stored = window.sessionStorage.getItem(KEY) ?? '';
    expect(stored).not.toContain('phone');
    expect(stored).not.toContain('email');
    expect(stored).not.toContain('9001234567');
    expect(stored).not.toContain('ivan@example.com');
    expect(stored).toContain('status=NEW');
  });

  it('возврат восстанавливает только безопасные фильтры (без контактов)', () => {
    // Даже если в storage как-то попали контакты — путь их не восстановит.
    window.sessionStorage.setItem(KEY, '?status=NEW&phone=900&email=a@b.co');
    const path = ordersListPathWithFilters();
    expect(path).not.toContain('phone');
    expect(path).not.toContain('email');
    expect(path).toContain('status=NEW');
  });

  it('пустые фильтры → чистый путь списка', () => {
    rememberListSearch('');
    expect(ordersListPathWithFilters()).toBe('/admin/orders/');
  });
});
