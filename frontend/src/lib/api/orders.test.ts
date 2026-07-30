import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOrder, getOrder, getOrders } from './orders';

function mockFetch(body: unknown = { id: 'order-1', orderNumber: 'KP-20260723-000001' }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function lastInit(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.at(-1)?.[1] as { method?: string; body?: string; headers: Record<string, string> };
}

describe('orders API client', () => {
  let fetchMock: ReturnType<typeof mockFetch>;

  beforeEach(() => {
    fetchMock = mockFetch();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('createOrder шлёт ТОЛЬКО контакты и idempotencyKey — без цен и состава', async () => {
    await createOrder(
      {
        contactName: 'Иван',
        contactPhone: '+79001234567',
        contactEmail: 'ivan@example.com',
        customerComment: 'коммент',
        idempotencyKey: 'key-1',
      },
      'jwt-token',
    );
    const body = JSON.parse(lastInit(fetchMock).body!);
    expect(Object.keys(body).sort()).toEqual([
      'contactEmail',
      'contactName',
      'contactPhone',
      'customerComment',
      'idempotencyKey',
    ]);
    // Защита от регресса: запрещённые поля не должны попадать в запрос.
    for (const forbidden of ['items', 'prices', 'price', 'total', 'snapshotIds', 'discounts', 'customerContext']) {
      expect(body).not.toHaveProperty(forbidden);
    }
  });

  it('createOrder использует POST, Bearer-токен и cookie-сессию', async () => {
    await createOrder(
      { contactName: 'И', contactPhone: '+7', contactEmail: 'a@b.co', idempotencyKey: 'k' },
      'jwt-token',
    );
    const init = lastInit(fetchMock);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer jwt-token');
    expect((init as { credentials?: string }).credentials).toBe('include');
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toMatch(/\/orders$/);
  });

  it('getOrders передаёт пагинацию и токен', async () => {
    mockFetch({ items: [], total: 0, page: 2, pageSize: 10 });
    await getOrders('jwt-token', { page: 2, pageSize: 10 });
    const url = String((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0]);
    expect(url).toContain('page=2');
    expect(url).toContain('pageSize=10');
  });

  it('getOrder строит маршрут по id и шлёт токен', async () => {
    await getOrder('order-42', 'jwt-token');
    const url = String(fetchMock.mock.calls.at(-1)?.[0]);
    expect(url).toMatch(/\/orders\/order-42$/);
    expect(lastInit(fetchMock).headers.Authorization).toBe('Bearer jwt-token');
  });

  it('типы ответа: заказ содержит orderNumber и totals от сервера', async () => {
    mockFetch({
      id: 'o1',
      orderNumber: 'KP-20260723-004217',
      status: 'NEW',
      totals: { total: { amountMinor: 231000, currency: 'RUB' } },
    });
    const order = await createOrder(
      { contactName: 'И', contactPhone: '+7', contactEmail: 'a@b.co', idempotencyKey: 'k' },
      't',
    );
    expect(order.orderNumber).toBe('KP-20260723-004217');
    expect(order.totals.total.amountMinor).toBe(231000);
  });
});
