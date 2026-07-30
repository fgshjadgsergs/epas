import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addCartItem, clearCart, getCart, mergeCart, refreshCartItem, removeCartItem } from './cart';

/** Перехватывает fetch и отдаёт пустую корзину. */
function mockFetch() {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        id: 'cart-1',
        status: 'ACTIVE',
        currency: 'RUB',
        cartVersion: 1,
        items: [],
        itemCount: 0,
        totals: {
          itemsSubtotal: { amountMinor: 0, currency: 'RUB' },
          discounts: { amountMinor: 0, currency: 'RUB' },
          total: { amountMinor: 0, currency: 'RUB' },
        },
        canCheckout: false,
      }),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Разбирает тело последнего запроса. */
function lastBody(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const init = fetchMock.mock.calls.at(-1)?.[1] as { body?: string };
  return init?.body ? JSON.parse(init.body) : {};
}

describe('cart API client', () => {
  let fetchMock: ReturnType<typeof mockFetch>;

  beforeEach(() => {
    fetchMock = mockFetch();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('addCartItem отправляет ТОЛЬКО calculationSnapshotId — никакой цены', async () => {
    await addCartItem('snap-42');
    const body = lastBody(fetchMock);
    expect(body).toEqual({ calculationSnapshotId: 'snap-42' });
    // Явная защита от регресса: цена/скидки/контекст не должны попадать в запрос.
    for (const forbidden of [
      'price',
      'unitPrice',
      'lineTotal',
      'total',
      'discount',
      'priceListId',
      'customerContext',
      'b2b',
      'production',
    ]) {
      expect(body).not.toHaveProperty(forbidden);
    }
  });

  it('все методы корзины отправляют cookie анонимной сессии (credentials: include)', async () => {
    await getCart();
    await addCartItem('snap-1');
    await removeCartItem('item-1');
    await clearCart();
    await mergeCart('jwt-token');
    await refreshCartItem('item-1');

    expect(fetchMock).toHaveBeenCalledTimes(6);
    for (const call of fetchMock.mock.calls) {
      expect((call[1] as { credentials?: string }).credentials).toBe('include');
    }
  });

  it('методы используют корректные маршруты и HTTP-глаголы', async () => {
    await getCart();
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toMatch(/\/cart$/);
    expect((fetchMock.mock.calls.at(-1)?.[1] as { method?: string }).method ?? 'GET').toBe('GET');

    await addCartItem('snap-1');
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toMatch(/\/cart\/items$/);
    expect((fetchMock.mock.calls.at(-1)?.[1] as { method: string }).method).toBe('POST');

    await removeCartItem('item-1');
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toMatch(/\/cart\/items\/item-1$/);
    expect((fetchMock.mock.calls.at(-1)?.[1] as { method: string }).method).toBe('DELETE');

    await clearCart();
    expect((fetchMock.mock.calls.at(-1)?.[1] as { method: string }).method).toBe('DELETE');

    await mergeCart('jwt');
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toMatch(/\/cart\/merge$/);

    await refreshCartItem('item-9');
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toMatch(/\/cart\/items\/item-9\/refresh$/);
  });

  it('авторизованный запрос добавляет Bearer-токен', async () => {
    await mergeCart('jwt-token');
    const headers = (fetchMock.mock.calls.at(-1)?.[1] as { headers: Record<string, string> }).headers;
    expect(headers.Authorization).toBe('Bearer jwt-token');
  });

  it('ответ корзины типизирован и содержит серверные totals/canCheckout', async () => {
    const cart = await getCart();
    expect(cart.totals.total.amountMinor).toBe(0);
    expect(cart.canCheckout).toBe(false);
    expect(cart.cartVersion).toBe(1);
  });
});
