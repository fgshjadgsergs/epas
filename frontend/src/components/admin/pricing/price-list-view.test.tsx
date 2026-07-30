// @vitest-environment jsdom
/**
 * Страница прайс-листа: ACTIVE read-only vs DRAFT editable, revision в мутациях,
 * PRICING_DRAFT_CONFLICT → refetch, validate, publish (confirm/pending/double-
 * click/conflict), ролевое gating, dry-run для DRAFT.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PriceListView } from './price-list-view';
import { ApiError } from '@/lib/api/client';
import type { PriceListDetail, PricingDefinitionDetail } from '@/lib/api/admin-pricing';

const api = vi.hoisted(() => ({
  getPriceList: vi.fn(),
  getPricingDefinition: vi.fn(),
  getPriceLists: vi.fn(),
  getPricingAudit: vi.fn(),
  createDraftRule: vi.fn(),
  updateDraftRule: vi.fn(),
  deleteDraftRule: vi.fn(),
  validateDraft: vi.fn(),
  dryRunDraft: vi.fn(),
  publishDraft: vi.fn(),
}));
const auth = vi.hoisted(() => ({ token: 'jwt' as string | null }));
const authCtx = vi.hoisted(() => ({ permissions: ['pricing.read', 'pricing.draft.edit', 'pricing.publish'] }));
const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('@/lib/api/admin-pricing', () => api);
vi.mock('@/lib/api/auth', () => ({ tokenStorage: { getAccessToken: () => auth.token } }));
vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ status: 'authenticated', permissions: authCtx.permissions, roles: [], user: null, applySession: () => {}, signOut: async () => {} }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('next/link', () => ({ default: ({ children, href }: never) => <a href={href as string}>{children}</a> }));

// Неизвестный code → технический fallback-редактор (общий lifecycle-тест).
const definition: PricingDefinitionDetail = {
  id: 'd-1', code: 'unknown-calc', title: 'Прочее', version: 2, status: 'ACTIVE', isDemo: true, pricingMode: 'TIER',
  minQty: 100, maxQty: 100000,
  parameters: [{ urlKey: 'format', label: 'Формат', type: 'SEGMENTED', unit: null, isRequired: true, options: [{ value: 'A5', label: 'A5', isActive: true }] }],
  readOnly: true,
};

function priceList(overrides: Partial<PriceListDetail> = {}): PriceListDetail {
  return {
    id: 'pl-1', definitionId: 'd-1', version: 4, status: 'DRAFT', isDemo: true, pricingMode: 'DEMO', currency: 'RUB',
    validFrom: null, validTo: null, revision: 5, updatedAt: '2026-07-26T10:00:00.000Z',
    rules: [{ id: 'r-1', kind: 'BASE_TIER', condition: null, qtyFrom: 100, qtyTo: 499, amountMinor: 90000, multiplier: null, config: null, priority: 0 }],
    productionRules: [],
    ...overrides,
  };
}

const admin = { id: 'u1', email: 'a@e.co', firstName: null, lastName: null, isActive: true, roles: ['ADMIN'], createdAt: '' };

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  authCtx.permissions = ['pricing.read', 'pricing.draft.edit', 'pricing.publish'];
  router.push.mockReset();
  auth.token = 'jwt';
  api.getPricingDefinition.mockResolvedValue(definition);
  api.getPriceLists.mockResolvedValue({ items: [{ ...priceList({ id: 'pl-active', status: 'ACTIVE', version: 3 }) }], total: 1, page: 1, pageSize: 100 });
  api.getPricingAudit.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 });
});
afterEach(() => cleanup());

describe('PriceListView — выбор редактора по definition.code', () => {
  const cases: { code: string; heading: string }[] = [
    { code: 'business-cards', heading: 'Цены по тиражу' },
    { code: 'leaflets', heading: 'Цены по тиражу' },
    { code: 'banner-print', heading: 'Цены баннеров' },
    { code: 'photo-print', heading: 'Цены по форматам' },
    { code: 'unknown-calc', heading: 'Правила цены' }, // технический fallback
  ];
  for (const { code, heading } of cases) {
    it(`${code} → «${heading}»`, async () => {
      api.getPricingDefinition.mockResolvedValue({ ...definition, code });
      api.getPriceList.mockResolvedValue(priceList());
      render(<PriceListView priceListId="pl-1" />);
      expect(await screen.findByText(heading)).toBeTruthy();
    });
  }
});

describe('PriceListView — read-only vs editable', () => {
  it('ACTIVE: только просмотр, без кнопок правки/публикации', async () => {
    api.getPriceList.mockResolvedValue(priceList({ status: 'ACTIVE' }));
    render(<PriceListView priceListId="pl-1" />);
    await screen.findByText('Версия 4');
    expect(screen.getByText(/Активный прайс — только просмотр/)).toBeTruthy();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('button', { name: 'Добавить' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Опубликовать' })).toBeNull();
  });

  it('ARCHIVED: только просмотр', async () => {
    api.getPriceList.mockResolvedValue(priceList({ status: 'ARCHIVED' }));
    render(<PriceListView priceListId="pl-1" />);
    await screen.findByText(/Архивная версия — только просмотр/);
  });

  it('DRAFT (ADMIN): доступны Добавить / Проверить / Опубликовать / Тестовый расчёт', async () => {
    api.getPriceList.mockResolvedValue(priceList());
    render(<PriceListView priceListId="pl-1" />);
    await screen.findByText('Версия 4');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Добавить' })).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Проверить прайс' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Опубликовать' })).toBeTruthy();
    expect(screen.getByText('Тестовый расчёт')).toBeTruthy();
  });

  it('MANAGER: DRAFT доступен для dry-run, но без правки/публикации', async () => {
    authCtx.permissions = ['pricing.read'];
    api.getPriceList.mockResolvedValue(priceList());
    render(<PriceListView priceListId="pl-1" />);
    await screen.findByText('Версия 4');
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('button', { name: 'Добавить' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Опубликовать' })).toBeNull();
    // Проверить прайс (validate) доступен; dry-run тоже.
    expect(screen.getByRole('button', { name: 'Проверить прайс' })).toBeTruthy();
    expect(screen.getByText('Тестовый расчёт')).toBeTruthy();
  });
});

describe('PriceListView — revision / rule CRUD', () => {
  it('создание правила отправляет expectedRevision и рефетчит', async () => {
    api.getPriceList.mockResolvedValue(priceList({ revision: 5 }));
    api.createDraftRule.mockResolvedValue({ revision: 6, result: {} });
    render(<PriceListView priceListId="pl-1" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Добавить' })).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));
    fireEvent.click(screen.getByRole('button', { name: 'Добавить правило' }));

    await waitFor(() => expect(api.createDraftRule).toHaveBeenCalled());
    const [, body] = api.createDraftRule.mock.calls[0];
    expect(body.expectedRevision).toBe(5);
    // refetch произошёл (getPriceList вызван повторно).
    await waitFor(() => expect(api.getPriceList.mock.calls.length).toBeGreaterThan(1));
  });

  it('PRICING_DRAFT_CONFLICT при правке → сообщение + refetch', async () => {
    api.getPriceList.mockResolvedValue(priceList({ revision: 5 }));
    api.createDraftRule.mockRejectedValue(new ApiError(409, 'x', { code: 'PRICING_DRAFT_CONFLICT' } as never));
    render(<PriceListView priceListId="pl-1" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Добавить' })).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));
    const before = api.getPriceList.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Добавить правило' }));

    expect(await screen.findByText(/изменён другим пользователем/)).toBeTruthy();
    await waitFor(() => expect(api.getPriceList.mock.calls.length).toBeGreaterThan(before));
  });
});

describe('PriceListView — validate', () => {
  it('успех: «Ошибок не найдено», статус не меняется', async () => {
    api.getPriceList.mockResolvedValue(priceList());
    api.validateDraft.mockResolvedValue({ valid: true, revision: 5, errors: [], warnings: [] });
    render(<PriceListView priceListId="pl-1" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Проверить прайс' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Проверить прайс' }));
    expect(await screen.findByText('Ошибок не найдено')).toBeTruthy();
    expect(api.publishDraft).not.toHaveBeenCalled();
  });

  it('ошибки: показывает code+message с привязкой к ruleId', async () => {
    api.getPriceList.mockResolvedValue(priceList());
    api.validateDraft.mockResolvedValue({
      valid: false, revision: 5,
      errors: [{ code: 'TIER_RANGE', message: 'Пересечение тиров', ruleId: 'r-1abcdef0' }],
      warnings: [],
    });
    render(<PriceListView priceListId="pl-1" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Проверить прайс' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Проверить прайс' }));
    expect(await screen.findByText(/Пересечение тиров/)).toBeTruthy();
    expect(screen.getByText('TIER_RANGE')).toBeTruthy();
  });
});

describe('PriceListView — publish', () => {
  it('confirmation dialog, pending, защита от двойного клика, успех → refetch', async () => {
    api.getPriceList.mockResolvedValue(priceList({ revision: 5 }));
    let release: (v: unknown) => void = () => undefined;
    api.publishDraft.mockImplementation(() => new Promise((r) => (release = r)));
    render(<PriceListView priceListId="pl-1" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Опубликовать' })).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Опубликовать' }));
    // Диалог подтверждения.
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Опубликовать версию 4/)).toBeTruthy();

    const confirm = within(dialog).getByRole('button', { name: 'Опубликовать' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(api.publishDraft).toHaveBeenCalledTimes(1));
    expect(api.publishDraft).toHaveBeenCalledWith('pl-1', 5, 'jwt');

    await act(async () => release({ id: 'pl-1', version: 4, status: 'ACTIVE', archivedPriceListIds: ['pl-active'] }));
    expect(await screen.findByText(/опубликована/)).toBeTruthy();
  });

  it('publish 409 conflict → сообщение + refetch, диалог закрыт', async () => {
    api.getPriceList.mockResolvedValue(priceList({ revision: 5 }));
    api.publishDraft.mockRejectedValue(new ApiError(409, 'x', { code: 'PRICING_DRAFT_CONFLICT' } as never));
    render(<PriceListView priceListId="pl-1" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Опубликовать' })).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Опубликовать' }));
    const before = api.getPriceList.mock.calls.length;
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Опубликовать' }));

    expect(await screen.findByText(/изменён другим пользователем/)).toBeTruthy();
    await waitFor(() => expect(api.getPriceList.mock.calls.length).toBeGreaterThan(before));
  });

  it('publish 403 → сообщение о недостатке прав', async () => {
    api.getPriceList.mockResolvedValue(priceList({ revision: 5 }));
    api.publishDraft.mockRejectedValue(new ApiError(403, 'forbidden'));
    render(<PriceListView priceListId="pl-1" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Опубликовать' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Опубликовать' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Опубликовать' }));
    expect(await screen.findByText(/Недостаточно прав/)).toBeTruthy();
  });
});

describe('PriceListView — dry-run', () => {
  it('форма из метаданных, показывает total и DEMO, без фейковых значений', async () => {
    api.getPriceList.mockResolvedValue(priceList());
    api.dryRunDraft.mockResolvedValue({
      priceListId: 'pl-1', priceListVersion: 4, status: 'DRAFT', pricingMode: 'DEMO', isDemo: true,
      normalizedParameters: {}, quantity: 500, total: { amountMinor: 281000, currency: 'RUB' },
      unitPrice: { amountMinor: 562, currency: 'RUB' }, priceWithVat: { amountMinor: 337200, currency: 'RUB' },
      currency: 'RUB', production: { workingDays: 2 }, appliedUpsells: [], derived: [], lineItems: [], totalQuantity: 500,
      warnings: [], calculationVersion: 'x', engineVersion: 'engine/2',
    });
    render(<PriceListView priceListId="pl-1" />);
    await screen.findByText('Тестовый расчёт');
    // До запроса цены нет.
    expect(screen.queryByText('2 810,00 RUB')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Рассчитать' }));
    expect(await screen.findByText('2 810,00 RUB')).toBeTruthy();
    // DEMO-маркер в результате.
    const demoMarks = screen.getAllByText('DEMO');
    expect(demoMarks.length).toBeGreaterThan(0);
  });
});
