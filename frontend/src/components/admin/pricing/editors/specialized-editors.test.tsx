// @vitest-environment jsdom
/**
 * Специализированные редакторы цен: human labels, create/update/delete, безопасные
 * деньги, revision-цепочка, конфликт, подсветка ошибок валидации, MANAGER read-only.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TierEditor } from './tier-editor';
import { MetricEditor } from './metric-editor';
import { MultiQtyEditor } from './multi-qty-editor';
import { ApiError } from '@/lib/api/client';
import type { PriceRuleView, PricingDefinitionDetail } from '@/lib/api/admin-pricing';

const api = vi.hoisted(() => ({ createDraftRule: vi.fn(), updateDraftRule: vi.fn(), deleteDraftRule: vi.fn() }));
const auth = vi.hoisted(() => ({ token: 'jwt' as string | null }));
vi.mock('@/lib/api/admin-pricing', () => api);
vi.mock('@/lib/api/auth', () => ({ tokenStorage: { getAccessToken: () => auth.token } }));

const tierDef = {
  id: 'd', code: 'leaflets', title: 'Листовки', version: 1, status: 'ACTIVE', isDemo: true, pricingMode: 'TIER', minQty: 100, maxQty: 100000,
  parameters: [
    { urlKey: 'paper', label: 'Бумага', type: 'SWATCH', unit: null, isRequired: false, options: [{ value: 'design', label: 'Дизайнерская', isActive: true }] },
  ],
  readOnly: true as const,
} satisfies PricingDefinitionDetail;

const bannerDef = {
  id: 'd', code: 'banner-print', title: 'Баннеры', version: 1, status: 'ACTIVE', isDemo: true, pricingMode: 'AREA', minQty: 1, maxQty: 1000,
  parameters: [
    { urlKey: 'material', label: 'Материал', type: 'SWATCH', unit: null, isRequired: false, options: [{ value: 'satin', label: 'Сатин', isActive: true }] },
    { urlKey: 'lugs', label: 'Люверсы', type: 'SEGMENTED', unit: null, isRequired: false, options: [{ value: 'with', label: 'С люверсами', isActive: true }] },
  ],
  readOnly: true as const,
} satisfies PricingDefinitionDetail;

const photoDef = {
  id: 'd', code: 'photo-print', title: 'Фотопечать', version: 1, status: 'ACTIVE', isDemo: true, pricingMode: 'TIER', minQty: 1, maxQty: 10000,
  parameters: [
    { urlKey: 'formats', label: 'Форматы', type: 'MULTI_QTY', unit: null, isRequired: true, options: [{ value: '10x15', label: '10×15', isActive: true }, { value: '20x30', label: '20×30', isActive: true }] },
  ],
  readOnly: true as const,
} satisfies PricingDefinitionDetail;

const rule = (o: Partial<PriceRuleView>): PriceRuleView => ({ id: 'r', kind: 'BASE_TIER', condition: null, qtyFrom: null, qtyTo: null, amountMinor: null, multiplier: null, config: null, priority: 0, ...o });

const baseProps = { priceListId: 'pl-1', revision: 5, reload: vi.fn(), errorRuleIds: new Set<string>(), currency: 'RUB' };

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  baseProps.reload = vi.fn();
  auth.token = 'jwt';
});
afterEach(() => cleanup());

describe('TierEditor', () => {
  const tierRules = [
    rule({ id: 't1', kind: 'BASE_TIER', qtyFrom: 100, qtyTo: 499, amountMinor: 90000, priority: 0 }),
    rule({ id: 't2', kind: 'BASE_TIER', qtyFrom: 500, qtyTo: null, amountMinor: 42000, priority: 1 }),
    rule({ id: 'm1', kind: 'MULTIPLIER', condition: { paper: 'design' }, multiplier: 1.25, priority: 10 }),
  ];

  it('рендерит строки тиража с рублёвой ценой и человекочитаемый множитель (read-only для MANAGER)', () => {
    render(<TierEditor {...baseProps} rules={tierRules} definition={tierDef} canEdit={false} />);
    const rows = screen.getAllByTestId('tier-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('900,00'); // ru-RU: запятая
    expect(rows[0].textContent).toContain('RUB');
    // MANAGER: без полей ввода/кнопок.
    expect(screen.queryByRole('button', { name: /Добавить строку тиража/ })).toBeNull();
    expect(screen.getByText('Бумага: Дизайнерская')).toBeTruthy();
  });

  it('ADMIN: правка цены → dirty → Save шлёт update с expectedRevision, деньги целые', async () => {
    api.updateDraftRule.mockResolvedValue({ revision: 6, result: {} });
    render(<TierEditor {...baseProps} rules={tierRules} definition={tierDef} canEdit={true} />);

    const priceInputs = screen.getAllByRole('spinbutton').filter((el) => (el as HTMLInputElement).step === '0.01');
    fireEvent.change(priceInputs[0], { target: { value: '12.5' } });
    expect(await screen.findByText('Есть несохранённые изменения')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Сохранить изменения/ }));
    await waitFor(() => expect(api.updateDraftRule).toHaveBeenCalled());
    const [, ruleId, body] = api.updateDraftRule.mock.calls[0];
    expect(ruleId).toBe('t1');
    expect(body.expectedRevision).toBe(5);
    expect(body.amountMinor).toBe(1250); // 12.5 ₽ → целые копейки
    expect(Number.isInteger(body.amountMinor)).toBe(true);
    await waitFor(() => expect(baseProps.reload).toHaveBeenCalled());
  });

  it('добавляет строку тиража и сохраняет через createDraftRule', async () => {
    api.createDraftRule.mockResolvedValue({ revision: 6, result: {} });
    render(<TierEditor {...baseProps} rules={tierRules} definition={tierDef} canEdit={true} />);
    fireEvent.click(screen.getByRole('button', { name: /Добавить строку тиража/ }));
    fireEvent.click(screen.getByRole('button', { name: /Сохранить изменения/ }));
    await waitFor(() => expect(api.createDraftRule).toHaveBeenCalled());
    expect(api.createDraftRule.mock.calls[0][1].kind).toBe('BASE_TIER');
  });

  it('удаление требует подтверждения и шлёт deleteDraftRule', async () => {
    api.deleteDraftRule.mockResolvedValue({ revision: 6, result: {} });
    render(<TierEditor {...baseProps} rules={tierRules} definition={tierDef} canEdit={true} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Удалить строку тиража' })[0]);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Тираж 100–499/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));
    fireEvent.click(screen.getByRole('button', { name: /Сохранить изменения/ }));
    await waitFor(() => expect(api.deleteDraftRule).toHaveBeenCalledWith('pl-1', 't1', 5, 'jwt'));
  });

  it('конфликт при сохранении показывает сообщение', async () => {
    api.updateDraftRule.mockRejectedValue(new ApiError(409, 'x', { code: 'PRICING_DRAFT_CONFLICT' } as never));
    render(<TierEditor {...baseProps} rules={tierRules} definition={tierDef} canEdit={true} />);
    const priceInputs = screen.getAllByRole('spinbutton').filter((el) => (el as HTMLInputElement).step === '0.01');
    fireEvent.change(priceInputs[0], { target: { value: '99' } });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить изменения/ }));
    expect(await screen.findByText(/изменён другим пользователем/)).toBeTruthy();
  });

  it('ошибка валидации подсвечивает соответствующую строку', () => {
    render(<TierEditor {...baseProps} rules={tierRules} definition={tierDef} canEdit={true} errorRuleIds={new Set(['t2'])} />);
    const rows = screen.getAllByTestId('tier-row');
    // Вторая строка (t2) подсвечена классом danger.
    expect(rows[1].className).toMatch(/danger/);
  });
});

describe('MetricEditor', () => {
  const bannerRules = [
    rule({ id: 's0', kind: 'BASE_PER_SQM', amountMinor: 45000, priority: 0 }),
    rule({ id: 's1', kind: 'BASE_PER_SQM', condition: { material: 'satin' }, amountMinor: 60750, priority: 1 }),
    rule({ id: 'lug', kind: 'SURCHARGE_PER_INTERVAL_COUNT', condition: { lugs: 'with' }, amountMinor: 1500, config: { sourceMetric: 'perimeter', interval: 0.5, intervalUnit: 'cm' }, priority: 5 }),
  ];

  it('показывает цену за м² и метрические доплаты с единицами', () => {
    render(<MetricEditor {...baseProps} rules={bannerRules} definition={bannerDef} canEdit={false} />);
    const rows = screen.getAllByTestId('persqm-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('450,00');
    expect(rows[0].textContent).toContain('RUB/м²');
    expect(screen.getByTestId('surcharge-row')).toBeTruthy();
    expect(screen.getByText(/каждые 0.5 cm/)).toBeTruthy();
  });

  it('ADMIN: правка цены за м² → save update', async () => {
    api.updateDraftRule.mockResolvedValue({ revision: 6, result: {} });
    render(<MetricEditor {...baseProps} rules={bannerRules} definition={bannerDef} canEdit={true} />);
    const priceInputs = screen.getAllByRole('spinbutton').filter((el) => (el as HTMLInputElement).step === '0.01');
    fireEvent.change(priceInputs[0], { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить изменения/ }));
    await waitFor(() => expect(api.updateDraftRule).toHaveBeenCalled());
    expect(api.updateDraftRule.mock.calls[0][2].amountMinor).toBe(50000);
  });

  it('добавляет материал (BASE_PER_SQM)', async () => {
    api.createDraftRule.mockResolvedValue({ revision: 6, result: {} });
    render(<MetricEditor {...baseProps} rules={bannerRules} definition={bannerDef} canEdit={true} />);
    fireEvent.click(screen.getByRole('button', { name: /Добавить материал/ }));
    fireEvent.click(screen.getByRole('button', { name: /Сохранить изменения/ }));
    await waitFor(() => expect(api.createDraftRule).toHaveBeenCalled());
    expect(api.createDraftRule.mock.calls[0][1].kind).toBe('BASE_PER_SQM');
  });
});

describe('MultiQtyEditor', () => {
  const photoRules = [
    rule({ id: 'p1', kind: 'BASE_PER_MULTI_QTY_LINE', qtyFrom: 1, qtyTo: null, amountMinor: 1800, config: { sourceParameter: 'formats', lineKey: '10x15' }, priority: 0 }),
    rule({ id: 'p2', kind: 'BASE_PER_MULTI_QTY_LINE', qtyFrom: 1, qtyTo: null, amountMinor: 7000, config: { sourceParameter: 'formats', lineKey: '20x30' }, priority: 1 }),
  ];

  it('показывает форматы человекочитаемо, диапазоны и цену', () => {
    render(<MultiQtyEditor {...baseProps} rules={photoRules} definition={photoDef} canEdit={false} />);
    const rows = screen.getAllByTestId('multiqty-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('10×15'); // формат человекочитаемо
    expect(rows[0].textContent).toContain('∞'); // открытый диапазон
    expect(rows[0].textContent).toContain('18,00'); // цена ₽
  });

  it('клиентская подсветка пересечения диапазонов одного формата', () => {
    const overlapping = [
      rule({ id: 'p1', kind: 'BASE_PER_MULTI_QTY_LINE', qtyFrom: 1, qtyTo: 100, amountMinor: 1800, config: { sourceParameter: 'formats', lineKey: '10x15' }, priority: 0 }),
      rule({ id: 'p2', kind: 'BASE_PER_MULTI_QTY_LINE', qtyFrom: 50, qtyTo: 200, amountMinor: 1700, config: { sourceParameter: 'formats', lineKey: '10x15' }, priority: 1 }),
    ];
    render(<MultiQtyEditor {...baseProps} rules={overlapping} definition={photoDef} canEdit={true} />);
    expect(screen.getByText(/пересекающиеся диапазоны/)).toBeTruthy();
  });

  it('серверная ошибка (gap) подсвечивает строку по errorRuleIds', () => {
    render(<MultiQtyEditor {...baseProps} rules={photoRules} definition={photoDef} canEdit={true} errorRuleIds={new Set(['p2'])} />);
    const rows = screen.getAllByTestId('multiqty-row');
    expect(rows[1].className).toMatch(/danger/);
  });

  it('create/delete формата', async () => {
    api.createDraftRule.mockResolvedValue({ revision: 6, result: {} });
    render(<MultiQtyEditor {...baseProps} rules={photoRules} definition={photoDef} canEdit={true} />);
    fireEvent.click(screen.getByRole('button', { name: /Добавить формат/ }));
    fireEvent.click(screen.getByRole('button', { name: /Сохранить изменения/ }));
    await waitFor(() => expect(api.createDraftRule).toHaveBeenCalled());
    expect(api.createDraftRule.mock.calls[0][1].kind).toBe('BASE_PER_MULTI_QTY_LINE');
    expect(api.createDraftRule.mock.calls[0][1].config.lineKey).toBe('10x15');
  });
});
