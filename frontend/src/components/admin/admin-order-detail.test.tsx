// @vitest-environment jsdom
/**
 * Карточка заказа админки: loading/404/403, immutable-снимки, контакты и totals,
 * allowedTransitions с backend, отмена NEW, double-click, 409 с перезагрузкой,
 * безопасный показ сотрудника (без сырого UUID).
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminOrderDetail } from './admin-order-detail';
import { ApiError } from '@/lib/api/client';
import type { AdminOrderDto } from '@/lib/api/admin-orders';

const api = vi.hoisted(() => ({ getAdminOrder: vi.fn(), updateAdminOrderStatus: vi.fn(), getAdminOrders: vi.fn() }));
const auth = vi.hoisted(() => ({ token: 'jwt' as string | null }));
const catalog = vi.hoisted(() => ({ getService: vi.fn(), getServices: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('@/lib/api/admin-orders', () => api);
vi.mock('@/lib/api/services', () => catalog);
vi.mock('@/lib/api/auth', () => ({ tokenStorage: { getAccessToken: () => auth.token } }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const money = (amountMinor: number) => ({ amountMinor, currency: 'RUB' });

function makeOrder(overrides: Partial<AdminOrderDto> = {}): AdminOrderDto {
  return {
    id: 'o-1',
    orderNumber: 'KP-20260724-000001',
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
        serviceSlug: 'vizitki',
        title: 'Визитки (снимок на момент заказа)',
        configuration: { format: '90x50', qty: 100 },
        production: { workingDays: 2 },
        quantity: 1,
        unitPrice: money(162000),
        lineTotal: money(162000),
      },
    ],
    totals: { itemsSubtotal: money(162000), discounts: money(0), total: money(162000) },
    statusHistory: [
      { fromStatus: null, toStatus: 'NEW', changedBy: null, comment: null, createdAt: '2026-07-24T10:00:00.000Z' },
    ],
    allowedTransitions: ['CANCELLED'],
    createdAt: '2026-07-24T10:00:00.000Z',
    updatedAt: '2026-07-24T10:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  for (const fn of Object.values(catalog)) fn.mockReset();
  auth.token = 'jwt';
  router.push.mockReset();
});
afterEach(() => cleanup());

describe('AdminOrderDetail', () => {
  it('404: безопасное «Заказ не найден»', async () => {
    api.getAdminOrder.mockRejectedValue(new ApiError(404, 'нет'));
    render(<AdminOrderDetail orderId="o-x" />);
    expect(await screen.findByText('Заказ не найден')).toBeTruthy();
  });

  it('403: отдельный экран «Нет доступа» (не путаем с 404)', async () => {
    api.getAdminOrder.mockRejectedValue(new ApiError(403, 'forbidden'));
    render(<AdminOrderDetail orderId="o-1" />);
    expect(await screen.findByText('Нет доступа')).toBeTruthy();
  });

  it('показывает immutable-снимки позиций, каталог не запрашивается', async () => {
    api.getAdminOrder.mockResolvedValue(makeOrder());
    render(<AdminOrderDetail orderId="o-1" />);
    expect(await screen.findByText('Визитки (снимок на момент заказа)')).toBeTruthy();
    expect(screen.getByText(/format: 90x50/)).toBeTruthy();
    expect(catalog.getService).not.toHaveBeenCalled();
    expect(catalog.getServices).not.toHaveBeenCalled();
  });

  it('показывает контакты (кликабельные) и server totals', async () => {
    api.getAdminOrder.mockResolvedValue(makeOrder());
    render(<AdminOrderDetail orderId="o-1" />);
    await screen.findByText('Визитки (снимок на момент заказа)');
    expect(screen.getByRole('link', { name: '+7 900 123-45-67' }).getAttribute('href')).toBe('tel:+79001234567');
    expect(screen.getByRole('link', { name: 'ivan@example.com' }).getAttribute('href')).toBe('mailto:ivan@example.com');
    expect(screen.getByText('позвонить до 18:00')).toBeTruthy();
  });

  it('кнопки перехода строятся из allowedTransitions backend', async () => {
    api.getAdminOrder.mockResolvedValue(makeOrder({ allowedTransitions: ['CANCELLED'] }));
    render(<AdminOrderDetail orderId="o-1" />);
    expect(await screen.findByRole('button', { name: 'Отменить заказ' })).toBeTruthy();
  });

  it('у CANCELLED нет кнопок перехода (allowedTransitions пуст)', async () => {
    api.getAdminOrder.mockResolvedValue(makeOrder({ status: 'CANCELLED', allowedTransitions: [] }));
    render(<AdminOrderDetail orderId="o-1" />);
    await screen.findByText(/Действий со статусом нет/);
    expect(screen.queryByRole('button', { name: 'Отменить заказ' })).toBeNull();
  });

  it('отмена NEW: подтверждение → PATCH → перезагрузка заказа', async () => {
    api.getAdminOrder
      .mockResolvedValueOnce(makeOrder())
      .mockResolvedValue(
        makeOrder({
          status: 'CANCELLED',
          allowedTransitions: [],
          statusHistory: [
            { fromStatus: null, toStatus: 'NEW', changedBy: null, comment: null, createdAt: '2026-07-24T10:00:00.000Z' },
            {
              fromStatus: 'NEW',
              toStatus: 'CANCELLED',
              changedBy: { displayName: 'Мария М.' },
              comment: 'клиент отменил',
              createdAt: '2026-07-24T11:00:00.000Z',
            },
          ],
        }),
      );
    api.updateAdminOrderStatus.mockResolvedValue(makeOrder({ status: 'CANCELLED' }));

    render(<AdminOrderDetail orderId="o-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Отменить заказ' }));
    fireEvent.click(screen.getByRole('button', { name: /Подтвердить: Отменить заказ/ }));

    await waitFor(() => expect(api.updateAdminOrderStatus).toHaveBeenCalledWith('o-1', { status: 'CANCELLED' }, 'jwt'));
    // Заказ перечитан → история и статус обновились.
    await waitFor(() => expect(screen.getByText('Мария М.', { exact: false })).toBeTruthy());
  });

  it('double click подтверждения → максимум один PATCH', async () => {
    let release: (v: unknown) => void = () => undefined;
    api.getAdminOrder.mockResolvedValue(makeOrder());
    api.updateAdminOrderStatus.mockImplementation(() => new Promise((r) => (release = r)));

    render(<AdminOrderDetail orderId="o-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Отменить заказ' }));
    const confirm = screen.getByRole('button', { name: /Подтвердить/ });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() => expect(api.updateAdminOrderStatus).toHaveBeenCalledTimes(1));
    await act(async () => release(makeOrder({ status: 'CANCELLED' })));
  });

  it('409: показывает сообщение и перечитывает заказ с актуальным статусом', async () => {
    api.getAdminOrder
      .mockResolvedValueOnce(makeOrder())
      .mockResolvedValue(makeOrder({ status: 'CANCELLED', allowedTransitions: [] }));
    api.updateAdminOrderStatus.mockRejectedValue(new ApiError(409, 'Статус заказа уже изменился'));

    render(<AdminOrderDetail orderId="o-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Отменить заказ' }));
    fireEvent.click(screen.getByRole('button', { name: /Подтвердить/ }));

    expect(await screen.findByText(/Статус заказа уже изменился/)).toBeTruthy();
    // Перечитан → повторный getAdminOrder.
    await waitFor(() => expect(api.getAdminOrder).toHaveBeenCalledTimes(2));
  });

  it('история показывает имя сотрудника, а не сырой UUID', async () => {
    api.getAdminOrder.mockResolvedValue(
      makeOrder({
        statusHistory: [
          { fromStatus: null, toStatus: 'NEW', changedBy: null, comment: null, createdAt: '2026-07-24T10:00:00.000Z' },
          {
            fromStatus: 'NEW',
            toStatus: 'CANCELLED',
            changedBy: { displayName: 'Мария Менеджер' },
            comment: null,
            createdAt: '2026-07-24T11:00:00.000Z',
          },
        ],
        status: 'CANCELLED',
        allowedTransitions: [],
      }),
    );
    render(<AdminOrderDetail orderId="o-1" />);
    expect(await screen.findByText(/Мария Менеджер/)).toBeTruthy();
  });
});
