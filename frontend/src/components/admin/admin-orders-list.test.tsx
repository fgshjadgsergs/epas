// @vitest-environment jsdom
/**
 * Список заказов админки: loading/empty/error, фильтры и URL search params,
 * пагинация, DEMO-маркер, валидация диапазона дат.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminOrdersList } from './admin-orders-list';
import { ApiError } from '@/lib/api/client';
import type { AdminOrderListDto } from '@/lib/api/admin-orders';

const api = vi.hoisted(() => ({ queryAdminOrders: vi.fn(), getAdminOrder: vi.fn(), updateAdminOrderStatus: vi.fn() }));
const auth = vi.hoisted(() => ({ token: 'jwt' as string | null }));
const nav = vi.hoisted(() => ({ params: new URLSearchParams(), replace: vi.fn() }));

vi.mock('@/lib/api/admin-orders', () => api);
vi.mock('@/lib/api/auth', () => ({ tokenStorage: { getAccessToken: () => auth.token } }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
  useSearchParams: () => nav.params,
}));

const money = (amountMinor: number) => ({ amountMinor, currency: 'RUB' });

function makePage(overrides: Partial<AdminOrderListDto> = {}): AdminOrderListDto {
  return {
    items: [
      {
        id: 'o-1',
        orderNumber: 'KP-20260724-000001',
        status: 'NEW',
        pricingMode: 'LIVE',
        contactName: 'Иван Петров',
        total: money(231000),
        itemCount: 2,
        createdAt: '2026-07-24T10:00:00.000Z',
      },
    ],
    total: 1,
    page: 1,
    pageSize: 20,
    ...overrides,
  };
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  auth.token = 'jwt';
  nav.params = new URLSearchParams();
  nav.replace.mockReset();
  window.sessionStorage.clear();
  vi.useRealTimers();
});
afterEach(() => cleanup());

describe('AdminOrdersList', () => {
  it('loading: показывает скелет до ответа', async () => {
    api.queryAdminOrders.mockImplementation(() => new Promise(() => undefined));
    render(<AdminOrdersList />);
    // Скелет — aria-hidden, проверяем что данных ещё нет.
    await waitFor(() => expect(api.queryAdminOrders).toHaveBeenCalled());
    expect(screen.queryByText('KP-20260724-000001')).toBeNull();
  });

  it('success: показывает заказ, клиента, сумму и валюту', async () => {
    api.queryAdminOrders.mockResolvedValue(makePage());
    render(<AdminOrdersList />);
    expect(await screen.findAllByText('KP-20260724-000001')).not.toHaveLength(0);
    expect(screen.getAllByText('Иван Петров').length).toBeGreaterThan(0);
    expect(screen.getAllByText('RUB').length).toBeGreaterThan(0);
  });

  it('empty: понятное пустое состояние', async () => {
    api.queryAdminOrders.mockResolvedValue(makePage({ items: [], total: 0 }));
    render(<AdminOrdersList />);
    expect(await screen.findByText('Заказы не найдены')).toBeTruthy();
  });

  it('error + retry', async () => {
    api.queryAdminOrders.mockRejectedValueOnce(new ApiError(500, 'сбой'));
    render(<AdminOrdersList />);
    expect(await screen.findByText('Не удалось загрузить заказы')).toBeTruthy();
    api.queryAdminOrders.mockResolvedValueOnce(makePage());
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalled());
  });

  it('403 от API → экран «Нет доступа» (backend — источник безопасности)', async () => {
    api.queryAdminOrders.mockRejectedValue(new ApiError(403, 'forbidden'));
    render(<AdminOrdersList />);
    expect(await screen.findByText('Нет доступа')).toBeTruthy();
  });

  it('фильтр по статусу пишется в URL (page сбрасывается)', async () => {
    api.queryAdminOrders.mockResolvedValue(makePage());
    render(<AdminOrdersList />);
    await screen.findAllByText('KP-20260724-000001');
    fireEvent.change(screen.getByLabelText('Статус'), { target: { value: 'CANCELLED' } });
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/admin/orders/?status=CANCELLED', { scroll: false }));
  });

  it('текстовый поиск идёт в URL с debounce, а не на каждый символ', async () => {
    vi.useFakeTimers();
    api.queryAdminOrders.mockResolvedValue(makePage());
    render(<AdminOrdersList />);

    const input = screen.getByLabelText('Номер заказа');
    fireEvent.change(input, { target: { value: 'K' } });
    fireEvent.change(input, { target: { value: 'KP' } });
    fireEvent.change(input, { target: { value: 'KP-1' } });
    // До истечения debounce URL не трогается.
    expect(nav.replace).not.toHaveBeenCalled();
    vi.advanceTimersByTime(400);
    expect(nav.replace).toHaveBeenCalledTimes(1);
    expect(nav.replace).toHaveBeenCalledWith('/admin/orders/?orderNumber=KP-1', { scroll: false });
    vi.useRealTimers();
  });

  it('фильтры читаются из URL search params при загрузке', async () => {
    nav.params = new URLSearchParams('status=NEW&page=2&orderNumber=KP-9');
    api.queryAdminOrders.mockResolvedValue(makePage({ page: 2, total: 40 }));
    render(<AdminOrdersList />);
    await waitFor(() => expect(api.queryAdminOrders).toHaveBeenCalled());
    const query = api.queryAdminOrders.mock.calls[0][1];
    expect(query).toMatchObject({ status: 'NEW', page: 2, orderNumber: 'KP-9' });
  });

  it('невалидный диапазон дат: запрос не отправляется, показана подсказка', async () => {
    nav.params = new URLSearchParams('from=2026-08-01&to=2026-07-01');
    render(<AdminOrdersList />);
    expect(await screen.findByText(/Начало периода позже конца/)).toBeTruthy();
    expect(api.queryAdminOrders).not.toHaveBeenCalled();
  });

  it('DEMO-заказ помечается', async () => {
    api.queryAdminOrders.mockResolvedValue(
      makePage({ items: [{ ...makePage().items[0], pricingMode: 'DEMO' }] }),
    );
    render(<AdminOrdersList />);
    expect(await screen.findAllByText(/демо-прайс/)).not.toHaveLength(0);
  });

  it('пагинация: «Вперёд» переключает страницу в URL', async () => {
    api.queryAdminOrders.mockResolvedValue(makePage({ total: 40, pageSize: 20, page: 1 }));
    render(<AdminOrdersList />);
    await screen.findAllByText('KP-20260724-000001');
    fireEvent.click(screen.getByRole('button', { name: 'Вперёд' }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/admin/orders/?page=2', { scroll: false }));
  });

  it('поиск по телефону идёт в API, но НЕ попадает в URL', async () => {
    vi.useFakeTimers();
    api.queryAdminOrders.mockResolvedValue(makePage());
    render(<AdminOrdersList />);

    fireEvent.change(screen.getByLabelText('Телефон'), { target: { value: '9001234567' } });
    vi.advanceTimersByTime(400);
    vi.useRealTimers();

    // Запрос к API с телефоном ушёл...
    await waitFor(() => {
      const calls = api.queryAdminOrders.mock.calls;
      expect(calls.some((c) => c[1]?.phone === '9001234567')).toBe(true);
    });
    // ...но телефон нигде не записан в URL.
    for (const call of nav.replace.mock.calls) {
      expect(String(call[0])).not.toContain('9001234567');
      expect(String(call[0])).not.toContain('phone');
    }
  });

  it('поиск по email идёт в API, но НЕ попадает в URL', async () => {
    vi.useFakeTimers();
    api.queryAdminOrders.mockResolvedValue(makePage());
    render(<AdminOrdersList />);

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ivan@example.com' } });
    vi.advanceTimersByTime(400);
    vi.useRealTimers();

    await waitFor(() => {
      const calls = api.queryAdminOrders.mock.calls;
      expect(calls.some((c) => c[1]?.email === 'ivan@example.com')).toBe(true);
    });
    for (const call of nav.replace.mock.calls) {
      expect(String(call[0])).not.toContain('ivan@example.com');
      expect(String(call[0])).not.toContain('email');
    }
  });

  it('контакты не сохраняются в sessionStorage при возврате', async () => {
    vi.useFakeTimers();
    api.queryAdminOrders.mockResolvedValue(makePage());
    render(<AdminOrdersList />);

    fireEvent.change(screen.getByLabelText('Телефон'), { target: { value: '9001234567' } });
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ivan@example.com' } });
    vi.advanceTimersByTime(400);
    vi.useRealTimers();

    await waitFor(() => expect(api.queryAdminOrders).toHaveBeenCalled());
    const stored = window.sessionStorage.getItem('kp_admin_orders_search') ?? '';
    expect(stored).not.toContain('9001234567');
    expect(stored).not.toContain('ivan@example.com');
    expect(stored).not.toContain('phone');
    expect(stored).not.toContain('email');
  });

  it('телефон/email не восстанавливаются из URL при загрузке (только локально)', async () => {
    // Даже если кто-то вручную добавил phone/email в URL — в поля они не попадают.
    nav.params = new URLSearchParams('phone=900&email=a@b.co&status=NEW');
    api.queryAdminOrders.mockResolvedValue(makePage());
    render(<AdminOrdersList />);
    await waitFor(() => expect(api.queryAdminOrders).toHaveBeenCalled());

    expect((screen.getByLabelText('Телефон') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('E-mail') as HTMLInputElement).value).toBe('');
    // Первый запрос идёт без контактов из URL.
    expect(api.queryAdminOrders.mock.calls[0][1].phone).toBeUndefined();
    expect(api.queryAdminOrders.mock.calls[0][1].email).toBeUndefined();
  });
});
