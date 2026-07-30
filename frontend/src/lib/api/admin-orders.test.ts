import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAdminOrder,
  getAdminOrders,
  queryAdminOrders,
  searchAdminOrders,
  updateAdminOrderStatus,
} from './admin-orders';

function mockFetch(body: unknown = { id: 'o1' }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function lastCall(fetchMock: ReturnType<typeof vi.fn>) {
  const call = fetchMock.mock.calls.at(-1)!;
  return { url: String(call[0]), init: call[1] as { method?: string; body?: string; headers: Record<string, string> } };
}

describe('admin-orders API client', () => {
  let fetchMock: ReturnType<typeof mockFetch>;

  beforeEach(() => {
    fetchMock = mockFetch();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('getAdminOrders передаёт безопасные фильтры в query и НЕ передаёт phone/email', async () => {
    await getAdminOrders('jwt', { page: 2, pageSize: 10, status: 'NEW', orderNumber: 'KP-1', phone: '900', email: 'a@b.co' });
    const { url, init } = lastCall(fetchMock);
    expect(url).toContain('admin/orders');
    expect(url).toContain('page=2');
    expect(url).toContain('status=NEW');
    expect(url).toContain('orderNumber=KP-1');
    // Персональные данные не попадают в query string.
    expect(url).not.toContain('phone');
    expect(url).not.toContain('900');
    expect(url).not.toContain('email');
    expect(url).not.toContain('a@b.co');
    expect(init.method ?? 'GET').toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer jwt');
  });

  it('searchAdminOrders шлёт POST, phone/email только в body, URL без PII', async () => {
    await searchAdminOrders('jwt', { status: 'NEW', phone: '9001234567', email: 'ivan@example.com' });
    const { url, init } = lastCall(fetchMock);
    expect(url).toMatch(/admin\/orders\/search$/);
    expect(init.method).toBe('POST');
    // URL чист от персональных данных.
    expect(url).not.toContain('9001234567');
    expect(url).not.toContain('ivan@example.com');
    expect(url).not.toContain('phone');
    expect(url).not.toContain('email');
    // Контакты — только в теле запроса.
    const body = JSON.parse(init.body!);
    expect(body.phone).toBe('9001234567');
    expect(body.email).toBe('ivan@example.com');
    expect(body.status).toBe('NEW');
  });

  it('queryAdminOrders: без контактов → GET, URL без body', async () => {
    await queryAdminOrders('jwt', { status: 'NEW', orderNumber: 'KP-7' });
    const { url, init } = lastCall(fetchMock);
    expect(url).toMatch(/admin\/orders(\?|$)/);
    expect(url).not.toMatch(/\/search/);
    expect(init.method ?? 'GET').toBe('GET');
    expect(init.body).toBeUndefined();
  });

  it('queryAdminOrders: с телефоном → POST search (body-only)', async () => {
    await queryAdminOrders('jwt', { phone: '900' });
    const { url, init } = lastCall(fetchMock);
    expect(url).toMatch(/admin\/orders\/search$/);
    expect(init.method).toBe('POST');
    expect(url).not.toContain('900');
  });

  it('queryAdminOrders: с email → POST search', async () => {
    await queryAdminOrders('jwt', { email: 'a@b.co' });
    const { url, init } = lastCall(fetchMock);
    expect(url).toMatch(/admin\/orders\/search$/);
    expect(init.method).toBe('POST');
    expect(url).not.toContain('a@b.co');
  });

  it('queryAdminOrders: пустые строки контактов не считаются поиском → GET', async () => {
    await queryAdminOrders('jwt', { phone: '   ', email: '' });
    const { url, init } = lastCall(fetchMock);
    expect(url).not.toMatch(/\/search/);
    expect(init.method ?? 'GET').toBe('GET');
  });

  it('getAdminOrder строит маршрут по id', async () => {
    await getAdminOrder('order-42', 'jwt');
    expect(lastCall(fetchMock).url).toMatch(/admin\/orders\/order-42$/);
  });

  it('updateAdminOrderStatus шлёт PATCH только со статусом и комментарием', async () => {
    await updateAdminOrderStatus('order-1', { status: 'CANCELLED', comment: 'отмена' }, 'jwt');
    const { url, init } = lastCall(fetchMock);
    expect(url).toMatch(/admin\/orders\/order-1\/status$/);
    expect(init.method).toBe('PATCH');
    const body = JSON.parse(init.body!);
    expect(Object.keys(body).sort()).toEqual(['comment', 'status']);
    // actorId/fromStatus/цены/состав клиент не отправляет.
    for (const forbidden of ['actorId', 'fromStatus', 'price', 'items', 'total', 'totals']) {
      expect(body).not.toHaveProperty(forbidden);
    }
  });
});
