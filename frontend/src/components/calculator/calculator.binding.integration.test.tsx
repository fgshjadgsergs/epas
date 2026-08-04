// @vitest-environment jsdom
/**
 * Calculator binding страниц-вариантов: /listovki/a4/ работает через
 * definition родительской услуги «listovki» с page preset, pathname
 * лендинга сохраняется, URL-параметры сильнее preset, ввод пользователя
 * не сбрасывается загрузкой definition.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Calculator } from './calculator';
import { useCart } from '@/lib/cart/store';
import type { CalculatorDefinitionDto } from '@/lib/api/calculator';

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

function makeDefinition(): CalculatorDefinitionDto {
  const opt = (value: string, label: string, isDefault = false) => ({ value, label, isDefault, meta: null });
  return {
    serviceSlug: 'listovki',
    code: 'leaflets',
    title: 'Листовки',
    version: 1,
    pricingMode: 'TIER',
    urlOrder: ['format', 'paper', 'qty', 'express'],
    qty: { min: 100, max: 100000, step: 100, default: 500 },
    preset: null, // backend-binding preset отсутствует → работает preset страницы
    parameters: [
      {
        urlKey: 'format',
        label: 'Формат',
        type: 'SEGMENTED',
        unit: null,
        min: null,
        max: null,
        step: null,
        default: 'A5',
        required: true,
        shareable: true,
        visibleIf: null,
        options: [opt('A4', 'A4'), opt('A5', 'A5', true), opt('A6', 'A6'), opt('DL', 'Евро (DL)')],
      },
      {
        urlKey: 'paper',
        label: 'Бумага',
        type: 'SWATCH',
        unit: null,
        min: null,
        max: null,
        step: null,
        default: 'coated-150',
        required: true,
        shareable: true,
        visibleIf: null,
        options: [opt('offset-80', 'Офсет 80 г'), opt('coated-150', 'Мелованная 150 г', true)],
      },
      {
        urlKey: 'express',
        label: 'Срочно',
        type: 'TOGGLE',
        unit: null,
        min: null,
        max: null,
        step: null,
        default: '0',
        required: false,
        shareable: true,
        visibleIf: null,
        options: [],
      },
    ],
    compatibility: [],
    upsells: [],
    hasActivePriceList: true,
    calculationVersion: 'leaflets:v1:p1',
  };
}

function makeCalcResponse() {
  return {
    serviceSlug: 'listovki',
    normalizedParameters: {},
    quantity: 500,
    price: { amountMinor: 231000, currency: 'RUB' },
    unitPrice: { amountMinor: 462, currency: 'RUB' },
    priceWithVat: { amountMinor: 277200, currency: 'RUB' },
    production: { workingDays: 2, readyAt: '2026-07-22', readyDateLabel: 'ср, 22 июля', cutoff: '14:00' },
    appliedUpsells: [],
    warnings: [],
    calculationVersion: 'leaflets:v1:p1',
  };
}

describe('Binding страниц-вариантов (/listovki/a4/)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/listovki/a4/');
    if (!window.requestAnimationFrame) {
      window.requestAnimationFrame = (cb: FrameRequestCallback) =>
        setTimeout(() => cb(performance.now()), 16) as unknown as number;
      window.cancelAnimationFrame = (id: number) => clearTimeout(id);
    }
    getDefinitionMock.mockReset().mockResolvedValue(makeDefinition());
    postCalculateMock.mockReset().mockResolvedValue(makeCalcResponse());
    postConfirmMock.mockReset().mockResolvedValue({
      snapshotId: 'snap-a4',
      price: { amountMinor: 231000, currency: 'RUB' },
      calculationVersion: 'leaflets:v1:p1',
      normalizedParameters: {},
      upsells: [],
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

  it('запрашивает definition по binding-slug «listovki», а не по сегменту pathname «a4»', async () => {
    render(<Calculator slug="/listovki/a4/" name="Листовки A4" />);
    await screen.findByText('Евро (DL)');
    expect(getDefinitionMock).toHaveBeenCalledWith('listovki');
    expect(getDefinitionMock).toHaveBeenCalledTimes(1); // без дублированных запросов
    expect(getDefinitionMock).not.toHaveBeenCalledWith('a4');
  });

  it('page preset выбирает A4; совпадающее с preset значение не попадает в query', async () => {
    render(<Calculator slug="/listovki/a4/" name="Листовки A4" />);
    const a4 = (await screen.findByText('A4')).closest('button')!;
    await waitFor(() => expect(a4.getAttribute('aria-pressed')).toBe('true'));
    // format=A4 — это preset самой страницы: query остаётся пустым.
    await new Promise((r) => setTimeout(r, 1200));
    expect(window.location.search).toBe('');
    expect(window.location.pathname).toBe('/listovki/a4/');
  });

  it('URL-параметр сильнее preset: /listovki/a4/?format=A5 открывает A5', async () => {
    window.history.replaceState(null, '', '/listovki/a4/?format=A5');
    render(<Calculator slug="/listovki/a4/" name="Листовки A4" />);
    const a5 = (await screen.findByText('A5')).closest('button')!;
    await waitFor(() => expect(a5.getAttribute('aria-pressed')).toBe('true'));
    expect(window.location.pathname).toBe('/listovki/a4/');
  });

  it('legacy-регистр нормализуется: ?format=a5 → состояние A5 и canonical-значение в URL', async () => {
    window.history.replaceState(null, '', '/listovki/a4/?format=a5');
    render(<Calculator slug="/listovki/a4/" name="Листовки A4" />);
    const a5 = (await screen.findByText('A5')).closest('button')!;
    await waitFor(() => expect(a5.getAttribute('aria-pressed')).toBe('true'));
    // replaceState-нормализация: канонический регистр, без новой записи истории.
    await waitFor(() => expect(window.location.search).toContain('format=A5'));
    expect(window.location.pathname).toBe('/listovki/a4/');
  });

  it('ввод пользователя не сбрасывается поздней загрузкой definition', async () => {
    let resolveDefinition!: (d: CalculatorDefinitionDto) => void;
    getDefinitionMock.mockImplementation(
      () => new Promise<CalculatorDefinitionDto>((res) => (resolveDefinition = res)),
    );
    render(<Calculator slug="/listovki/a4/" name="Листовки A4" />);
    // Пока definition грузится, пользователь выбирает A6 в локальном скелете.
    fireEvent.click(screen.getByText('A6'));
    resolveDefinition(makeDefinition());
    await screen.findByText('Евро (DL)');
    const a6 = screen.getByText('A6').closest('button')!;
    await waitFor(() => expect(a6.getAttribute('aria-pressed')).toBe('true'));
  });

  it('отличие от preset сериализуется, pathname лендинга сохраняется (share URL)', async () => {
    render(<Calculator slug="/listovki/a4/" name="Листовки A4" />);
    await screen.findByText('Евро (DL)');
    fireEvent.click(screen.getByText('Евро (DL)'));
    await waitFor(() => expect(window.location.search).toContain('format=DL'), { timeout: 3000 });
    // Никакого редиректа на /listovki/?format=…: остаёмся на лендинге.
    expect(window.location.pathname).toBe('/listovki/a4/');
  });

  it('production с валидным binding: расчёт доступен, заглушки нет', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    render(<Calculator slug="/listovki/a4/" name="Листовки A4" />);
    await screen.findByText('Евро (DL)');
    expect(screen.queryByText('Онлайн-расчёт временно недоступен')).toBeNull();
    const checkoutButton = screen.getByRole('button', { name: /Перейти к оформлению/ });
    await waitFor(() => expect(checkoutButton.hasAttribute('disabled')).toBe(false), { timeout: 3000 });
    // Confirm уходит на binding-slug родительской услуги.
    fireEvent.click(checkoutButton);
    await waitFor(() => expect(postConfirmMock).toHaveBeenCalledTimes(1));
    expect(postConfirmMock.mock.calls[0][0]).toBe('listovki');
    expect(postConfirmMock.mock.calls[0][1].parameters).toMatchObject({ format: 'A4' });
  });
});
