// @vitest-environment jsdom
/**
 * ServiceImagesManager: превью, смена основного, правка alt, перестановка,
 * открепление, загрузка и её ошибка. DTO безопасный (без storage-полей).
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceImagesManager } from './service-images-manager';
import { ApiError } from '@/lib/api/client';
import type { AdminService } from '@/lib/api/admin-catalog';
import type { ServiceImage } from '@/lib/api/types';

const api = vi.hoisted(() => ({ updateServiceImage: vi.fn(), deleteServiceImage: vi.fn() }));
const upload = vi.hoisted(() => ({ uploadServiceImage: vi.fn() }));
const revalidate = vi.hoisted(() => ({ revalidateCatalog: vi.fn() }));

vi.mock('@/lib/api/admin-catalog', () => api);
vi.mock('@/lib/api/upload', () => upload);
vi.mock('@/lib/catalog/revalidate', () => revalidate);
vi.mock('@/lib/api/auth', () => ({ tokenStorage: { getAccessToken: () => 'jwt' } }));

function img(overrides: Partial<ServiceImage> = {}): ServiceImage {
  return { id: 'i-1', alt: null, sortOrder: 0, isMain: true, url: 'http://pub/1.png', ...overrides };
}
function service(images: ServiceImage[]): AdminService {
  return {
    id: 's-1', categoryId: 'c', slug: 's', title: 'Услуга', shortDescription: null, description: null,
    isActive: true, sortOrder: 0, createdAt: '', updatedAt: '', category: { id: 'c', title: 'Кат', slug: 'k' },
    calculator: null, images,
  };
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  upload.uploadServiceImage.mockReset();
  revalidate.revalidateCatalog.mockReset().mockResolvedValue(undefined);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('ServiceImagesManager', () => {
  it('пусто: подсказка про основное', () => {
    render(<ServiceImagesManager service={service([])} onChanged={vi.fn()} />);
    expect(screen.getByText(/Первое загруженное станет основным/)).toBeTruthy();
  });

  it('показывает превью и метку «Основное», без storage-полей', () => {
    const { container } = render(<ServiceImagesManager service={service([img()])} onChanged={vi.fn()} />);
    expect(screen.getByText('Основное')).toBeTruthy();
    // Безопасный DTO: в разметке нет storage-ключей.
    expect(container.innerHTML).not.toContain('storageKey');
    expect(container.innerHTML).not.toContain('bucket');
  });

  it('смена основного вызывает API и revalidate', async () => {
    const onChanged = vi.fn();
    api.updateServiceImage.mockResolvedValue(img());
    render(<ServiceImagesManager service={service([img({ id: 'i-1', isMain: true, sortOrder: 0 }), img({ id: 'i-2', isMain: false, sortOrder: 1 })])} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: /Сделать основным/ }));
    await waitFor(() => expect(api.updateServiceImage).toHaveBeenCalledWith('s-1', 'i-2', { isMain: true }, 'jwt'));
    await waitFor(() => expect(revalidate.revalidateCatalog).toHaveBeenCalled());
  });

  it('правка alt отправляется по кнопке', async () => {
    api.updateServiceImage.mockResolvedValue(img());
    render(<ServiceImagesManager service={service([img({ alt: null })])} onChanged={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Alt-текст'), { target: { value: 'Визитки крупным планом' } });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить alt/ }));
    await waitFor(() => expect(api.updateServiceImage).toHaveBeenCalledWith('s-1', 'i-1', { alt: 'Визитки крупным планом' }, 'jwt'));
  });

  it('открепление с подтверждением вызывает delete', async () => {
    api.deleteServiceImage.mockResolvedValue(undefined);
    render(<ServiceImagesManager service={service([img()])} onChanged={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Открепить' }));
    await waitFor(() => expect(api.deleteServiceImage).toHaveBeenCalledWith('s-1', 'i-1', 'jwt'));
  });

  it('перестановка меняет sortOrder местами с соседом', async () => {
    api.updateServiceImage.mockResolvedValue(img());
    render(<ServiceImagesManager service={service([img({ id: 'i-1', sortOrder: 0 }), img({ id: 'i-2', isMain: false, sortOrder: 1 })])} onChanged={vi.fn()} />);
    // У первого элемента кнопка «Ниже» доступна.
    const rows = screen.getAllByRole('listitem');
    fireEvent.click(within(rows[0]).getByRole('button', { name: 'Ниже' }));
    await waitFor(() => expect(api.updateServiceImage).toHaveBeenCalledWith('s-1', 'i-1', { sortOrder: 1 }, 'jwt'));
  });

  it('загрузка: успех вызывает uploadServiceImage и onChanged', async () => {
    const onChanged = vi.fn();
    upload.uploadServiceImage.mockResolvedValue({ id: 'i-9', alt: null, sortOrder: 0, isMain: true, url: 'http://pub/9.png' });
    render(<ServiceImagesManager service={service([])} onChanged={onChanged} />);
    const file = new File([new Uint8Array([1, 2, 3])], 'card.png', { type: 'image/png' });
    fireEvent.change(document.querySelector('input[type=file]')!, { target: { files: [file] } });
    await waitFor(() => expect(upload.uploadServiceImage).toHaveBeenCalled());
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('загрузка: ошибка показывается пользователю', async () => {
    upload.uploadServiceImage.mockRejectedValue(new ApiError(413, 'too big'));
    render(<ServiceImagesManager service={service([])} onChanged={vi.fn()} />);
    const file = new File([new Uint8Array([1])], 'card.png', { type: 'image/png' });
    fireEvent.change(document.querySelector('input[type=file]')!, { target: { files: [file] } });
    expect(await screen.findByText(/слишком большой/i)).toBeTruthy();
  });

  it('отклоняет неверный MIME до обращения к серверу', async () => {
    render(<ServiceImagesManager service={service([])} onChanged={vi.fn()} />);
    const file = new File([new Uint8Array([1])], 'a.gif', { type: 'image/gif' });
    fireEvent.change(document.querySelector('input[type=file]')!, { target: { files: [file] } });
    expect(await screen.findByText(/Разрешены JPEG, PNG или WebP/)).toBeTruthy();
    expect(upload.uploadServiceImage).not.toHaveBeenCalled();
  });
});
