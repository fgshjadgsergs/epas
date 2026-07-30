// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PricingDefinitionView } from './pricing-definition-view';
import { ApiError } from '@/lib/api/client';
import type { Paginated, PriceListSummary, PricingDefinitionDetail } from '@/lib/api/admin-pricing';

const api = vi.hoisted(() => ({
  getPricingDefinition: vi.fn(),
  getPriceLists: vi.fn(),
  clonePriceListDraft: vi.fn(),
}));
const authCtx = vi.hoisted(() => ({ permissions: ['pricing.read', 'pricing.draft.edit'] }));
const auth = vi.hoisted(() => ({ token: 'jwt' as string | null }));
const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('@/lib/api/admin-pricing', () => api);
vi.mock('@/lib/api/auth', () => ({ tokenStorage: { getAccessToken: () => auth.token } }));
vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ status: 'authenticated', permissions: authCtx.permissions, roles: [], user: null, applySession: () => {}, signOut: async () => {} }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('next/link', () => ({ default: ({ children, href }: never) => <a href={href as string}>{children}</a> }));

const definition: PricingDefinitionDetail = {
  id: 'd-1',
  code: 'leaflets',
  title: 'Листовки',
  version: 2,
  status: 'ACTIVE',
  isDemo: true,
  pricingMode: 'TIER',
  minQty: 100,
  maxQty: 100000,
  parameters: [
    { urlKey: 'format', label: 'Формат', type: 'SEGMENTED', unit: null, isRequired: true, options: [{ value: 'A5', label: 'A5', isActive: true }] },
  ],
  readOnly: true,
};

function priceLists(overrides: Partial<Paginated<PriceListSummary>> = {}): Paginated<PriceListSummary> {
  return {
    items: [
      { id: 'pl-active', definitionId: 'd-1', version: 3, status: 'ACTIVE', isDemo: true, pricingMode: 'DEMO', currency: 'RUB', validFrom: null, validTo: null, revision: 0, updatedAt: '2026-07-26T10:00:00.000Z' },
      { id: 'pl-arch', definitionId: 'd-1', version: 2, status: 'ARCHIVED', isDemo: true, pricingMode: 'DEMO', currency: 'RUB', validFrom: null, validTo: null, revision: 0, updatedAt: '2026-07-25T10:00:00.000Z' },
    ],
    total: 2,
    page: 1,
    pageSize: 20,
    ...overrides,
  };
}


beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  authCtx.permissions = ['pricing.read', 'pricing.draft.edit'];
  router.push.mockReset();
  auth.token = 'jwt';
  api.getPricingDefinition.mockResolvedValue(definition);
});
afterEach(() => cleanup());

describe('PricingDefinitionView', () => {
  it('показывает историю версий со статусами и read-only параметры', async () => {
    api.getPriceLists.mockResolvedValue(priceLists());
    render(<PricingDefinitionView definitionId="d-1" />);
    expect(await screen.findByText('Версия 3')).toBeTruthy();
    expect(screen.getByText('Версия 2')).toBeTruthy();
    expect(screen.getByText('Активный')).toBeTruthy();
    expect(screen.getByText('Архив')).toBeTruthy();
    expect(screen.getByText(/Параметры калькулятора \(read-only\)/)).toBeTruthy();
  });

  it('ADMIN видит «Создать черновик» на ACTIVE; clone ведёт на новый DRAFT', async () => {
    api.getPriceLists.mockResolvedValue(priceLists());
    api.clonePriceListDraft.mockResolvedValue({ id: 'pl-draft', version: 4, status: 'DRAFT' });
    render(<PricingDefinitionView definitionId="d-1" />);
    await screen.findByText('Версия 3');
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Создать черновик' }).length).toBeGreaterThan(0));

    fireEvent.click(screen.getAllByRole('button', { name: 'Создать черновик' })[0]);
    await waitFor(() => expect(api.clonePriceListDraft).toHaveBeenCalledWith('pl-active', 'jwt'));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/admin/pricing/price-lists/pl-draft/'));
  });

  it('PRICING_DRAFT_EXISTS: не создаёт второй, показывает ссылку на черновик', async () => {
    api.getPriceLists.mockResolvedValue(priceLists());
    api.clonePriceListDraft.mockRejectedValue(new ApiError(409, 'Уже есть черновик', { code: 'PRICING_DRAFT_EXISTS', draftId: 'pl-existing' } as never));
    render(<PricingDefinitionView definitionId="d-1" />);
    await screen.findByText('Версия 3');
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Создать черновик' }).length).toBeGreaterThan(0));

    fireEvent.click(screen.getAllByRole('button', { name: 'Создать черновик' })[0]);
    expect(await screen.findByRole('link', { name: 'Открыть черновик' })).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('MANAGER не видит «Создать черновик»', async () => {
    authCtx.permissions = ['pricing.read'];
    api.getPriceLists.mockResolvedValue(priceLists());
    render(<PricingDefinitionView definitionId="d-1" />);
    await screen.findByText('Версия 3');
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('button', { name: 'Создать черновик' })).toBeNull();
  });

  it('если уже есть DRAFT — кнопка клона заблокирована', async () => {
    api.getPriceLists.mockResolvedValue(
      priceLists({
        items: [
          { id: 'pl-active', definitionId: 'd-1', version: 3, status: 'ACTIVE', isDemo: true, pricingMode: 'DEMO', currency: 'RUB', validFrom: null, validTo: null, revision: 0, updatedAt: '2026-07-26T10:00:00.000Z' },
          { id: 'pl-draft', definitionId: 'd-1', version: 4, status: 'DRAFT', isDemo: true, pricingMode: 'DEMO', currency: 'RUB', validFrom: null, validTo: null, revision: 1, updatedAt: '2026-07-26T11:00:00.000Z' },
        ],
        total: 2,
      }),
    );
    render(<PricingDefinitionView definitionId="d-1" />);
    await screen.findByText('Версия 3');
    await waitFor(() => {
      const btn = screen.getAllByRole('button', { name: 'Создать черновик' })[0];
      expect(btn.hasAttribute('disabled')).toBe(true);
    });
  });
});
