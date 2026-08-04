// @vitest-environment jsdom
/**
 * Интеграционные тесты РЕАЛЬНОГО компонента Calculator (не отдельной
 * registry): backend definition управляет составом опций, дефолтами и
 * confirm-запросом; локальный CalcConfig участвует только как presentation.
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

/**
 * Definition «с backend»: у бумаги появилась опция «Дизайнерская премиум»
 * (в локальном CalcConfig её НЕТ) и сменился дефолт (локально coated-350).
 */
function makeDefinition(): CalculatorDefinitionDto {
  return {
    serviceSlug: 'vizitki',
    code: 'business-cards',
    title: 'Визитки',
    version: 4,
    pricingMode: 'TIER',
    urlOrder: ['subtype', 'paper', 'qty', 'express'],
    qty: { min: 50, max: 10000, step: 50, default: 100 },
    preset: null,
    parameters: [
      {
        urlKey: 'subtype',
        label: 'Тип',
        type: 'SEGMENTED',
        unit: null,
        min: null,
        max: null,
        step: null,
        default: 'standard',
        required: true,
        shareable: true,
        visibleIf: null,
        options: [
          { value: 'standard', label: 'Стандартные', isDefault: true, meta: null },
          { value: 'plastic', label: 'Пластиковые', isDefault: false, meta: null },
        ],
      },
      {
        urlKey: 'paper',
        label: 'Бумага',
        type: 'SWATCH',
        unit: null,
        min: null,
        max: null,
        step: null,
        default: 'design-premium',
        required: true,
        shareable: true,
        visibleIf: null,
        options: [
          { value: 'coated-350', label: 'Мелованная 350 г', isDefault: false, meta: null },
          { value: 'design-premium', label: 'Дизайнерская премиум', isDefault: true, meta: null },
        ],
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
    upsells: [{ code: 'plastic-case', label: 'Кейс для визиток', visibleIf: null }],
    hasActivePriceList: true,
    calculationVersion: 'business-cards:v4:p1',
  };
}

function makeCalcResponse(amountMinor: number) {
  return {
    serviceSlug: 'vizitki',
    normalizedParameters: {},
    quantity: 100,
    price: { amountMinor, currency: 'RUB' },
    unitPrice: { amountMinor: Math.round(amountMinor / 100), currency: 'RUB' },
    priceWithVat: { amountMinor: Math.round(amountMinor * 1.2), currency: 'RUB' },
    production: { workingDays: 2, readyAt: '2026-07-22', readyDateLabel: 'ср, 22 июля', cutoff: '14:00' },
    appliedUpsells: [],
    warnings: [],
    calculationVersion: 'business-cards:v4:p1',
  };
}

describe('Calculator + backend definition (integration)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/vizitki/');
    if (!window.requestAnimationFrame) {
      window.requestAnimationFrame = (cb: FrameRequestCallback) =>
        setTimeout(() => cb(performance.now()), 16) as unknown as number;
      window.cancelAnimationFrame = (id: number) => clearTimeout(id);
    }
    getDefinitionMock.mockReset().mockResolvedValue(makeDefinition());
    postCalculateMock.mockReset().mockResolvedValue(makeCalcResponse(120000));
    postConfirmMock.mockReset().mockResolvedValue({
      snapshotId: 'snap-1',
      price: { amountMinor: 120000, currency: 'RUB' },
      calculationVersion: 'business-cards:v4:p1',
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

  it('новая опция из backend definition появляется в UI без изменения локального конфига', async () => {
    render(<Calculator slug="/vizitki/" name="Визитки" />);
    // «Дизайнерская премиум» существует ТОЛЬКО в backend definition.
    expect(await screen.findByText('Дизайнерская премиум')).toBeTruthy();
    // А локальная опция, которой нет в definition, исчезла из UI.
    expect(screen.queryByText('Мелованная 300 г')).toBeNull();
  });

  it('backend default выбран в UI и не попадает в URL (дефолты не сериализуются)', async () => {
    render(<Calculator slug="/vizitki/" name="Визитки" />);
    const premium = (await screen.findByText('Дизайнерская премиум')).closest('button')!;
    await waitFor(() => expect(premium.getAttribute('aria-pressed')).toBe('true'));
    // Дефолт из definition — это дефолт и для URL-слоя: query остаётся пустым.
    await new Promise((r) => setTimeout(r, 1200)); // > debounce pushState
    expect(window.location.search).toBe('');
  });

  it('checkout отправляет confirm с точным текущим набором parameters + upsells', async () => {
    render(<Calculator slug="/vizitki/" name="Визитки" />);
    await screen.findByText('Дизайнерская премиум');

    // Дожидаемся свежего серверного расчёта (debounce 300 мс + ответ).
    const checkoutButton = screen.getByRole('button', { name: /Перейти к оформлению/ });
    await waitFor(() => expect(checkoutButton.hasAttribute('disabled')).toBe(false), { timeout: 3000 });

    // Включаем upsell → цена пересчитывается → снова ждём разблокировки.
    fireEvent.click(screen.getByRole('button', { name: /Кейс для визиток/ }));
    await waitFor(() => expect(checkoutButton.hasAttribute('disabled')).toBe(true));
    await waitFor(() => expect(checkoutButton.hasAttribute('disabled')).toBe(false), { timeout: 3000 });

    fireEvent.click(checkoutButton);
    await waitFor(() => expect(postConfirmMock).toHaveBeenCalledTimes(1));
    expect(postConfirmMock).toHaveBeenCalledWith(
      'vizitki',
      expect.objectContaining({
        parameters: expect.objectContaining({
          subtype: 'standard',
          paper: 'design-premium', // backend default, не локальный coated-350
          express: '0',
          qty: 100,
        }),
        upsells: ['plastic-case'],
      }),
    );
    await waitFor(() => expect(routerPushMock).toHaveBeenCalledWith('/korzina/'));
  });

  it('пока расчёт не подтверждён сервером, кнопка заказа заблокирована', async () => {
    // Сервер «думает» бесконечно — кнопка не должна разблокироваться.
    postCalculateMock.mockImplementation(() => new Promise(() => undefined));
    render(<Calculator slug="/vizitki/" name="Визитки" />);
    await screen.findByText('Дизайнерская премиум');
    const checkoutButton = screen.getByRole('button', { name: /Перейти к оформлению/ });
    await new Promise((r) => setTimeout(r, 500));
    expect(checkoutButton.hasAttribute('disabled')).toBe(true);
    expect(postConfirmMock).not.toHaveBeenCalled();
  });

  it('production без definition: состояние недоступности, заказ невозможен', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    getDefinitionMock.mockRejectedValue(new Error('offline'));
    render(<Calculator slug="/vizitki/" name="Визитки" />);
    expect(await screen.findByText('Онлайн-расчёт временно недоступен')).toBeTruthy();
    // PricePanel с кнопкой заказа не рендерится вовсе.
    expect(screen.queryByRole('button', { name: /Перейти к оформлению/ })).toBeNull();
  });
});
