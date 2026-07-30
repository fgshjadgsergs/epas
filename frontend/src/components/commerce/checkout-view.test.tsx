// @vitest-environment jsdom
/**
 * Оформление заказа: авторизация, готовность корзины, валидация контактов,
 * идемпотентность, обработка ошибок и переход на страницу успеха.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckoutView } from './checkout-view';
import { useCart } from '@/lib/cart/store';
import { ApiError } from '@/lib/api/client';
import type { CartDto, CartItemDto } from '@/lib/api/cart';

const cartApi = vi.hoisted(() => ({
  getCart: vi.fn(),
  addCartItem: vi.fn(),
  removeCartItem: vi.fn(),
  clearCart: vi.fn(),
  mergeCart: vi.fn(),
  refreshCartItem: vi.fn(),
}));
const ordersApi = vi.hoisted(() => ({ createOrder: vi.fn(), getOrders: vi.fn(), getOrder: vi.fn() }));
const auth = vi.hoisted(() => ({ token: 'jwt-token' as string | null }));
const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('@/lib/api/cart', () => cartApi);
vi.mock('@/lib/api/orders', () => ordersApi);
vi.mock('@/lib/api/users', () => ({ getCurrentUser: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/api/auth', () => ({
  tokenStorage: { getAccessToken: () => auth.token, setTokens: vi.fn(), clear: vi.fn() },
}));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

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
    cartVersion: 7,
    items,
    itemCount: items.length,
    totals: { itemsSubtotal: money(231000), discounts: money(0), total: money(231000) },
    canCheckout: true,
    pricingMode: 'LIVE',
    ...overrides,
  };
}

const createdOrder = {
  id: '11111111-2222-3333-4444-555555555555',
  orderNumber: 'KP-20260723-004217',
  status: 'NEW' as const,
  currency: 'RUB',
  pricingMode: 'LIVE' as const,
  contactName: 'Иван Петров',
  contactPhone: '+7 900 123-45-67',
  contactEmail: 'ivan@example.com',
  customerComment: null,
  items: [],
  totals: { itemsSubtotal: money(231000), discounts: money(0), total: money(231000) },
  statusHistory: [],
  createdAt: '2026-07-23T10:00:00.000Z',
  updatedAt: '2026-07-23T10:00:00.000Z',
};

/** Заполнить контактную форму валидными значениями. */
function fillContacts() {
  fireEvent.change(screen.getByLabelText('Имя'), { target: { value: 'Иван Петров' } });
  fireEvent.change(screen.getByLabelText('Телефон'), { target: { value: '+7 900 123-45-67' } });
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ivan@example.com' } });
}

const submitButton = () => screen.getByRole('button', { name: /Оформить заказ|Оформляем/ });

async function renderReady(cart: CartDto = makeCart()) {
  cartApi.getCart.mockResolvedValue(cart);
  render(<CheckoutView />);
  await screen.findByLabelText('Имя');
}

beforeEach(() => {
  for (const fn of Object.values(cartApi)) fn.mockReset();
  for (const fn of Object.values(ordersApi)) fn.mockReset();
  router.push.mockReset();
  auth.token = 'jwt-token';
  window.sessionStorage.clear();
  useCart.setState({ cart: null, loading: false, error: null, pending: false });
});

afterEach(() => cleanup());

