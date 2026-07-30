// @vitest-environment jsdom
/**
 * Интеграционные тесты реального Calculator для «Фотопечати»: MULTI_QTY из
 * backend definition, объект количеств в API, серверная построчная разбивка,
 * URL-сериализация формата «key:qty», восстановление и production-fallback.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Calculator } from './calculator';
import { useCart } from '@/lib/cart/store';
import type { CalculationLineItemDto, CalculatorDefinitionDto } from '@/lib/api/calculator';

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

const PAGE = '/fotopechat/pechat-fotografij/';

function makePhotoDefinition(): CalculatorDefinitionDto {
  const opt = (value: string, label: string, isDefault = false) => ({ value, label, isDefault, meta: null });
  const base = {
    unit: null,
    min: null,
    max: null,
    step: null,
    required: true,
    shareable: true,
    visibleIf: null,
  };
  return {
    serviceSlug: 'fotopechat-na-bumage',
    code: 'photo-print',
    title: 'Фотопечать',
    version: 1,
    pricingMode: 'TIER',
    urlOrder: ['formats', 'paper', 'urgency', 'qty'],
    qty: { min: 1, max: 10000, step: 1, default: 10 },
    preset: null,
    parameters: [
      {
        ...base,
        urlKey: 'formats',
        label: 'Форматы и количество',
        type: 'MULTI_QTY',
        default: '10x15:10',
        multiQty: { maxLines: 4, lineMin: 0, lineMax: 5000, lineStep: 1, totalMin: 1, totalMax: 10000 },
        options: [
          opt('10x15', '10×15', true),
          opt('13x18', '13×18'),
          opt('20x30', '20×30'),
          opt('9x13', '9×13 мини'), // формат существует ТОЛЬКО в backend definition
        ],
      },
      {
        ...base,
        urlKey: 'paper',
        label: 'Бумага',
        type: 'SWATCH',
        default: 'gloss',
        options: [opt('gloss', 'Глянцевая', true), opt('satin', 'Сатин')],
      },
      {
        ...base,
        urlKey: 'urgency',
        label: 'Срочность',
        type: 'SEGMENTED',
        default: 'standard',
        options: [opt('standard', 'Стандарт (1–2 дня)', true), opt('express-1h', 'За 1 час')],
      },
    ],
    compatibility: [],
    upsells: [],
    hasActivePriceList: true,
    calculationVersion: 'photo-print:v1:p1',
  };
}

function makeCalcResponse(amountMinor: number, lineItems: CalculationLineItemDto[], totalQuantity: number) {
  return {
    serviceSlug: 'fotopechat-na-bumage',
    normalizedParameters: {},
    quantity: totalQuantity,
    price: { amountMinor, currency: 'RUB' },
    unitPrice: { amountMinor: Math.round(amountMinor / totalQuantity), currency: 'RUB' },
    priceWithVat: { amountMinor: Math.round(amountMinor * 1.2), currency: 'RUB' },
    production: { workingDays: 1, readyAt: '2026-07-22', readyDateLabel: 'ср, 22 июля', cutoff: '14:00' },
    appliedUpsells: [],
    lineItems,
    totalQuantity,
    warnings: [],
    calculationVersion: 'photo-print:v1:p1',
  };
}

const money = (amountMinor: number) => ({ amountMinor, currency: 'RUB' });
const DEFAULT_LINES: CalculationLineItemDto[] = [
  { key: '10x15', label: '10×15', quantity: 10, unitPrice: money(1800), lineTotal: money(18000) },
];

describe('Calculator «Фотопечать» + MULTI_QTY definition (integration)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', PAGE);
    if (!window.requestAnimationFrame) {
      window.requestAnimationFrame = (cb: FrameRequestCallback) =>
        setTimeout(() => cb(performance.now()), 16) as unknown as number;
      window.cancelAnimationFrame = (id: number) => clearTimeout(id);
    }
    getDefinitionMock.mockReset().mockResolvedValue(makePhotoDefinition());
    postCalculateMock.mockReset().mockResolvedValue(makeCalcResponse(18000, DEFAULT_LINES, 10));
    postConfirmMock.mockReset().mockResolvedValue({
      snapshotId: 'snap-photo',
      price: money(18000),
      calculationVersion: 'photo-print:v1:p1',
      normalizedParameters: {},
      upsells: [],
      lineItems: DEFAULT_LINES,
      totalQuantity: 10,
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

  it('строки MULTI_QTY из definition: backend-формат «9×13 мини» виден без деплоя', async () => {
    render(<Calculator slug={PAGE} name="Фотопечать" />);
    expect(await screen.findByText('9×13 мини')).toBeTruthy();
    expect(getDefinitionMock).toHaveBeenCalledWith('fotopechat-na-bumage');
    // Дефолтная строка из definition: 10 шт формата 10×15, итог показан.
    const input = screen.getByLabelText('10×15, количество') as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe('10'));
    // Итог по счётчикам (десктоп + мобильный блок — минимум одно вхождение).
    expect(screen.getAllByText('10 шт.').length).toBeGreaterThan(0);
  });

  it('количества хранятся объектом machineKey → qty и уходят в API объектом', async () => {
    render(<Calculator slug={PAGE} name="Фотопечать" />);
    await screen.findByText('9×13 мини');
    fireEvent.change(screen.getByLabelText('20×30, количество'), { target: { value: '2' } });
    await waitFor(() => {
      const lastBody = postCalculateMock.mock.calls.at(-1)?.[1];
      expect(lastBody.parameters.formats).toEqual({ '10x15': 10, '20x30': 2 });
    }, { timeout: 3000 });
  });

  it('нулевая строка удаляется из тела запроса и URL', async () => {
    render(<Calculator slug={PAGE} name="Фотопечать" />);
    await screen.findByText('9×13 мини');
    fireEvent.change(screen.getByLabelText('13×18, количество'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('10×15, количество'), { target: { value: '0' } });
    await waitFor(() => {
      const lastBody = postCalculateMock.mock.calls.at(-1)?.[1];
      expect(lastBody.parameters.formats).toEqual({ '13x18': 5 });
    }, { timeout: 3000 });
    await waitFor(
      () => expect(decodeURIComponent(window.location.search)).toContain('formats=13x18:5'),
      { timeout: 3000 },
    );
    expect(decodeURIComponent(window.location.search)).not.toContain('10x15');
  });

  it('серверная построчная разбивка отображается; клиент цены не считает', async () => {
    postCalculateMock.mockResolvedValue(
      makeCalcResponse(320000, [
        { key: '10x15', label: '10×15', quantity: 100, unitPrice: money(1800), lineTotal: money(180000) },
        { key: '20x30', label: '20×30', quantity: 20, unitPrice: money(7000), lineTotal: money(140000) },
      ], 120),
    );
    render(<Calculator slug={PAGE} name="Фотопечать" />);
    await screen.findByText('9×13 мини');
    // Разбивка приходит целиком с сервера (числа из мока, не из state).
    expect(await screen.findByText(/10×15 · 100 шт/, undefined, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByText(/20×30 · 20 шт/)).toBeTruthy();
    expect(screen.getByText('Всего фотографий')).toBeTruthy();
    expect(screen.getByText('120 шт')).toBeTruthy();
  });

  it('URL восстанавливает объект: ?formats=20x30:3 выбирает строку, мусор нормализуется', async () => {
    window.history.replaceState(null, '', `${PAGE}?formats=20x30:3,unknown:9`);
    render(<Calculator slug={PAGE} name="Фотопечать" />);
    await screen.findByText('9×13 мини');
    const input = screen.getByLabelText('20×30, количество') as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe('3'));
    // Неизвестная строка удалена нормализацией (replaceState, без pushState).
    expect(decodeURIComponent(window.location.search)).toBe('?formats=20x30:3');
    expect(window.location.pathname).toBe(PAGE);
  });

  it('изменение количества делает результат stale и блокирует заказ до fresh', async () => {
    render(<Calculator slug={PAGE} name="Фотопечать" />);
    await screen.findByText('9×13 мини');
    const checkoutButton = screen.getByRole('button', { name: /Загрузить макет и заказать/ });
    await waitFor(() => expect(checkoutButton.hasAttribute('disabled')).toBe(false), { timeout: 3000 });

    postCalculateMock.mockImplementation(() => new Promise(() => undefined)); // сервер «завис»
    fireEvent.change(screen.getByLabelText('13×18, количество'), { target: { value: '4' } });
    await waitFor(() => expect(checkoutButton.hasAttribute('disabled')).toBe(true));
    await new Promise((r) => setTimeout(r, 600));
    expect(checkoutButton.hasAttribute('disabled')).toBe(true);
    expect(postConfirmMock).not.toHaveBeenCalled();
  });

  it('confirm отправляет тот же формат-объект, что и calculate', async () => {
    render(<Calculator slug={PAGE} name="Фотопечать" />);
    await screen.findByText('9×13 мини');
    const checkoutButton = screen.getByRole('button', { name: /Загрузить макет и заказать/ });
    await waitFor(() => expect(checkoutButton.hasAttribute('disabled')).toBe(false), { timeout: 3000 });
    fireEvent.click(checkoutButton);
    await waitFor(() => expect(postConfirmMock).toHaveBeenCalledTimes(1));
    const previewBody = postCalculateMock.mock.calls.at(-1)?.[1];
    const confirmBody = postConfirmMock.mock.calls[0][1];
    expect(confirmBody.parameters).toEqual(previewBody.parameters);
    expect(confirmBody.parameters.formats).toEqual({ '10x15': 10 });
    expect(postConfirmMock.mock.calls[0][0]).toBe('fotopechat-na-bumage');
  });

  it('production без definition: заглушка, заказ закрыт', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    getDefinitionMock.mockRejectedValue(new Error('offline'));
    render(<Calculator slug={PAGE} name="Фотопечать" />);
    expect(await screen.findByText('Онлайн-расчёт временно недоступен')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Загрузить макет и заказать/ })).toBeNull();
  });
});
