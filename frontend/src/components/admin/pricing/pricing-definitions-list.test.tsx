// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PricingDefinitionsList } from './pricing-definitions-list';
import { ApiError } from '@/lib/api/client';
import type { Paginated, PricingDefinitionSummary } from '@/lib/api/admin-pricing';

const api = vi.hoisted(() => ({ getPricingDefinitions: vi.fn() }));
const auth = vi.hoisted(() => ({ token: 'jwt' as string | null }));

vi.mock('@/lib/api/admin-pricing', () => api);
vi.mock('@/lib/api/auth', () => ({ tokenStorage: { getAccessToken: () => auth.token } }));
vi.mock('next/link', () => ({ default: ({ children, href }: never) => <a href={href as string}>{children}</a> }));

function makePage(overrides: Partial<Paginated<PricingDefinitionSummary>> = {}): Paginated<PricingDefinitionSummary> {
  return {
    items: [
      { id: 'd-1', code: 'leaflets', title: 'Листовки', version: 2, status: 'ACTIVE', isDemo: true, pricingMode: 'TIER', priceListCount: 3 },
    ],
    total: 1,
    page: 1,
    pageSize: 20,
    ...overrides,
  };
}

beforeEach(() => {
  api.getPricingDefinitions.mockReset();
  auth.token = 'jwt';
});
afterEach(() => cleanup());

describe('PricingDefinitionsList', () => {
  it('loading → data: показывает калькулятор, версии и DEMO', async () => {
    api.getPricingDefinitions.mockResolvedValue(makePage());
    render(<PricingDefinitionsList />);
    expect(await screen.findAllByText('Листовки')).not.toHaveLength(0);
    expect(screen.getAllByText('leaflets').length).toBeGreaterThan(0);
    expect(screen.getAllByText('DEMO').length).toBeGreaterThan(0);
  });

  it('empty', async () => {
    api.getPricingDefinitions.mockResolvedValue(makePage({ items: [], total: 0 }));
    render(<PricingDefinitionsList />);
    expect(await screen.findByText('Калькуляторов нет')).toBeTruthy();
  });

  it('error + retry', async () => {
    api.getPricingDefinitions.mockRejectedValueOnce(new ApiError(500, 'сбой'));
    render(<PricingDefinitionsList />);
    expect(await screen.findByText('Не удалось загрузить прайсы')).toBeTruthy();
    api.getPricingDefinitions.mockResolvedValueOnce(makePage());
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(await screen.findAllByText('Листовки')).not.toHaveLength(0);
  });

  it('403 → нет доступа, 401 → сессия истекла', async () => {
    api.getPricingDefinitions.mockRejectedValue(new ApiError(403, 'forbidden'));
    render(<PricingDefinitionsList />);
    expect(await screen.findByText('Нет доступа')).toBeTruthy();
    cleanup();
    api.getPricingDefinitions.mockReset().mockRejectedValue(new ApiError(401, 'x'));
    render(<PricingDefinitionsList />);
    expect(await screen.findByText('Сессия истекла')).toBeTruthy();
  });

  it('pagination: «Вперёд» грузит следующую страницу', async () => {
    api.getPricingDefinitions.mockResolvedValue(makePage({ total: 40, pageSize: 20, page: 1 }));
    render(<PricingDefinitionsList />);
    await screen.findAllByText('Листовки');
    fireEvent.click(screen.getByRole('button', { name: 'Вперёд' }));
    await waitFor(() =>
      expect(api.getPricingDefinitions).toHaveBeenCalledWith('jwt', { page: 2, pageSize: 20 }),
    );
  });
});