describe('CheckoutView — доступ и состояния', () => {
  it('loading: до ответа сервера показывается индикатор', async () => {
    cartApi.getCart.mockImplementation(() => new Promise(() => undefined));
    render(<CheckoutView />);
    expect(await screen.findByRole('status')).toBeTruthy();
  });

  it('анонимный пользователь: заказ не создаётся, предлагается вход с возвратом на checkout', async () => {
    auth.token = null;
    render(<CheckoutView />);

    expect(await screen.findByText('Войдите, чтобы оформить заказ')).toBeTruthy();
    const link = screen.getByRole('link', { name: /Войти или зарегистрироваться/ });
    // Возврат на checkout закодирован в ?return= (ui/Button нормализует слеш пути).
    expect(link.getAttribute('href')).toMatch(
      /^\/lichnyy-kabinet\/vhod-registraciya\/?\?return=%2Foformlenie-zakaza%2F$/,
    );
    // Корзина анонимному пользователю не запрашивается, заказ не оформляется.
    expect(ordersApi.createOrder).not.toHaveBeenCalled();
  });

  it('после входа корзина перечитывается принудительно', async () => {
    await renderReady();
    expect(cartApi.getCart).toHaveBeenCalled();
  });

  it('empty: пустая корзина ведёт в каталог, формы нет', async () => {
    cartApi.getCart.mockResolvedValue(makeCart({ items: [], itemCount: 0, canCheckout: false }));
    render(<CheckoutView />);
    expect(await screen.findByText('Корзина пуста')).toBeTruthy();
    expect(screen.queryByLabelText('Имя')).toBeNull();
  });

  it('canCheckout=false: кнопка заблокирована', async () => {
    await renderReady(makeCart({ canCheckout: false }));
    fillContacts();
    expect(submitButton().hasAttribute('disabled')).toBe(true);
  });

  it('STALE: понятное сообщение и предложение вернуться в корзину', async () => {
    await renderReady(makeCart({ items: [makeItem({ status: 'STALE' })], canCheckout: false }));
    expect(screen.getByText(/Цена части позиций изменилась/)).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /корзину/i }).length).toBeGreaterThan(0);
  });

  it('UNAVAILABLE: оформление заблокировано, POST не уходит', async () => {
    await renderReady(makeCart({ items: [makeItem({ status: 'UNAVAILABLE' })], canCheckout: false }));
    fillContacts();
    fireEvent.click(submitButton());
    await waitFor(() => expect(ordersApi.createOrder).not.toHaveBeenCalled());
  });

  it('серверный состав и суммы показываются из корзины', async () => {
    await renderReady();
    expect(screen.getByText('Листовки')).toBeTruthy();
    expect(screen.getByText('Товары (1)')).toBeTruthy();
  });

  it('demo-пометка показывается по pricingMode=DEMO от backend', async () => {
    await renderReady(makeCart({ pricingMode: 'DEMO' }));
    expect(screen.getByText(/демонстрационному прайсу/)).toBeTruthy();
  });
});

describe('CheckoutView — валидация контактов', () => {
  it('пустая форма: POST не уходит, фокус уводится на первое поле с ошибкой', async () => {
    await renderReady();
    fireEvent.click(submitButton());

    expect(await screen.findByText(/Укажите имя/)).toBeTruthy();
    expect(ordersApi.createOrder).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByLabelText('Имя'));
  });

  it('некорректный телефон помечает поле и не отправляет заказ', async () => {
    await renderReady();
    fillContacts();
    fireEvent.change(screen.getByLabelText('Телефон'), { target: { value: 'позвоните мне' } });
    fireEvent.click(submitButton());

    expect(await screen.findByText(/Телефон может содержать/)).toBeTruthy();
    expect(screen.getByLabelText('Телефон').getAttribute('aria-invalid')).toBe('true');
    expect(ordersApi.createOrder).not.toHaveBeenCalled();
  });
});

