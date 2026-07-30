// @vitest-environment jsdom
/**
 * Список макетов (менеджер): loading/empty/error/retry, 403, фильтры в URL,
 * debounce поиска по номеру заказа, валидация диапазона дат, пагинация.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminArtworksList } from './admin-artworks-list';
import { ApiError } from '@/lib/api/client';
import type { AdminArtworkListResponse } from '@/lib/api/admin-artworks';

const api = vi.hoisted(() => ({ getAdminArtworks: vi.fn() }));
const auth = vi.hoisted(() => ({ token: 'jwt' as string | null }));
const nav = vi.hoisted(() => ({ params: new URLSearchParams(), replace: vi.fn() }));

vi.mock('@/lib/api/admin-artworks', () => api);
vi.mock('@/lib/api/auth', () => ({ tokenStorage: { getAccessToken: () => auth.token } }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
  useSearchParams: () => nav.params,
}));

function makePage(overrides: Partial<AdminArtworkListResponse> = {}): AdminArtworkListResponse {
  return {
    items: [
      {
        id: 'a-1',
        orderItemId: 'i-1',
        orderNumber: 'KP-20260724-000001',
        itemTitle: 'Визитки',
        serviceSlug: 'vizitki',
        version: 2,
        status: 'IN_REVIEW',
        file: { filename: 'card.pdf', mimeType: 'application/pdf', size: 204800, previewable: true },
        customerComment: null,
        reviewComment: null,
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
  api.getAdminArtworks.mockReset();
  auth.token = 'jwt';
  nav.params = new URLSearchParams();
  nav.replace.mockReset();
  vi.useRealTimers();
});
afterEach(() => cleanup());

describe('AdminArtworksList', () => {
  it('success: показывает заказ, позицию, версию и статус', async () => {
    api.getAdminArtworks.mockResolvedValue(makePage());
    render(<AdminArtworksList />);
    expect(await screen.findAllByText('KP-20260724-000001')).not.toHaveLength(0);
    expect(screen.getAllByText('Визитки').length).toBeGreaterThan(0);
    expect(screen.getAllByText('v2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('На проверке').length).toBeGreaterThan(0);
  });

  it('empty: понятное пустое состояние', async () => {
    api.getAdminArtworks.mockResolvedValue(makePage({ items: [], total: 0 }));
    render(<AdminArtworksList />);
    expect(await screen.findByText('Макеты не найдены')).toBeTruthy();
  });

  it('error + retry', async () => {
    api.getAdminArtworks.mockRejectedValueOnce(new ApiError(500, 'сбой'));
    render(<AdminArtworksList />);
    expect(await screen.findByText('Не удалось загрузить макеты')).toBeTruthy();
    api.getAdminArtworks.mockResolvedValueOnce(makePage());
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalled());
  });

  it('403 → экран «Нет доступа» (backend — источник безопасности)', async () => {
    api.getAdminArtworks.mockRejectedValue(new ApiError(403, 'forbidden'));
    render(<AdminArtworksList />);
    expect(await screen.findByText('Нет доступа')).toBeTruthy();
  });

  it('фильтр по статусу пишется в URL (page сбрасывается)', async () => {
    api.getAdminArtworks.mockResolvedValue(makePage());
    render(<AdminArtworksList />);
    await screen.findAllByText('KP-20260724-000001');
    fireEvent.change(screen.getByLabelText('Статус'), { target: { value: 'APPROVED' } });
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/admin/artworks/?status=APPROVED', { scroll: false }));
  });

  it('поиск по номеру заказа идёт в URL с debounce', async () => {
    vi.useFakeTimers();
    api.getAdminArtworks.mockResolvedValue(makePage());
    render(<AdminArtworksList />);

    const input = screen.getByLabelText('Номер заказа');
    fireEvent.change(input, { target: { value: 'KP' } });
    fireEvent.change(input, { target: { value: 'KP-1' } });
    expect(nav.replace).not.toHaveBeenCalled();
    vi.advanceTimersByTime(400);
    expect(nav.replace).toHaveBeenCalledWith('/admin/artworks/?orderNumber=KP-1', { scroll: false });
    vi.useRealTimers();
  });

  it('фильтры читаются из URL при загрузке и уходят в запрос', async () => {
    nav.params = new URLSearchParams('status=APPROVED&page=2&orderNumber=KP-9');
    api.getAdminArtworks.mockResolvedValue(makePage({ page: 2, total: 40 }));
    render(<AdminArtworksList />);
    await waitFor(() => expect(api.getAdminArtworks).toHaveBeenCalled());
    const query = api.getAdminArtworks.mock.calls[0][1];
    expect(query).toMatchObject({ status: 'APPROVED', page: 2, orderNumber: 'KP-9' });
  });

  it('невалидный диапазон дат: запрос не отправляется, показана подсказка', async () => {
    nav.params = new URLSearchParams('from=2026-08-01&to=2026-07-01');
    render(<AdminArtworksList />);
    expect(await screen.findByText(/Начало периода позже конца/)).toBeTruthy();
    expect(api.getAdminArtworks).not.toHaveBeenCalled();
  });

  it('пагинация: «Вперёд» переключает страницу в URL', async () => {
    api.getAdminArtworks.mockResolvedValue(makePage({ total: 40, pageSize: 20, page: 1 }));
    render(<AdminArtworksList />);
    await screen.findAllByText('KP-20260724-000001');
    fireEvent.click(screen.getByRole('button', { name: 'Вперёд' }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/admin/artworks/?page=2', { scroll: false }));
  });

  it('даты уходят как границы суток в запрос', async () => {
    nav.params = new URLSearchParams('from=2026-07-01&to=2026-07-31');
    api.getAdminArtworks.mockResolvedValue(makePage());
    render(<AdminArtworksList />);
    await waitFor(() => expect(api.getAdminArtworks).toHaveBeenCalled());
    const query = api.getAdminArtworks.mock.calls[0][1];
    expect(query.from).toBe('2026-07-01T00:00:00.000Z');
    expect(query.to).toBe('2026-07-31T23:59:59.999Z');
  });
});
