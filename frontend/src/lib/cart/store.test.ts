import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCart } from './store';
import type { CartDto } from '@/lib/api/cart';

const api = vi.hoisted(() => ({
  getCart: vi.fn(),
  addCartItem: vi.fn(),
  removeCartItem: vi.fn(),
  clearCart: vi.fn(),
  mergeCart: vi.fn(),
  refreshCartItem: vi.fn(),
}));
vi.mock('@/lib/api/cart', () => api);
vi.mock('@/lib/api/auth', () => ({ tokenStorage: { getAccessToken: () => null } }));

function makeCart(overrides: Partial<CartDto> = {}): CartDto {
  return {
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
    pricingMode: 'LIVE',
    ...overrides,
  };
}

describe('cart store (кэш серверной корзины)', () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    useCart.setState({ cart: null, loading: false, error: null, pending: false });
  });
  afterEach(() => vi.clearAllMocks());

  it('initial: корзина не загружена', () => {
    const s = useCart.getState();
    expect(s.cart).toBeNull();
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('loadCart кладёт ответ сервера и не повторяет запрос при готовых данных', async () => {
    api.getCart.mockResolvedValue(makeCart({ itemCount: 2 }));
    await useCart.getState().loadCart();
    expect(useCart.getState().cart?.itemCount).toBe(2);

    await useCart.getState().loadCart();
    expect(api.getCart).toHaveBeenCalledTimes(1); // без force повторного GET нет

    await useCart.getState().loadCart({ force: true });
    expect(api.getCart).toHaveBeenCalledTimes(2);
  });

  it('ошибка загрузки попадает в error и снимает loading', async () => {
    api.getCart.mockRejectedValue(new Error('boom'));
    await useCart.getState().loadCart();
    const s = useCart.getState();
    expect(s.cart).toBeNull();
    expect(s.loading).toBe(false);
    expect(s.error).toBeTruthy();
  });

  it('addItem передаёт только snapshotId и заменяет состояние ответом сервера', async () => {
    api.addCartItem.mockResolvedValue(makeCart({ itemCount: 1, canCheckout: true }));
    await useCart.getState().addItem('snap-1');

    expect(api.addCartItem).toHaveBeenCalledTimes(1);
    expect(api.addCartItem.mock.calls[0][0]).toBe('snap-1');
    expect(useCart.getState().cart?.itemCount).toBe(1);
    expect(useCart.getState().cart?.canCheckout).toBe(true);
  });

  it('двойной клик по «в корзину» не отправляет второй запрос', async () => {
    let resolve!: (c: CartDto) => void;
    api.addCartItem.mockImplementation(() => new Promise<CartDto>((r) => (resolve = r)));

    const first = useCart.getState().addItem('snap-1');
    const second = useCart.getState().addItem('snap-1'); // pending — игнорируется
    resolve(makeCart({ itemCount: 1 }));
    await Promise.all([first, second]);

    expect(api.addCartItem).toHaveBeenCalledTimes(1);
  });

  it('addItem пробрасывает ошибку и не создаёт локальную позицию', async () => {
    api.addCartItem.mockRejectedValue(new Error('нет связи'));
    await expect(useCart.getState().addItem('snap-1')).rejects.toThrow();
    expect(useCart.getState().cart).toBeNull();
    expect(useCart.getState().error).toBeTruthy();
    expect(useCart.getState().pending).toBe(false);
  });

  it('remove/clear/refresh берут состояние из ответа сервера', async () => {
    api.removeCartItem.mockResolvedValue(makeCart({ itemCount: 1 }));
    await useCart.getState().removeItem('item-1');
    expect(useCart.getState().cart?.itemCount).toBe(1);

    api.clearCart.mockResolvedValue(makeCart({ itemCount: 0 }));
    await useCart.getState().clearCart();
    expect(useCart.getState().cart?.itemCount).toBe(0);

    api.refreshCartItem.mockResolvedValue(makeCart({ itemCount: 1, canCheckout: true }));
    await useCart.getState().refreshItem('item-1');
    expect(useCart.getState().cart?.canCheckout).toBe(true);
  });

  it('mergeCart без токена не обращается к API', async () => {
    await useCart.getState().mergeCart();
    expect(api.mergeCart).not.toHaveBeenCalled();
  });

  it('store не хранит локальных позиций и не считает суммы сам', () => {
    const state = useCart.getState() as unknown as Record<string, unknown>;
    expect(state.items).toBeUndefined();
    expect(state.promo).toBeUndefined();
    expect(state.setQty).toBeUndefined();
  });
});
