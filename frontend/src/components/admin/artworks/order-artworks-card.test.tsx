// @vitest-environment jsdom
/**
 * Сводка макетов заказа (админка): группировка строго по orderItemId, empty
 * state для позиции без макета, несколько версий одной позиции, отсутствие
 * сырого id/orderItemId в подписях DOM.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderArtworksCard } from './order-artworks-card';
import type { AdminArtworkSummary } from '@/lib/api/admin-artworks';

const api = vi.hoisted(() => ({ getAdminArtworks: vi.fn() }));
const auth = vi.hoisted(() => ({ token: 'jwt' as string | null }));

vi.mock('@/lib/api/admin-artworks', () => api);
vi.mock('@/lib/api/auth', () => ({ tokenStorage: { getAccessToken: () => auth.token } }));

function art(overrides: Partial<AdminArtworkSummary>): AdminArtworkSummary {
  return {
    id: 'a-x',
    orderItemId: 'i-x',
    orderNumber: 'KP-1',
    itemTitle: 'снимок',
    serviceSlug: 'vizitki',
    version: 1,
    status: 'UPLOADED',
    file: { filename: 'f.png', mimeType: 'image/png', size: 1024, previewable: true },
    customerComment: null,
    reviewComment: null,
    createdAt: '2026-07-24T10:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  api.getAdminArtworks.mockReset();
  auth.token = 'jwt';
});
afterEach(() => cleanup());

const items = [
  { id: 'item-1', title: 'Визитки' },
  { id: 'item-2', title: 'Визитки' }, // намеренно одинаковое название
];

describe('OrderArtworksCard', () => {
  it('раскладывает макеты по orderItemId, а не по названию позиции', async () => {
    // Похожие/одинаковые названия — привязка должна опираться на id, не на текст.
    api.getAdminArtworks.mockResolvedValue({
      items: [
        art({ id: 'A', orderItemId: 'item-1', file: { filename: 'card-a.png', mimeType: 'image/png', size: 2048, previewable: true } }),
        art({ id: 'B', orderItemId: 'item-2', file: { filename: 'card-b.pdf', mimeType: 'application/pdf', size: 4096, previewable: true } }),
      ],
      total: 2,
      page: 1,
      pageSize: 100,
    });

    render(<OrderArtworksCard orderNumber="KP-1" items={items} />);
    const list = await screen.findByRole('list', { name: 'Позиции заказа' });
    // Прямые потомки — блоки позиций (вложенные li макетов не считаем).
    const rows = Array.from(list.children) as HTMLElement[];
    expect(rows).toHaveLength(2);

    // Позиция 1 показывает только свой макет A и не показывает B.
    expect(within(rows[0]).getByText(/card-a\.png/)).toBeTruthy();
    expect(within(rows[0]).queryByText(/card-b\.pdf/)).toBeNull();
    // Позиция 2 показывает только свой макет B.
    expect(within(rows[1]).getByText(/card-b\.pdf/)).toBeTruthy();
    expect(within(rows[1]).queryByText(/card-a\.png/)).toBeNull();
  });

  it('позиция без макетов показывает корректный empty state', async () => {
    api.getAdminArtworks.mockResolvedValue({
      items: [art({ id: 'A', orderItemId: 'item-1' })],
      total: 1,
      page: 1,
      pageSize: 100,
    });
    render(<OrderArtworksCard orderNumber="KP-1" items={items} />);
    await screen.findByRole('list', { name: 'Позиции заказа' });
    expect(screen.getByText('Макет для этой позиции ещё не загружен.')).toBeTruthy();
  });

  it('несколько версий одной позиции отображаются в её блоке по возрастанию', async () => {
    api.getAdminArtworks.mockResolvedValue({
      items: [
        art({ id: 'v2', orderItemId: 'item-1', version: 2, status: 'IN_REVIEW', file: { filename: 'v2.png', mimeType: 'image/png', size: 100, previewable: true } }),
        art({ id: 'v1', orderItemId: 'item-1', version: 1, status: 'SUPERSEDED', file: { filename: 'v1.png', mimeType: 'image/png', size: 100, previewable: true } }),
      ],
      total: 2,
      page: 1,
      pageSize: 100,
    });
    render(<OrderArtworksCard orderNumber="KP-1" items={[{ id: 'item-1', title: 'Визитки' }]} />);
    const list = await screen.findByRole('list', { name: 'Позиции заказа' });
    const links = within(list).getAllByRole('link');
    // v1 идёт раньше v2.
    expect(within(links[0]).getByText(/v1 · v1\.png/)).toBeTruthy();
    expect(within(links[1]).getByText(/v2 · v2\.png/)).toBeTruthy();
  });

  it('orderItemId не выводится в разметке как подпись', async () => {
    api.getAdminArtworks.mockResolvedValue({
      items: [art({ id: 'A', orderItemId: 'item-1' })],
      total: 1,
      page: 1,
      pageSize: 100,
    });
    const { container } = render(<OrderArtworksCard orderNumber="KP-1" items={[{ id: 'item-1', title: 'Визитки' }]} />);
    await screen.findByRole('list', { name: 'Позиции заказа' });
    // Технический id есть только в href детали (по artwork.id), но не как видимый текст.
    expect(container.textContent).not.toContain('item-1');
  });

  it('403 → сообщение о недостатке прав', async () => {
    const { ApiError } = await import('@/lib/api/client');
    api.getAdminArtworks.mockRejectedValue(new ApiError(403, 'forbidden'));
    render(<OrderArtworksCard orderNumber="KP-1" items={items} />);
    expect(await screen.findByText('Нет прав на просмотр макетов.')).toBeTruthy();
  });

  it('запрос идёт с фильтром по номеру заказа', async () => {
    api.getAdminArtworks.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 100 });
    render(<OrderArtworksCard orderNumber="KP-777" items={items} />);
    await waitFor(() => expect(api.getAdminArtworks).toHaveBeenCalled());
    expect(api.getAdminArtworks.mock.calls[0][1]).toMatchObject({ orderNumber: 'KP-777' });
  });
});
