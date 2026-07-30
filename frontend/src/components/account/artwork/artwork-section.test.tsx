// @vitest-environment jsdom
/**
 * Блок макета позиции (клиент): статус/файл, действия строго из allowedActions,
 * успех APPROVED и причина REJECTED, отзыв макета, refetch при 409.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtworkSection } from './artwork-section';
import { ApiError } from '@/lib/api/client';
import type { ArtworkView, OrderItemArtworksResponse } from '@/lib/api/artworks';
import type { ArtworksState } from '@/lib/artworks/use-order-item-artworks';

const hook = vi.hoisted(() => ({ state: { status: 'loading' } as ArtworksState, reload: vi.fn() }));
const api = vi.hoisted(() => ({ withdrawArtwork: vi.fn(), getArtworkDownloadUrl: vi.fn(), getArtworkPreviewUrl: vi.fn() }));
const auth = vi.hoisted(() => ({ token: 'jwt' as string | null }));

vi.mock('@/lib/artworks/use-order-item-artworks', () => ({ useOrderItemArtworks: () => hook }));
vi.mock('@/lib/api/artworks', () => api);
vi.mock('@/lib/api/auth', () => ({ tokenStorage: { getAccessToken: () => auth.token } }));
// Дочерние диалоги не в фокусе этих тестов — заменяем на простые заглушки.
vi.mock('./artwork-upload-dialog', () => ({ ArtworkUploadDialog: () => <div data-testid="upload-dialog" /> }));
vi.mock('@/components/artwork/artwork-preview-modal', () => ({ ArtworkPreviewModal: () => <div data-testid="preview-modal" /> }));

function artwork(overrides: Partial<ArtworkView> = {}): ArtworkView {
  return {
    id: 'a-1',
    version: 1,
    status: 'UPLOADED',
    customerComment: null,
    reviewComment: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: '2026-07-24T10:00:00.000Z',
    file: { filename: 'card.pdf', mimeType: 'application/pdf', size: 204800, previewable: true },
    allowedActions: [],
    ...overrides,
  };
}
function ready(data: Partial<OrderItemArtworksResponse>): ArtworksState {
  return { status: 'ready', data: { artworks: [], canAttachNew: false, ...data } };
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  hook.reload.mockReset();
  hook.state = { status: 'loading' };
  auth.token = 'jwt';
});
afterEach(() => cleanup());

const render1 = () => render(<ArtworkSection orderId="o-1" itemId="i-1" title="Визитки" />);

describe('ArtworkSection', () => {
  it('loading: показывает индикатор', () => {
    hook.state = { status: 'loading' };
    render1();
    expect(screen.getByText('Загружаем макет…')).toBeTruthy();
  });

  it('нет макета + canAttachNew: кнопка загрузки', () => {
    hook.state = ready({ artworks: [], canAttachNew: true });
    render1();
    expect(screen.getByRole('button', { name: /Загрузить макет/ })).toBeTruthy();
  });

  it('нет макета + нельзя прикрепить: нейтральное сообщение', () => {
    hook.state = ready({ artworks: [], canAttachNew: false });
    render1();
    expect(screen.getByText('Макет ещё не загружен.')).toBeTruthy();
  });

  it('текущий макет: файл, версия и статус', () => {
    hook.state = ready({ artworks: [artwork({ version: 2, status: 'IN_REVIEW' })] });
    render1();
    expect(screen.getByText('card.pdf')).toBeTruthy();
    expect(screen.getByText(/v2 · На проверке/)).toBeTruthy();
  });

  it('APPROVED: сообщение об успехе', () => {
    hook.state = ready({ artworks: [artwork({ status: 'APPROVED' })] });
    render1();
    expect(screen.getByText('Макет принят в работу')).toBeTruthy();
  });

  it('REJECTED: показывает комментарий проверяющего', () => {
    hook.state = ready({ artworks: [artwork({ status: 'REJECTED', reviewComment: 'Низкое разрешение' })] });
    render1();
    expect(screen.getByText('Макет отклонён')).toBeTruthy();
    expect(screen.getByText('Низкое разрешение')).toBeTruthy();
  });

  it('кнопки действий строятся из allowedActions', () => {
    hook.state = ready({ artworks: [artwork({ status: 'UPLOADED', allowedActions: ['WITHDRAW', 'REPLACE'] })] });
    render1();
    expect(screen.getByRole('button', { name: /Заменить макет/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Отозвать макет' })).toBeTruthy();
  });

  it('без allowedActions действий нет', () => {
    hook.state = ready({ artworks: [artwork({ status: 'APPROVED', allowedActions: [] })] });
    render1();
    expect(screen.queryByRole('button', { name: 'Отозвать макет' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Заменить макет/ })).toBeNull();
  });

  it('отзыв макета: подтверждение → API → reload', async () => {
    hook.state = ready({ artworks: [artwork({ allowedActions: ['WITHDRAW'] })] });
    api.withdrawArtwork.mockResolvedValue(artwork({ status: 'WITHDRAWN' }));
    render1();

    fireEvent.click(screen.getByRole('button', { name: 'Отозвать макет' }));
    const dialog = await screen.findByRole('dialog', { name: 'Отозвать макет' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отозвать' }));

    await waitFor(() => expect(api.withdrawArtwork).toHaveBeenCalledWith('o-1', 'i-1', 'a-1', 'jwt'));
    await waitFor(() => expect(hook.reload).toHaveBeenCalled());
  });

  it('409 при отзыве: сообщение об изменении состояния и reload', async () => {
    hook.state = ready({ artworks: [artwork({ allowedActions: ['WITHDRAW'] })] });
    api.withdrawArtwork.mockRejectedValue(new ApiError(409, 'conflict', { code: 'ARTWORK_CONFLICT' } as never));
    render1();

    fireEvent.click(screen.getByRole('button', { name: 'Отозвать макет' }));
    const dialog = await screen.findByRole('dialog', { name: 'Отозвать макет' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отозвать' }));

    expect(await screen.findByText('Состояние макета уже изменилось другим сотрудником.')).toBeTruthy();
    await waitFor(() => expect(hook.reload).toHaveBeenCalled());
  });

  it('REPLACE открывает диалог загрузки', () => {
    hook.state = ready({ artworks: [artwork({ status: 'REJECTED', allowedActions: ['REPLACE'] })] });
    render1();
    fireEvent.click(screen.getByRole('button', { name: /Загрузить исправленный макет/ }));
    expect(screen.getByTestId('upload-dialog')).toBeTruthy();
  });
});
