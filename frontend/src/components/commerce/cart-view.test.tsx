// @vitest-environment jsdom
/**
 * Страница корзины на серверных данных: состояния загрузки/ошибки/пустой,
 * статусы позиций (STALE/UNAVAILABLE), серверные суммы и canCheckout,
 * удаление и пересчёт, пометка демо-прайса.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CartView } from './cart-view';
import { CartButton } from '@/components/navigation/cart-button';
import { useCart } from '@/lib/cart/store';
import type { CartDto, CartItemDto } from '@/lib/api/cart';

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

const money = (amountMinor: number) => ({ amountMinor, currency: 'RUB' });

function makeItem(overrides: Partial<CartItemDto> = {}): CartItemDto {
  return {
    id: 'item-1',
    serviceSlug: 'listovki',
    title: 'Листовки',
    configuration: { format: 'A5', qty: 500 },
    quantity: 1,
    unitPrice: money(462),
    lineTotal: money(231000),
    production: { workingDays: 2 },
    status: 'VALID',
    pricingMode: 'LIVE',
    calculationSnapshotId: 'snap-1',
    addedAt: '2026-07-21T10:00:00.000Z',
    ...overrides,
  };
}

function makeCart(overrides: Partial<CartDto> = {}): CartDto {
  const items = overrides.items ?? [makeItem()];
  return {
    id: 'cart-1',
    status: 'ACTIVE',
    currency: 'RUB',
    cartVersion: 3,
    items,
    itemCount: items.length,
    totals: {
      itemsSubtotal: money(231000),
      discounts: money(0),
      total: money(231000),
    },
    canCheckout: true,
    pricingMode: 'LIVE',
    ...overrides,
  };
}

describe('CartView (серверная корзина)', () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    useCart.setState({ cart: null, loading: false, error: null, pending: false });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('loading: показывает индикатор до ответа сервера', async () => {
    api.getCart.mockImplementation(() => new Promise(() => undefined));
    render(<CartView />);
    expect(await screen.findByRole('status')).toBeTruthy();
  });

  it('empty: пустая корзина предлагает каталог', async () => {
    api.getCart.mockResolvedValue(makeCart({ items: [], itemCount: 0, canCheckout: false }));
    render(<CartView />);
    expect(await screen.findByText('Корзина пуста')).toBeTruthy();
  });

  it('error + retry: повторная загрузка после ошибки', async () => {
    api.getCart.mockRejectedValueOnce(new Error('нет связи'));
    render(<CartView />);
    expect(await screen.findByText('Не удалось загрузить корзину')).toBeTruthy();

    api.getCart.mockResolvedValueOnce(makeCart());
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(await screen.findByText('Листовки')).toBeTruthy();
  });

  it('loaded: суммы и итог берутся ТОЛЬКО из серверных totals', async () => {
    api.getCart.mockResolvedValue(
      makeCart({
        items: [makeItem(), makeItem({ id: 'item-2', title: 'Баннеры', lineTotal: money(108000) })],
        totals: { itemsSubtotal: money(339000), discounts: money(0), total: money(339000) },
      }),
    );
    render(<CartView />);
    await screen.findByText('Листовки');

    // 339000 копеек = 3 390 ₽ — ровно то, что прислал сервер (клиент не суммирует).
    expect(screen.getByText('Товары (2)')).toBeTruthy();
    const totals = screen.getAllByText((_, el) => (el?.textContent ?? '').replace(/\s/g, '').includes('3390'));
    expect(totals.length).toBeGreaterThan(0);
  });

  it('STALE: предупреждение и кнопка «Пересчитать» вызывает refresh', async () => {
    api.getCart.mockResolvedValue(
      makeCart({ items: [makeItem({ status: 'STALE' })], canCheckout: false }),
    );
    api.refreshCartItem.mockResolvedValue(makeCart());
    render(<CartView />);

    expect(await screen.findByText(/Цена изменилась/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Пересчитать/ }));
    await waitFor(() => expect(api.refreshCartItem).toHaveBeenCalledWith('item-1', null));
  });

  it('UNAVAILABLE: предупреждение, удаление доступно, оформление заблокировано', async () => {
    api.getCart.mockResolvedValue(
      makeCart({ items: [makeItem({ status: 'UNAVAILABLE' })], canCheckout: false }),
    );
    api.removeCartItem.mockResolvedValue(makeCart({ items: [], itemCount: 0, canCheckout: false }));
    render(<CartView />);

    expect(await screen.findByText(/Услуга сейчас недоступна/)).toBeTruthy();
    expect(screen.getByText(/оформление недоступно/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Удалить «Листовки»/ }));
    await waitFor(() => expect(api.removeCartItem).toHaveBeenCalledWith('item-1', null));
  });

  it('canCheckout=true: оформление открыто ссылкой на checkout', async () => {
    api.getCart.mockResolvedValue(makeCart({ canCheckout: true }));
    render(<CartView />);
    const link = await screen.findByRole('link', { name: 'Оформить заказ' });
    expect(link.getAttribute('href')).toMatch(/^\/oformlenie-zakaza\/?$/);
  });

  it('canCheckout=false: оформление заблокировано, ссылки нет', async () => {
    api.getCart.mockResolvedValue(makeCart({ items: [makeItem({ status: 'STALE' })], canCheckout: false }));
    render(<CartView />);
    const button = await screen.findByRole('button', { name: 'Оформить заказ' });
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('link', { name: 'Оформить заказ' })).toBeNull();
  });

  it('demo-пометки нет, когда backend вернул pricingMode=LIVE', async () => {
    api.getCart.mockResolvedValue(makeCart({ pricingMode: 'LIVE' }));
    render(<CartView />);
    await screen.findByText('Листовки');
    expect(screen.queryByText(/демонстрационному прайсу/)).toBeNull();
  });

  it('demo-пометка показывается по pricingMode=DEMO от backend', async () => {
    api.getCart.mockResolvedValue(makeCart({ pricingMode: 'DEMO' }));
    render(<CartView />);
    expect(await screen.findByText(/демонстрационному прайсу/)).toBeTruthy();
  });
});

describe('CartButton (бейдж шапки)', () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    useCart.setState({ cart: null, loading: false, error: null, pending: false });
  });
  afterEach(() => cleanup());

  it('показывает серверный itemCount и грузит корзину один раз', async () => {
    api.getCart.mockResolvedValue(makeCart({ itemCount: 2 }));
    render(<CartButton />);
    expect(await screen.findByText('2')).toBeTruthy();
    expect(api.getCart).toHaveBeenCalledTimes(1);
  });

  it('пустая корзина не рисует бейдж', async () => {
    api.getCart.mockResolvedValue(makeCart({ items: [], itemCount: 0 }));
    render(<CartButton />);
    await waitFor(() => expect(api.getCart).toHaveBeenCalled());
    expect(screen.queryByText('0')).toBeNull();
  });
});
