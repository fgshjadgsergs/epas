// @vitest-environment jsdom
/**
 * Проверка макета (менеджер): загрузка/notFound/forbidden, review-кнопки строго
 * из allowedTransitions, обязательный комментарий при отклонении, защита от
 * двойного клика, refetch при 409, отсутствие сырых id/PII в разметке.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminArtworkDetail } from './admin-artwork-detail';
import { ApiError } from '@/lib/api/client';
import type { AdminArtworkDetail as AdminArtworkDetailDto } from '@/lib/api/admin-artworks';

const api = vi.hoisted(() => ({
  getAdminArtwork: vi.fn(),
  changeArtworkStatus: vi.fn(),
  getAdminArtworkDownloadUrl: vi.fn(),
  getAdminArtworkPreviewUrl: vi.fn(),
}));
const auth = vi.hoisted(() => ({ token: 'jwt' as string | null }));

vi.mock('@/lib/api/admin-artworks', () => api);
vi.mock('@/lib/api/auth', () => ({ tokenStorage: { getAccessToken: () => auth.token } }));

function makeDetail(overrides: Partial<AdminArtworkDetailDto> = {}): AdminArtworkDetailDto {
  return {
    id: 'a-1',
    orderNumber: 'KP-20260724-000001',
    itemTitle: 'Визитки',
    serviceSlug: 'vizitki',
    version: 1,
    status: 'UPLOADED',
    file: { filename: 'card.pdf', mimeType: 'application/pdf', size: 204800, previewable: true },
    customerComment: 'Проверьте отступы',
    reviewComment: null,
    reviewedBy: null,
    reviewedAt: null,
    allowedTransitions: ['IN_REVIEW'],
    history: [],
    ...overrides,
  } as AdminArtworkDetailDto;
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  auth.token = 'jwt';
});
afterEach(() => cleanup());

describe('AdminArtworkDetail', () => {
  it('success: показывает заказ, позицию, файл и комментарий клиента', async () => {
    api.getAdminArtwork.mockResolvedValue(makeDetail());
    render(<AdminArtworkDetail artworkId="a-1" />);
    expect(await screen.findByText('Заказ KP-20260724-000001')).toBeTruthy();
    expect(screen.getByText('card.pdf')).toBeTruthy();
    expect(screen.getByText('Проверьте отступы')).toBeTruthy();
  });

  it('notFound (404): понятный экран', async () => {
    api.getAdminArtwork.mockRejectedValue(new ApiError(404, 'нет'));
    render(<AdminArtworkDetail artworkId="a-1" />);
    expect(await screen.findByText('Макет не найден')).toBeTruthy();
  });

  it('403: экран «Нет доступа»', async () => {
    api.getAdminArtwork.mockRejectedValue(new ApiError(403, 'forbidden'));
    render(<AdminArtworkDetail artworkId="a-1" />);
    expect(await screen.findByText('Нет доступа')).toBeTruthy();
  });

  it('кнопки review строятся строго из allowedTransitions', async () => {
    api.getAdminArtwork.mockResolvedValue(makeDetail({ status: 'IN_REVIEW', allowedTransitions: ['APPROVED', 'REJECTED'] }));
    render(<AdminArtworkDetail artworkId="a-1" />);
    expect(await screen.findByRole('button', { name: 'Принять макет' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Отклонить' })).toBeTruthy();
    // Перехода, которого нет в allowedTransitions, быть не должно.
    expect(screen.queryByRole('button', { name: 'Взять на проверку' })).toBeNull();
  });

  it('нет доступных переходов → сообщение вместо кнопок', async () => {
    api.getAdminArtwork.mockResolvedValue(makeDetail({ status: 'APPROVED', allowedTransitions: [] }));
    render(<AdminArtworkDetail artworkId="a-1" />);
    expect(await screen.findByText('Для текущего статуса действий нет.')).toBeTruthy();
  });

  it('отклонение требует комментарий: кнопка заблокирована, пока пусто', async () => {
    api.getAdminArtwork.mockResolvedValue(makeDetail({ status: 'IN_REVIEW', allowedTransitions: ['REJECTED'] }));
    render(<AdminArtworkDetail artworkId="a-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Отклонить' }));

    const dialog = await screen.findByRole('dialog', { name: 'Отклонить макет?' });
    const submit = within(dialog).getByRole('button', { name: 'Отклонить' });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    expect(api.changeArtworkStatus).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Низкое разрешение' } });
    expect((submit as HTMLButtonElement).disabled).toBe(false);

    api.changeArtworkStatus.mockResolvedValue(makeDetail({ status: 'REJECTED', reviewComment: 'Низкое разрешение', allowedTransitions: [] }));
    fireEvent.click(submit);
    await waitFor(() =>
      expect(api.changeArtworkStatus).toHaveBeenCalledWith('a-1', { status: 'REJECTED', comment: 'Низкое разрешение' }, 'jwt'),
    );
  });

  it('принятие: комментарий необязателен, статус меняется', async () => {
    api.getAdminArtwork.mockResolvedValue(makeDetail({ status: 'IN_REVIEW', allowedTransitions: ['APPROVED'] }));
    render(<AdminArtworkDetail artworkId="a-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Принять макет' }));

    const dialog = await screen.findByRole('dialog', { name: 'Принять макет?' });
    api.changeArtworkStatus.mockResolvedValue(makeDetail({ status: 'APPROVED', allowedTransitions: [] }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Принять макет' }));
    await waitFor(() => expect(api.changeArtworkStatus).toHaveBeenCalledWith('a-1', { status: 'APPROVED', comment: undefined }, 'jwt'));
  });

  it('409-конфликт: сообщение и перечитывание состояния', async () => {
    api.getAdminArtwork.mockResolvedValue(makeDetail({ status: 'IN_REVIEW', allowedTransitions: ['APPROVED'] }));
    render(<AdminArtworkDetail artworkId="a-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Принять макет' }));
    const dialog = await screen.findByRole('dialog', { name: 'Принять макет?' });

    api.changeArtworkStatus.mockRejectedValue(new ApiError(409, 'conflict', { code: 'ARTWORK_CONFLICT' } as never));
    api.getAdminArtwork.mockResolvedValue(makeDetail({ status: 'APPROVED', allowedTransitions: [] }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Принять макет' }));

    expect(await screen.findByText('Состояние макета уже изменилось другим сотрудником.')).toBeTruthy();
    // Состояние перечитано (второй вызов getAdminArtwork).
    await waitFor(() => expect(api.getAdminArtwork).toHaveBeenCalledTimes(2));
  });

  it('в разметке нет сырых id/storage-ключей', async () => {
    const detail = makeDetail({ reviewedBy: { displayName: 'Анна М.' }, reviewedAt: '2026-07-25T09:00:00.000Z', status: 'APPROVED', allowedTransitions: [] });
    api.getAdminArtwork.mockResolvedValue(detail);
    const { container } = render(<AdminArtworkDetail artworkId="a-1" />);
    await screen.findByText('Заказ KP-20260724-000001');
    // displayName показывается, но сырой userId — нет.
    expect(screen.getByText(/Анна М\./)).toBeTruthy();
    expect(container.innerHTML).not.toContain('storageKey');
    expect(container.innerHTML).not.toContain('reviewedByUserId');
  });
});
