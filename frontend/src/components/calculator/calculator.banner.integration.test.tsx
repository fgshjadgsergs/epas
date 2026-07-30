// @vitest-environment jsdom
/**
 * Интеграционные тесты реального Calculator для «Баннеров»: definition-driven
 * рендер, decimal-размеры, видимость lugstep, derived-метрики сервера в UI,
 * URL и production-fallback.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Calculator } from './calculator';
import { useCart } from '@/lib/cart/store';
import type { CalculatorDefinitionDto, DerivedMetricDto } from '@/lib/api/calculator';

const getDefinitionMock = vi.hoisted(() => vi.fn());
const postCalculateMock = vi.hoisted(() => vi.fn());
const postConfirmMock = vi.hoisted(() => vi.fn());
const routerPushMock = vi.hoisted(() => vi.fn());
const addCartItemMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/calculator', () => ({
  getCalculatorDefinition: getDefinitionMock,
  postCalculate: postCalculateMock,
  postConfirmCalculation: postConfirmMock,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: routerPushMock }) }));
// Добавление в корзину идёт через серверный Cart API — мокаем его, чтобы
// проверять именно вход калькулятора (snapshotId), а не сеть.
vi.mock('@/lib/api/cart', () => ({
  getCart: addCartItemMock,
  addCartItem: addCartItemMock,
  removeCartItem: addCartItemMock,
  clearCart: addCartItemMock,
  mergeCart: addCartItemMock,
  refreshCartItem: addCartItemMock,
}));

function param(
  overrides: Partial<CalculatorDefinitionDto['parameters'][number]>,
): CalculatorDefinitionDto['parameters'][number] {
  return {
    urlKey: 'x',
    label: 'x',
    type: 'SEGMENTED',
    unit: null,
    min: null,
    max: null,
    step: null,
    default: null,
    required: true,
    shareable: true,
    visibleIf: null,
    options: [],
    ...overrides,
  };
}

function makeBannerDefinition(): CalculatorDefinitionDto {
  const opt = (value: string, label: string, isDefault = false) => ({ value, label, isDefault, meta: null });
  return {
    serviceSlug: 'bannery',
    code: 'banner-print',
    title: 'Баннеры',
    version: 1,
    pricingMode: 'AREA',
    urlOrder: ['w', 'h', 'material', 'lugs', 'lugstep', 'hem', 'qty', 'express'],
    qty: { min: 1, max: 10, step: 1, default: 1 },
    preset: null,
    parameters: [
      param({ urlKey: 'w', label: 'Ширина', type: 'DIMENSION', unit: 'м', min: 0.5, max: 5, step: 0.05, default: '2' }),
      param({ urlKey: 'h', label: 'Высота', type: 'DIMENSION', unit: 'м', min: 0.5, max: 5, step: 0.05, default: '1' }),
      param({
        urlKey: 'material',
        label: 'Материал',
        type: 'SWATCH',
        default: 'banner-440',
        options: [opt('banner-440', 'Баннер 440 г', true), opt('satin', 'Сатин (ткань)')],
      }),
      param({
        urlKey: 'lugs',
        label: 'Люверсы',
        default: 'with',
        options: [opt('with', 'Каждые 50 см', true), opt('custom', 'Свой шаг'), opt('none', 'Без люверсов')],
      }),
      param({
        urlKey: 'lugstep',
        label: 'Шаг люверсов',
        type: 'DIMENSION',
        unit: 'см',
        min: 20,
        max: 100,
        step: 5,
        default: '50',
        visibleIf: { lugs: 'custom' },
      }),
      param({
        urlKey: 'hem',
        label: 'Обшивка кромок',
        default: 'none',
        options: [opt('none', 'Без обшивки', true), opt('basic', 'Обычная'), opt('thick', 'Усиленная')],
      }),
      param({ urlKey: 'express', label: 'Срочно', type: 'TOGGLE', default: '0', required: false }),
    ],
    compatibility: [],
    upsells: [],
    hasActivePriceList: true,
    calculationVersion: 'banner-print:v1:p1',
  };
}

function makeCalcResponse(amountMinor: number, derived: DerivedMetricDto[]) {
  return {
    serviceSlug: 'bannery',
    normalizedParameters: {},
    quantity: 1,
    price: { amountMinor, currency: 'RUB' },
    unitPrice: { amountMinor, currency: 'RUB' },
    priceWithVat: { amountMinor: Math.round(amountMinor * 1.2), currency: 'RUB' },
    production: { workingDays: 2, readyAt: '2026-07-22', readyDateLabel: 'ср, 22 июля', cutoff: '14:00' },
    appliedUpsells: [],
    derived,
    warnings: [],
    calculationVersion: 'banner-print:v1:p1',
  };
}

const DERIVED: DerivedMetricDto[] = [
  { code: 'area', label: 'Площадь', unit: 'м²', perItem: 2, total: 2 },
  { code: 'perimeter', label: 'Периметр', unit: 'м', perItem: 6, total: 6 },
  { code: 'lug-count', label: 'Люверсы', unit: 'шт', perItem: 12, total: 12 },
];

describe('Calculator «Баннеры» + backend definition (integration)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/shirokoformat/bannery/');
    if (!window.requestAnimationFrame) {
      window.requestAnimationFrame = (cb: FrameRequestCallback) =>
        setTimeout(() => cb(performance.now()), 16) as unknown as number;
      window.cancelAnimationFrame = (id: number) => clearTimeout(id);
    }
    getDefinitionMock.mockReset().mockResolvedValue(makeBannerDefinition());
    postCalculateMock.mockReset().mockResolvedValue(makeCalcResponse(108000, DERIVED));
    postConfirmMock.mockReset().mockResolvedValue({
      snapshotId: 'snap-banner',
      price: { amountMinor: 108000, currency: 'RUB' },
      calculationVersion: 'banner-print:v1:p1',
      normalizedParameters: {},
      upsells: [],
      derived: DERIVED,
    });
    routerPushMock.mockReset();
    addCartItemMock.mockReset().mockResolvedValue({
      id: 'cart-1',
      status: 'ACTIVE',
      currency: 'RUB',
      cartVersion: 1,
      items: [],
      itemCount: 1,
      totals: {
        itemsSubtotal: { amountMinor: 0, currency: 'RUB' },
        discounts: { amountMinor: 0, currency: 'RUB' },
        total: { amountMinor: 0, currency: 'RUB' },
      },
      canCheckout: false,
    });
    useCart.setState({ cart: null, loading: false, error: null, pending: false });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('рендерит баннеры из definition через binding «bannery», материал с backend', async () => {
    render(<Calculator slug="/shirokoformat/bannery/" name="Баннеры" />);
    expect(await screen.findByText('Сатин (ткань)')).toBeTruthy();
    expect(getDefinitionMock).toHaveBeenCalledWith('bannery');
    const w = screen.getByLabelText('Ширина') as HTMLInputElement;
    expect(w.min).toBe('0.5');
    expect(w.max).toBe('5');
  });

  it('derived-метрики сервера отображаются в UI без собственного расчёта', async () => {
    render(<Calculator slug="/shirokoformat/bannery/" name="Баннеры" />);
    await screen.findByText('Сатин (ткань)');
    // Значения приходят из postCalculate.derived (сервер), не из state.
    expect(await screen.findByText('Периметр', undefined, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByText('6 м')).toBeTruthy();
    expect(screen.getByText('12 шт')).toBeTruthy();
    expect(screen.getByText('2 м²')).toBeTruthy();
  });

  it('lugs управляет видимостью lugstep; скрытый lugstep не попадает в URL и input', async () => {
    render(<Calculator slug="/shirokoformat/bannery/" name="Баннеры" />);
    await screen.findByText('Свой шаг');

    // По умолчанию (Каждые 50 см) шаг скрыт.
    expect(screen.queryByLabelText('Шаг люверсов')).toBeNull();

    fireEvent.click(screen.getByText('Свой шаг'));
    const lugstep = (await screen.findByLabelText('Шаг люверсов')) as HTMLInputElement;
    fireEvent.change(lugstep, { target: { value: '25' } });
    await waitFor(() => expect(window.location.search).toContain('lugstep=25'), { timeout: 3000 });
    expect(window.location.search).toContain('lugs=custom');

    // Без люверсов: lugstep исчезает из UI, URL и тела запроса.
    fireEvent.click(screen.getByText('Без люверсов'));
    expect(screen.queryByLabelText('Шаг люверсов')).toBeNull();
    await waitFor(() => expect(window.location.search).not.toContain('lugstep'), { timeout: 3000 });
    await waitFor(() => {
      const lastBody = postCalculateMock.mock.calls.at(-1)?.[1];
      expect(lastBody.parameters.lugstep).toBeUndefined();
      expect(lastBody.parameters.lugs).toBe('none');
    });
  });

  it('decimal-размеры: w=1.5 уходит в расчёт и сериализуется с точкой', async () => {
    render(<Calculator slug="/shirokoformat/bannery/" name="Баннеры" />);
    await screen.findByText('Сатин (ткань)');
    fireEvent.change(screen.getByLabelText('Ширина'), { target: { value: '1.5' } });
    await waitFor(() => expect(window.location.search).toContain('w=1.5'), { timeout: 3000 });
    await waitFor(() => {
      const lastBody = postCalculateMock.mock.calls.at(-1)?.[1];
      expect(lastBody.parameters.w).toBe(1.5);
    });
  });

  it('confirm отправляет тот же вход, что и preview', async () => {
    render(<Calculator slug="/shirokoformat/bannery/" name="Баннеры" />);
    await screen.findByText('Сатин (ткань)');
    const checkoutButton = screen.getByRole('button', { name: /Загрузить макет и заказать/ });
    await waitFor(() => expect(checkoutButton.hasAttribute('disabled')).toBe(false), { timeout: 3000 });

    fireEvent.click(checkoutButton);
    await waitFor(() => expect(postConfirmMock).toHaveBeenCalledTimes(1));
    const previewBody = postCalculateMock.mock.calls.at(-1)?.[1];
    const confirmBody = postConfirmMock.mock.calls[0][1];
    expect(confirmBody.parameters).toEqual(previewBody.parameters);
    expect(postConfirmMock.mock.calls[0][0]).toBe('bannery');
  });

  it('production без definition: заглушка недоступности, заказ закрыт', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    getDefinitionMock.mockRejectedValue(new Error('offline'));
    render(<Calculator slug="/shirokoformat/bannery/" name="Баннеры" />);
    expect(await screen.findByText('Онлайн-расчёт временно недоступен')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Загрузить макет и заказать/ })).toBeNull();
  });
});
