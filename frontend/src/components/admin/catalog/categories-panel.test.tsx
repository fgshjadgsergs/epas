// @vitest-environment jsdom
/**
 * CategoriesPanel: список/пусто/ошибка/повтор/403, активность, безопасное
 * удаление (кнопка выключена при наличии услуг), открытие формы создания.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CategoriesPanel } from './categories-panel';
import { ApiError } from '@/lib/api/client';
import type { AdminCategory } from '@/lib/api/admin-catalog';

const api = vi.hoisted(() => ({ getAdminCategories: vi.fn(), updateAdminCategory: vi.fn(), deleteAdminCategory: vi.fn(), createAdminCategory: vi.fn() }));
const revalidate = vi.hoisted(() => ({ revalidateCatalog: vi.fn() }));
const auth = vi.hoisted(() => ({ token: 'jwt' as string | null }));

vi.mock('@/lib/api/admin-catalog', () => api);
vi.mock('@/lib/catalog/revalidate', () => revalidate);
vi.mock('@/lib/api/auth', () => ({ tokenStorage: { getAccessToken: () => auth.token } }));

function cat(overrides: Partial<AdminCategory> = {}): AdminCategory {
  return {
    id: 'c-1', parentId: null, slug: 'vizitki', title: 'Визитки', description: null,
    isActive: true, sortOrder: 0, createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-02T00:00:00.000Z',
    serviceCount: 0, childrenCount: 0, ...overrides,
  };
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  revalidate.revalidateCatalog.mockReset().mockResolvedValue(undefined);
  auth.token = 'jwt';
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('CategoriesPanel', () => {
  it('список: показывает название, slug и число услуг', async () => {
    api.getAdminCategories.mockResolvedValue([cat({ serviceCount: 3 })]);
    render(<CategoriesPanel />);
    expect(await screen.findAllByText('Визитки')).toBeTruthy();
    expect(screen.getAllByText('vizitki').length).toBeGreaterThan(0);
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
  });

  it('пусто', async () => {
    api.getAdminCategories.mockResolvedValue([]);
    render(<CategoriesPanel />);
    expect(await screen.findByText('Категорий пока нет')).toBeTruthy();
  });

  it('ошибка + повтор', async () => {
    api.getAdminCategories.mockRejectedValueOnce(new ApiError(500, 'сбой'));
    render(<CategoriesPanel />);
    const retry = await screen.findByRole('button', { name: 'Повторить' });
    api.getAdminCategories.mockResolvedValueOnce([cat()]);
    fireEvent.click(retry);
    await waitFor(() => expect(api.getAdminCategories).toHaveBeenCalledTimes(2));
    expect(await screen.findAllByText('Визитки')).toBeTruthy();
  });

  it('403 → нет доступа', async () => {
    api.getAdminCategories.mockRejectedValue(new ApiError(403, 'forbidden'));
    render(<CategoriesPanel />);
    expect(await screen.findByText('Нет доступа')).toBeTruthy();
  });

  it('переключение активности вызывает API и revalidate', async () => {
    api.getAdminCategories.mockResolvedValue([cat({ isActive: true })]);
    api.updateAdminCategory.mockResolvedValue(cat({ isActive: false }));
    render(<CategoriesPanel />);
    await screen.findAllByText('Визитки');
    fireEvent.click(screen.getAllByRole('button', { name: 'Скрыть' })[0]);
    await waitFor(() => expect(api.updateAdminCategory).toHaveBeenCalledWith('c-1', { isActive: false }, 'jwt'));
    await waitFor(() => expect(revalidate.revalidateCatalog).toHaveBeenCalled());
  });

  it('удаление недоступно, пока в категории есть услуги', async () => {
    api.getAdminCategories.mockResolvedValue([cat({ serviceCount: 2 })]);
    render(<CategoriesPanel />);
    await screen.findAllByText('Визитки');
    const del = screen.getAllByRole('button', { name: /Удалить/ })[0] as HTMLButtonElement;
    expect(del.disabled).toBe(true);
    expect(api.deleteAdminCategory).not.toHaveBeenCalled();
  });

  it('пустую категорию удаляем с подтверждением', async () => {
    api.getAdminCategories.mockResolvedValue([cat({ serviceCount: 0 })]);
    api.deleteAdminCategory.mockResolvedValue(undefined);
    render(<CategoriesPanel />);
    await screen.findAllByText('Визитки');
    fireEvent.click(screen.getAllByRole('button', { name: /Удалить/ })[0]);
    await waitFor(() => expect(api.deleteAdminCategory).toHaveBeenCalledWith('c-1', 'jwt'));
  });

  it('кнопка «Категория» открывает форму создания', async () => {
    api.getAdminCategories.mockResolvedValue([cat()]);
    render(<CategoriesPanel />);
    await screen.findAllByText('Визитки');
    fireEvent.click(screen.getByRole('button', { name: /Категория/ }));
    expect(await screen.findByRole('dialog', { name: 'Новая категория' })).toBeTruthy();
  });
});
