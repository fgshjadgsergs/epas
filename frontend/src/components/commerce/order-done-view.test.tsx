// @vitest-environment jsdom
/**
 * Страница успешного заказа: данные берутся из GET /orders/:id, поэтому
 * переживают перезагрузку и прямое открытие ссылки. Фиктивных номеров нет.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderDoneView } from './order-done-view';
import { ApiError } from '@/lib/api/client';

const ordersApi = vi.hoisted(() => ({ createOrder: vi.fn(), getOrders: vi.fn(), getOrder: vi.fn() }));
const auth = vi.hoisted(() => ({ token: 'jwt-token' as string | null }));
const query = vi.hoisted(() => ({ id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' as string | null }));

vi.mock('@/lib/api/orders', () => ordersApi);
vi.mock('@/lib/api/auth', () => ({ tokenStorage: { getAccessToken: () => auth.token } }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: (key: string) => (key === 'id' ? query.id : null) }),
}));

const money = (amountMinor: number) => ({ amountMinor, currency: 'RUB' });

const order = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
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

beforeEach(() => {
  ordersApi.getOrder.mockReset();
  auth.token = 'jwt-token';
  query.id = order.id;
});
afterEach(() => cleanup());

describe('OrderDoneView', () => {
  it('loading: индикатор до ответа сервера', async () => {
    ordersApi.getOrder.mockImplementation(() => new Promise(() => undefined));
    render(<OrderDoneView />);
    expect(await screen.findByRole('status')).toBeTruthy();
  });

  it('загружает заказ по id из адреса — экран переживает перезагрузку', async () => {
    ordersApi.getOrder.mockResolvedValue(order);
    render(<OrderDoneView />);

    await waitFor(() => expect(ordersApi.getOrder).toHaveBeenCalledWith(order.id, 'jwt-token'));
  });

  it('показывает настоящий номер, статус, дату и итог от backend', async () => {
    ordersApi.getOrder.mockResolvedValue(order);
    render(<OrderDoneView />);

    expect(await screen.findByText(/KP-20260723-004217 оформлен/)).toBeTruthy();
    expect(screen.getByText('Принят')).toBeTruthy();
    expect(screen.getByText(/июля 2026/)).toBeTruthy();
    const totals = screen.getAllByText((_, el) => (el?.textContent ?? '').replace(/\s/g, '').includes('2310'));
    expect(totals.length).toBeGreaterThan(0);
  });

  it('даёт ссылки «Посмотреть заказ» и «Продолжить покупки»', async () => {
    ordersApi.getOrder.mockResolvedValue(order);
    render(<OrderDoneView />);

    const detail = await screen.findByRole('link', { name: /Посмотреть заказ/ });
    expect(detail.getAttribute('href')).toContain(`/lichnyy-kabinet/moi-zakazy/${order.id}`);
    expect(screen.getByRole('link', { name: 'Продолжить покупки' })).toBeTruthy();
  });

  it('demo-пометка показывается при pricingMode=DEMO', async () => {
    ordersApi.getOrder.mockResolvedValue({ ...order, pricingMode: 'DEMO' });
    render(<OrderDoneView />);
    expect(await screen.findByText(/демонстрационному прайсу/)).toBeTruthy();
  });

  it('без id в адресе — «Заказ не найден», запрос не уходит', async () => {
    query.id = null;
    render(<OrderDoneView />);
    expect(await screen.findByText('Заказ не найден')).toBeTruthy();
    expect(ordersApi.getOrder).not.toHaveBeenCalled();
  });

  it('чужой заказ (404) показывается как «не найден», без деталей', async () => {
    ordersApi.getOrder.mockRejectedValue(new ApiError(404, 'Заказ не найден'));
    render(<OrderDoneView />);
    expect(await screen.findByText('Заказ не найден')).toBeTruthy();
  });

  it('без токена предлагает войти', async () => {
    auth.token = null;
    render(<OrderDoneView />);
    expect(await screen.findByText('Войдите, чтобы увидеть заказ')).toBeTruthy();
    expect(ordersApi.getOrder).not.toHaveBeenCalled();
  });
});
