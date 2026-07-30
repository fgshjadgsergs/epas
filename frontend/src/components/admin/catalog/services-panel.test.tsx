// @vitest-environment jsdom
/**
 * ServicesPanel: список с категорией и индикатором калькулятора, фильтр по
 * категории, поиск, открытие диалога создания. Цена здесь не редактируется.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServicesPanel } from './services-panel';
import type { AdminCategory, AdminService } from '@/lib/api/admin-catalog';

const api = vi.hoisted(() => ({ getAdminServices: vi.fn(), getAdminCategories: vi.fn(), createAdminService: vi.fn() }));
const auth = vi.hoisted(() => ({ token: 'jwt' as string | null }));

vi.mock('@/lib/api/admin-catalog', () => api);
vi.mock('@/lib/catalog/revalidate', () => ({ revalidateCatalog: vi.fn() }));
vi.mock('@/lib/api/auth', () => ({ tokenStorage: { getAccessToken: () => auth.token } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const catA: AdminCategory = { id: 'cat-a', parentId: null, slug: 'a', title: 'Визитки', description: null, isActive: true, sortOrder: 0, createdAt: '', updatedAt: '', serviceCount: 1, childrenCount: 0 };
const catB: AdminCategory = { ...catA, id: 'cat-b', slug: 'b', title: 'Листовки' };

function svc(overrides: Partial<AdminService> = {}): AdminService {
  return {
    id: 's-1', categoryId: 'cat-a', slug: 'standart', title: 'Стандартные визитки', shortDescription: null, description: null,
    isActive: true, sortOrder: 0, createdAt: '', updatedAt: '2026-07-02T00:00:00.000Z',
    category: { id: 'cat-a', title: 'Визитки', slug: 'a' }, calculator: null, images: [], ...overrides,
  };
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  auth.token = 'jwt';
  api.getAdminCategories.mockResolvedValue([catA, catB]);
});
afterEach(() => cleanup());

describe('ServicesPanel', () => {
  it('показывает услугу, категорию и индикатор калькулятора', async () => {
    api.getAdminServices.mockResolvedValue([
      svc({ id: 's-1', title: 'С калькулятором', calculator: { definitionId: 'd1', code: 'business-cards', title: 'Визитки' } }),
      svc({ id: 's-2', title: 'Без калькулятора', slug: 'plain' }),
    ]);
    render(<ServicesPanel />);
    expect(await screen.findAllByText('С калькулятором')).not.toHaveLength(0);
    expect(screen.getAllByText('Подключён').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Нет').length).toBeGreaterThan(0);
  });

  it('фильтр по категории скрывает чужие услуги', async () => {
    api.getAdminServices.mockResolvedValue([
      svc({ id: 's-1', title: 'Визиточная', categoryId: 'cat-a', category: { id: 'cat-a', title: 'Визитки', slug: 'a' } }),
      svc({ id: 's-2', title: 'Листовочная', categoryId: 'cat-b', category: { id: 'cat-b', title: 'Листовки', slug: 'b' } }),
    ]);
    render(<ServicesPanel />);
    await screen.findAllByText('Визиточная');
    fireEvent.change(screen.getByLabelText('Категория'), { target: { value: 'cat-b' } });
    await waitFor(() => expect(screen.queryAllByText('Визиточная')).toHaveLength(0));
    expect(screen.getAllByText('Листовочная').length).toBeGreaterThan(0);
  });

  it('поиск фильтрует по названию', async () => {
    api.getAdminServices.mockResolvedValue([svc({ id: 's-1', title: 'Матовые' }), svc({ id: 's-2', title: 'Глянцевые', slug: 'gloss' })]);
    render(<ServicesPanel />);
    await screen.findAllByText('Матовые');
    fireEvent.change(screen.getByLabelText('Поиск'), { target: { value: 'глян' } });
    await waitFor(() => expect(screen.queryAllByText('Матовые')).toHaveLength(0));
    expect(screen.getAllByText('Глянцевые').length).toBeGreaterThan(0);
  });

  it('«Услуга» открывает диалог создания без поля цены', async () => {
    api.getAdminServices.mockResolvedValue([svc()]);
    render(<ServicesPanel />);
    await screen.findAllByText('Стандартные визитки');
    fireEvent.click(screen.getByRole('button', { name: /Услуга/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Новая услуга' });
    // Цена управляется Pricing — в форме её нет.
    expect(dialog.textContent).not.toMatch(/Цена|priceFrom|руб/i);
  });
});