describe('CheckoutView — создание заказа', () => {
  it('в запрос уходят ТОЛЬКО контакты и idempotencyKey', async () => {
    ordersApi.createOrder.mockResolvedValue(createdOrder);
    await renderReady();
    fillContacts();
    fireEvent.click(submitButton());

    await waitFor(() => expect(ordersApi.createOrder).toHaveBeenCalled());
    const [body, token] = ordersApi.createOrder.mock.calls[0];
    expect(Object.keys(body).sort()).toEqual([
      'contactEmail',
      'contactName',
      'contactPhone',
      'idempotencyKey',
    ]);
    for (const forbidden of ['items', 'price', 'prices', 'total', 'totals', 'discounts', 'snapshotIds', 'pricingMode']) {
      expect(body).not.toHaveProperty(forbidden);
    }
    expect(token).toBe('jwt-token');
  });

  it('комментарий передаётся, только если заполнен', async () => {
    ordersApi.createOrder.mockResolvedValue(createdOrder);
    await renderReady();
    fillContacts();
    fireEvent.change(screen.getByLabelText(/Комментарий/), { target: { value: 'до 18:00' } });
    fireEvent.click(submitButton());

    await waitFor(() => expect(ordersApi.createOrder).toHaveBeenCalled());
    expect(ordersApi.createOrder.mock.calls[0][0].customerComment).toBe('до 18:00');
  });

  it('перед отправкой корзина перечитывается — заказ идёт по актуальному состоянию', async () => {
    ordersApi.createOrder.mockResolvedValue(createdOrder);
    await renderReady();
    const beforeSubmit = cartApi.getCart.mock.calls.length;
    fillContacts();
    fireEvent.click(submitButton());

    await waitFor(() => expect(ordersApi.createOrder).toHaveBeenCalled());
    expect(cartApi.getCart.mock.calls.length).toBeGreaterThan(beforeSubmit);
  });

  it('двойной клик отправляет максимум один запрос', async () => {
    let release: (value: unknown) => void = () => undefined;
    ordersApi.createOrder.mockImplementation(() => new Promise((resolve) => (release = resolve)));
    await renderReady();
    fillContacts();

    const button = submitButton();
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(ordersApi.createOrder).toHaveBeenCalledTimes(1));
    await act(async () => {
      release(createdOrder);
    });
  });

  it('кнопка блокируется на время запроса', async () => {
    ordersApi.createOrder.mockImplementation(() => new Promise(() => undefined));
    await renderReady();
    fillContacts();
    fireEvent.click(submitButton());

    await waitFor(() => expect(screen.getByRole('button', { name: 'Оформляем…' })).toBeTruthy());
    expect(submitButton().hasAttribute('disabled')).toBe(true);
  });

  it('успех: корзина обновляется, бейдж обнуляется, переход на страницу успеха с настоящим номером', async () => {
    const full = makeCart();
    const emptied = makeCart({ id: 'cart-2', items: [], itemCount: 0, canCheckout: false, cartVersion: 0 });
    cartApi.getCart.mockResolvedValueOnce(full).mockResolvedValueOnce(full).mockResolvedValue(emptied);
    ordersApi.createOrder.mockResolvedValue(createdOrder);

    render(<CheckoutView />);
    await screen.findByLabelText('Имя');
    fillContacts();
    fireEvent.click(submitButton());

    await waitFor(() => expect(router.push).toHaveBeenCalled());
    // Номер и id берутся из ответа backend, а не выдумываются на клиенте.
    expect(router.push).toHaveBeenCalledWith(
      `/oformlenie-zakaza/zakaz-oformlen/?id=${createdOrder.id}`,
    );
    // Серверная корзина перечитана и пуста → бейдж в шапке обнулится.
    await waitFor(() => expect(useCart.getState().cart?.itemCount).toBe(0));
    // Ключ идемпотентности снят: следующий заказ получит новый.
    expect(window.sessionStorage.getItem('kp_checkout_idempotency')).toBeNull();
  });
});

