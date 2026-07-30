// @vitest-environment jsdom
/**
 * ServiceEditor: загрузка, правка контента + сохранение, предупреждение о смене
 * slug, dirty-состояние, калькулятор read-only со ссылкой в Прайсы, без поля цены.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceEditor } from './service-editor';
import { ApiError } from '@/lib/api/client';
import type { AdminCategory, AdminService } from '@/lib/api/admin-catalog';

const api = vi.hoisted(() => ({ getAdminService: vi.fn(), getAdminCategories: vi.fn(), updateAdminService: vi.fn() }));
const revalidate = vi.hoisted(() => ({ revalidateCatalog: vi.fn() }));
const auth = vi.hoisted(() => ({ token: 'jwt' as string | null }));

vi.mock('@/lib/api/admin-catalog', () => api);
vi.mock('@/lib/catalog/revalidate', () => revalidate);
vi.mock('@/lib/api/auth', () => ({ tokenStorage: { getAccessToken: () => auth.token } }));
// Менеджер изображений — отдельный тест; здесь заглушка.
vi.mock('./service-images-manager', () => ({ ServiceImagesManager: () => <div data-testid="images" /> }));

const cats: AdminCategory[] = [
  { id: 'cat-a', parentId: null, slug: 'a', title: 'Визитки', description: null, isActive: true, sortOrder: 0, createdAt: '', updatedAt: '', serviceCount: 1, childrenCount: 0 },
];
function svc(overrides: Partial<AdminService> = {}): AdminService {
  return {
    id: 's-1', categoryId: 'cat-a', slug: 'standart', title: 'Стандартные визитки', shortDescription: 'кратко', description: 'полно',
    isActive: true, sortOrder: 0, createdAt: '', updatedAt: '', category: { id: 'cat-a', title: 'Визитки', slug: 'a' },
    calculator: null, images: [], ...overrides,
  };
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  revalidate.revalidateCatalog.mockReset().mockResolvedValue(undefined);
  auth.token = 'jwt';
  api.getAdminCategories.mockResolvedValue(cats);
});
afterEach(() => cleanup());

describe('ServiceEditor', () => {
  it('404 → услуга не найдена', async () => {
    api.getAdminService.mockRejectedValue(new ApiError(404, 'нет'));
    render(<ServiceEditor serviceId="s-1" />);
    expect(await screen.findByText('Услуга не найдена')).toBeTruthy();
  });

  it('правка названия помечает dirty и сохраняется с revalidate', async () => {
    api.getAdminService.mockResolvedValue(svc());
    api.updateAdminService.mockResolvedValue(svc({ title: 'Новое' }));
    render(<ServiceEditor serviceId="s-1" />);
    await screen.findByLabelText('Название');
    expect(screen.getByText('Все изменения сохранены')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Новое имя' } });
    expect(screen.getByText('Есть несохранённые изменения')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(api.updateAdminService).toHaveBeenCalledWith('s-1', expect.objectContaining({ title: 'Новое имя' }), 'jwt'));
    await waitFor(() => expect(revalidate.revalidateCatalog).toHaveBeenCalled());
  });

  it('смена slug предупреждает об изменении адреса', async () => {
    api.getAdminService.mockResolvedValue(svc());
    render(<ServiceEditor serviceId="s-1" />);
    await screen.findByLabelText('Slug (адрес)');
    fireEvent.change(screen.getByLabelText('Slug (адрес)'), { target: { value: 'standart-new' } });
    expect(screen.getByText(/Изменится публичный адрес/)).toBeTruthy();
  });

  it('калькулятор подключён: read-only + ссылка в Прайсы, поля цены нет', async () => {
    api.getAdminService.mockResolvedValue(svc({ calculator: { definitionId: 'def-9', code: 'business-cards', title: 'Визитки' } }));
    render(<ServiceEditor serviceId="s-1" />);
    await screen.findByLabelText('Название');
    expect(screen.getByText(/Калькулятор подключён/)).toBeTruthy();
    const link = screen.getByRole('link', { name: /Управление прайсом/ });
    expect(link.getAttribute('href')).toMatch(/^\/admin\/pricing\/def-9\/?$/);
    // Нет поля редактирования цены.
    expect(screen.queryByLabelText(/Цена/)).toBeNull();
  });

  it('калькулятор не подключён: понятное сообщение', async () => {
    api.getAdminService.mockResolvedValue(svc({ calculator: null }));
    render(<ServiceEditor serviceId="s-1" />);
    await screen.findByLabelText('Название');
    expect(screen.getByText('Калькулятор не подключён.')).toBeTruthy();
  });
});
