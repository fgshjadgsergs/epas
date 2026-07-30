// @vitest-environment jsdom
/**
 * «Мои заказы»: список и карточка на данных GET /orders и GET /orders/:id.
 * Названия и суммы читаются из снимков заказа, каталог не запрашивается.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrdersListView } from './orders-list-view';
import { OrderDetailView } from './order-detail-view';
import { ApiError } from '@/lib/api/client';
import type { OrderDto, OrderSummaryDto } from '@/lib/api/orders';

const ordersApi = vi.hoisted(() => ({ createOrder: vi.fn(), getOrders: vi.fn(), getOrder: vi.fn() }));
const auth = vi.hoisted(() => ({ token: 'jwt-token' as string | null }));
const catalogApi = vi.hoisted(() => ({ getService: vi.fn(), getServices: vi.fn() }));

vi.mock('@/lib/api/orders', () => ordersApi);
vi.mock('@/lib/api/services', () => catalogApi);
vi.mock('@/lib/api/auth', () => ({ tokenStorage: { getAccessToken: () => auth.token } }));

const money = (amountMinor: number) => ({ amountMinor, currency: 'RUB' });

function makeSummary(overrides: Partial<OrderSummaryDto> = {}): OrderSummaryDto {
  return {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    orderNumber: 'KP-20260723-004217',
    status: 'NEW',
    pricingMode: 'LIVE',
    total: money(231000),
    itemCount: 2,
    createdAt: '2026-07-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeOrder(overrides: Partial<OrderDto> = {}): OrderDto {
  return {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    orderNumber: 'KP-20260723-004217',
    status: 'NEW',
    currency: 'RUB',
    pricingMode: 'LIVE',
    contactName: 'Иван Петров',
    contactPhone: '+7 900 123-45-67',
    contactEmail: 'ivan@example.com',
    customerComment: 'позвонить до 18:00',
    items: [
      {
        id: 'oi-1',
        serviceSlug: 'listovki',
        title: 'Листовки А5 (снимок на момент заказа)',
        configuration: { format: 'A5', qty: 500 },
        production: { workingDays: 2 },
        quantity: 1,
        unitPrice: money(462),
        lineTotal: money(231000),
      },
    ],
    totals: { itemsSubtotal: money(231000), discounts: money(0), total: money(231000) },
    statusHistory: [
      { fromStatus: null, toStatus: 'NEW', comment: 'Заказ создан', createdAt: '2026-07-23T10:00:00.000Z' },
    ],
    createdAt: '2026-07-23T10:00:00.000Z',
    updatedAt: '2026-07-23T10:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  for (const fn of Object.values(ordersApi)) fn.mockReset();
  for (const fn of Object.values(catalogApi)) fn.mockReset();
  auth.token = 'jwt-token';
});
afterEach(() => cleanup());

describe('OrdersListView', () => {
  it('loading: индикатор до ответа', async () => {
    ordersApi.getOrders.mockImplementation(() => new Promise(() => undefined));
    render(<OrdersListView />);
    expect(await screen.findByRole('status')).toBeTruthy();
  });

  it('показывает номер, дату, статус, сумму, валюту и ссылку на детали', async () => {
    ordersApi.getOrders.mockResolvedValue({ items: [makeSummary()], total: 1, page: 1, pageSize: 10 });
    render(<OrdersListView />);

    expect(await screen.findByText('Заказ KP-20260723-004217')).toBeTruthy();
    expect(screen.getByText(/июля 2026/)).toBeTruthy();
    expect(screen.getByText('Принят')).toBeTruthy();
    expect(screen.getByText('RUB')).toBeTruthy();
    expect(screen.getByText('2 позиции')).toBeTruthy();

    const link = screen.getByRole('link', { name: /Заказ KP-20260723-004217/ });
    expect(link.getAttribute('href')).toContain('/lichnyy-kabinet/moi-zakazy/');
  });

  it('empty: понятное пустое состояние с переходом в каталог', async () => {
    ordersApi.getOrders.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 });
    render(<OrdersListView />);

    expect(await screen.findByText('Заказов пока нет')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Перейти в каталог' })).toBeTruthy();
  });

  it('error: сообщение и повтор запроса', async () => {
    ordersApi.getOrders.mockRejectedValueOnce(new ApiError(500, 'Сервис недоступен'));
    render(<OrdersListView />);
    expect(await screen.findByText('Не удалось загрузить заказы')).toBeTruthy();

    ordersApi.getOrders.mockResolvedValueOnce({ items: [makeSummary()], total: 1, page: 1, pageSize: 10 });
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(await screen.findByText('Заказ KP-20260723-004217')).toBeTruthy();
  });

  it('401: предлагает войти с возвратом в «Мои заказы»', async () => {
    auth.token = null;
    render(<OrdersListView />);

    expect(await screen.findByText('Войдите, чтобы увидеть заказы')).toBeTruthy();
    expect(ordersApi.getOrders).not.toHaveBeenCalled();
  });

  it('пагинация: переход на следующую страницу запрашивает её у backend', async () => {
    ordersApi.getOrders.mockResolvedValue({
      items: [makeSummary()],
      total: 25,
      page: 1,
      pageSize: 10,
    });
    render(<OrdersListView />);
    await screen.findByText('Заказ KP-20260723-004217');

    expect(screen.getByText('Страница 1 из 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Вперёд' }));

    await waitFor(() =>
      expect(ordersApi.getOrders).toHaveBeenCalledWith('jwt-token', { page: 2, pageSize: 10 }),
    );
  });

  it('одна страница — навигация не рисуется', async () => {
    ordersApi.getOrders.mockResolvedValue({ items: [makeSummary()], total: 1, page: 1, pageSize: 10 });
    render(<OrdersListView />);
    await screen.findByText('Заказ KP-20260723-004217');
    expect(screen.queryByRole('button', { name: 'Вперёд' })).toBeNull();
  });

  it('demo-пометка в списке по pricingMode заказа', async () => {
    ordersApi.getOrders.mockResolvedValue({
      items: [makeSummary({ pricingMode: 'DEMO' })],
      total: 1,
      page: 1,
      pageSize: 10,
    });
    render(<OrdersListView />);
    expect(await screen.findByText(/демонстрационному прайсу/)).toBeTruthy();
  });
});

describe('OrderDetailView', () => {
  it('показывает immutable-снимки позиций, а не данные каталога', async () => {
    ordersApi.getOrder.mockResolvedValue(makeOrder());
    render(<OrderDetailView orderId="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" />);

    expect(await screen.findByText('Листовки А5 (снимок на момент заказа)')).toBeTruthy();
    expect(screen.getByText(/format: A5/)).toBeTruthy();
    expect(screen.getByText(/1 шт\./)).toBeTruthy();
    // Каталог для отображения заказа не запрашивается.
    expect(catalogApi.getService).not.toHaveBeenCalled();
    expect(catalogApi.getServices).not.toHaveBeenCalled();
  });

  it('показывает контакты, суммы и историю статусов', async () => {
    ordersApi.getOrder.mockResolvedValue(makeOrder());
    render(<OrderDetailView orderId="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" />);

    expect(await screen.findByText('Иван Петров')).toBeTruthy();
    expect(screen.getByText('+7 900 123-45-67')).toBeTruthy();
    expect(screen.getByText('ivan@example.com')).toBeTruthy();
    expect(screen.getByText('позвонить до 18:00')).toBeTruthy();
    expect(screen.getByText('История статусов')).toBeTruthy();
    expect(screen.getByText('Заказ создан')).toBeTruthy();
  });

  it('чужой заказ (404 от backend) — безопасное «не найден»', async () => {
    ordersApi.getOrder.mockRejectedValue(new ApiError(404, 'Заказ не найден'));
    render(<OrderDetailView orderId="ffffffff-ffff-ffff-ffff-ffffffffffff" />);

    expect(await screen.findByText('Заказ не найден')).toBeTruthy();
    expect(screen.getByText(/принадлежит другому аккаунту/)).toBeTruthy();
  });

  it('некорректный id (400) тоже даёт «не найден» — перебор ничего не подтверждает', async () => {
    ordersApi.getOrder.mockRejectedValue(new ApiError(400, 'Validation failed (uuid is expected)'));
    render(<OrderDetailView orderId="not-a-uuid" />);
    expect(await screen.findByText('Заказ не найден')).toBeTruthy();
  });

  it('401: предлагает войти', async () => {
    auth.token = null;
    render(<OrderDetailView orderId="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" />);
    expect(await screen.findByText('Войдите, чтобы увидеть заказ')).toBeTruthy();
  });

  it('demo-пометка в карточке заказа', async () => {
    ordersApi.getOrder.mockResolvedValue(makeOrder({ pricingMode: 'DEMO' }));
    render(<OrderDetailView orderId="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" />);
    expect(await screen.findByText(/демонстрационному прайсу/)).toBeTruthy();
  });
});
