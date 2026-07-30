// @vitest-environment jsdom
/**
 * CategoryForm: подсказка slug из названия (новая), валидация slug,
 * предупреждение о смене адреса (правка), дубликат slug (409), dirty, создание.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CategoryForm } from './category-form';
import { ApiError } from '@/lib/api/client';
import type { AdminCategory } from '@/lib/api/admin-catalog';

const api = vi.hoisted(() => ({ createAdminCategory: vi.fn(), updateAdminCategory: vi.fn() }));
const revalidate = vi.hoisted(() => ({ revalidateCatalog: vi.fn() }));

vi.mock('@/lib/api/admin-catalog', () => api);
vi.mock('@/lib/catalog/revalidate', () => revalidate);
vi.mock('@/lib/api/auth', () => ({ tokenStorage: { getAccessToken: () => 'jwt' } }));

const existing: AdminCategory = {
  id: 'c-1', parentId: null, slug: 'vizitki', title: 'Визитки', description: null,
  isActive: true, sortOrder: 0, createdAt: '', updatedAt: '', serviceCount: 0, childrenCount: 0,
};

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  revalidate.revalidateCatalog.mockReset().mockResolvedValue(undefined);
});
afterEach(() => cleanup());

describe('CategoryForm (new)', () => {
  it('предлагает slug из названия (транслит) и создаёт', async () => {
    api.createAdminCategory.mockResolvedValue({ id: 'c-2' });
    const onSaved = vi.fn();
    render(<CategoryForm category={null} categories={[]} onClose={vi.fn()} onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Наклейки' } });
    expect((screen.getByLabelText('Slug (адрес)') as HTMLInputElement).value).toBe('nakleyki');

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(api.createAdminCategory).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Наклейки', slug: 'nakleyki', isActive: true }), 'jwt',
    ));
    await waitFor(() => expect(revalidate.revalidateCatalog).toHaveBeenCalled());
    expect(onSaved).toHaveBeenCalled();
  });

  it('невалидный slug блокирует сохранение', () => {
    render(<CategoryForm category={null} categories={[]} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'X' } });
    fireEvent.change(screen.getByLabelText('Slug (адрес)'), { target: { value: 'Плохой Slug' } });
    expect(screen.getByText(/Только строчная латиница/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Сохранить' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('дубликат slug (409) показывает понятную ошибку', async () => {
    api.createAdminCategory.mockRejectedValue(new ApiError(409, 'Категория с таким slug уже существует'));
    render(<CategoryForm category={null} categories={[]} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Визитки' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(await screen.findByText(/уже существует/)).toBeTruthy();
  });
});

describe('CategoryForm (edit)', () => {
  it('смена существующего slug предупреждает об изменении адреса', () => {
    render(<CategoryForm category={existing} categories={[existing]} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.queryByText(/Изменится публичный адрес/)).toBeNull();
    fireEvent.change(screen.getByLabelText('Slug (адрес)'), { target: { value: 'vizitki-new' } });
    expect(screen.getByText(/Изменится публичный адрес/)).toBeTruthy();
  });

  it('показывает «несохранённые изменения» при правке', () => {
    render(<CategoryForm category={existing} categories={[existing]} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.queryByText('Есть несохранённые изменения')).toBeNull();
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Визитки+' } });
    expect(screen.getByText('Есть несохранённые изменения')).toBeTruthy();
  });
});