describe('CheckoutView — идемпотентность и ошибки', () => {
  it('retry после сетевой ошибки использует ТОТ ЖЕ idempotencyKey', async () => {
    ordersApi.createOrder
      .mockRejectedValueOnce(new ApiError(0, 'Не удалось связаться с сервером'))
      .mockResolvedValueOnce(createdOrder);

    await renderReady();
    fillContacts();

    fireEvent.click(submitButton());
    expect(await screen.findByText(/Нет связи с сервером/)).toBeTruthy();

    fireEvent.click(submitButton());
    await waitFor(() => expect(ordersApi.createOrder).toHaveBeenCalledTimes(2));

    const first = ordersApi.createOrder.mock.calls[0][0].idempotencyKey;
    const second = ordersApi.createOrder.mock.calls[1][0].idempotencyKey;
    expect(second).toBe(first);
  });

  it('изменение корзины (новая version) даёт новый idempotencyKey', async () => {
    const v7 = makeCart({ cartVersion: 7 });
    const v8 = makeCart({ cartVersion: 8 });
    cartApi.getCart.mockResolvedValueOnce(v7).mockResolvedValueOnce(v7).mockResolvedValue(v8);
    ordersApi.createOrder
      .mockRejectedValueOnce(new ApiError(0, 'нет сети'))
      .mockResolvedValueOnce(createdOrder);

    render(<CheckoutView />);
    await screen.findByLabelText('Имя');
    fillContacts();

    fireEvent.click(submitButton());
    await waitFor(() => expect(ordersApi.createOrder).toHaveBeenCalledTimes(1));

    fireEvent.click(submitButton());
    await waitFor(() => expect(ordersApi.createOrder).toHaveBeenCalledTimes(2));

    expect(ordersApi.createOrder.mock.calls[1][0].idempotencyKey).not.toBe(
      ordersApi.createOrder.mock.calls[0][0].idempotencyKey,
    );
  });

  it('400: показываются ошибки полей от backend, форма не очищается', async () => {
    ordersApi.createOrder.mockRejectedValue(new ApiError(400, 'Ошибка', ['Некорректный email']));
    await renderReady();
    fillContacts();
    fireEvent.click(submitButton());

    expect(await screen.findByText('Некорректный email')).toBeTruthy();
    expect((screen.getByLabelText('Имя') as HTMLInputElement).value).toBe('Иван Петров');
  });

  it('401: предлагается войти заново, контакты сохраняются, успех не показывается', async () => {
    ordersApi.createOrder.mockRejectedValue(new ApiError(401, 'Unauthorized'));
    await renderReady();
    fillContacts();
    fireEvent.click(submitButton());

    expect(await screen.findByText(/Сессия истекла/)).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('409: корзина перечитывается, контакты остаются, ложного успеха нет', async () => {
    ordersApi.createOrder.mockRejectedValue(new ApiError(409, 'Корзина изменилась'));
    await renderReady();
    fillContacts();
    const before = cartApi.getCart.mock.calls.length;
    fireEvent.click(submitButton());

    expect(await screen.findByText('Корзина изменилась')).toBeTruthy();
    expect((screen.getByLabelText('Телефон') as HTMLInputElement).value).toBe('+7 900 123-45-67');
    expect(router.push).not.toHaveBeenCalled();
    await waitFor(() => expect(cartApi.getCart.mock.calls.length).toBeGreaterThan(before + 1));
  });

  it('422 (позиция устарела): сообщение backend и ссылка в корзину', async () => {
    ordersApi.createOrder.mockRejectedValue(
      new ApiError(422, 'Цена позиции изменилась — обновите корзину'),
    );
    await renderReady();
    fillContacts();
    fireEvent.click(submitButton());

    expect(await screen.findByText(/Цена позиции изменилась/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Открыть корзину' })).toBeTruthy();
  });

  it('неизвестная серверная ошибка не роняет экран', async () => {
    ordersApi.createOrder.mockRejectedValue(new ApiError(500, 'Internal error'));
    await renderReady();
    fillContacts();
    fireEvent.click(submitButton());

    expect(await screen.findByText('Internal error')).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('после ошибки кнопка снова активна — можно повторить', async () => {
    ordersApi.createOrder.mockRejectedValue(new ApiError(0, 'нет сети'));
    await renderReady();
    fillContacts();
    fireEvent.click(submitButton());

    await screen.findByText(/Нет связи с сервером/);
    await waitFor(() => expect(submitButton().hasAttribute('disabled')).toBe(false));
  });
});
