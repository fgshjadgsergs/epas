// @vitest-environment jsdom
/**
 * Аналитика калькулятора (ТЗ «URL-адреса в калькуляторах»).
 *
 * Единственная семантика: virtual pageview = новый URL, созданный
 * пользовательским pushState. Поэтому trackVirtualHit НЕ шлётся на initial
 * load, replaceState-нормализацию, popstate/back-forward и повторные server-
 * расчёты — только после debounce-pushState. Goals успеха/неудачи расчёта
 * остаются привязаны к результату backend-расчёта.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Calculator } from './calculator';
import { useCart } from '@/lib/cart/store';
import type { CalculatorDefinitionDto } from '@/lib/api/calculator';

const getDefinitionMock = vi.hoisted(() => vi.fn());
const postCalculateMock = vi.hoisted(() => vi.fn());
const postConfirmMock = vi.hoisted(() => vi.fn());
const trackGoalMock = vi.hoisted(() => vi.fn());
const trackVirtualHitMock = vi.hoisted(() => vi.fn());
const noop = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/calculator', () => ({
  getCalculatorDefinition: getDefinitionMock,
  postCalculate: postCalculateMock,
  postConfirmCalculation: postConfirmMock,
}));
vi.mock('@/lib/analytics/yandex-metrika', () => ({
  trackGoal: trackGoalMock,
  trackVirtualHit: trackVirtualHitMock,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/api/cart', () => ({
  getCart: noop,
  addCartItem: noop,
  removeCartItem: noop,
  clearCart: noop,
  mergeCart: noop,
  refreshCartItem: noop,
}));

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
    upsells: [],
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

/** Сколько раз за сессию отправлен virtual hit. */
const hitCount = () => trackVirtualHitMock.mock.calls.length;
/** Все имена отправленных целей. */
const goalNames = () => trackGoalMock.mock.calls.map((c) => c[0] as string);

async function waitDefinitionAndCalc() {
  await screen.findByText('Дизайнерская премиум');
  await waitFor(() => expect(postCalculateMock).toHaveBeenCalled());
  // Даём завершиться debounce/onSucceeded, чтобы initial-хиты (если бы были) успели уйти.
  await new Promise((r) => setTimeout(r, 400));
}

describe('Calculator analytics: virtual hit = user pushState (integration)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/vizitki/');
    getDefinitionMock.mockReset().mockResolvedValue(makeDefinition());
    postCalculateMock.mockReset().mockResolvedValue(makeCalcResponse(120000));
    postConfirmMock.mockReset();
    trackGoalMock.mockReset();
    trackVirtualHitMock.mockReset();
    noop.mockReset().mockResolvedValue({
      id: 'cart-1',
      status: 'ACTIVE',
      currency: 'RUB',
      cartVersion: 1,
      items: [],
      itemCount: 0,
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

  it('initial load: 0 virtual hits, но расчёт успешен', async () => {
    render(<Calculator slug="/vizitki/" name="Визитки" />);
    await waitDefinitionAndCalc();

    expect(hitCount()).toBe(0);
    // Успех расчёта — это goal, привязанный к backend-результату, не pageview.
    expect(goalNames()).toContain('calc_calculation_succeeded');
    expect(goalNames()).not.toContain('calc_param_change');
  });

  it('server calculation success без pushState не даёт virtual hit', async () => {
    render(<Calculator slug="/vizitki/" name="Визитки" />);
    await waitDefinitionAndCalc();
    // Расчёт прошёл (postCalculate вызван), но URL пользователь не менял.
    expect(postCalculateMock).toHaveBeenCalled();
    expect(hitCount()).toBe(0);
  });

  it('user change → debounce → pushState → ровно 1 virtual hit + calc_param_change', async () => {
    render(<Calculator slug="/vizitki/" name="Визитки" />);
    await waitDefinitionAndCalc();

    fireEvent.click(screen.getByText('Пластиковые'));
    await waitFor(() => expect(window.location.search).toContain('subtype=plastic'), { timeout: 3000 });
    // Хиту нужно уйти в том же обработчике pushState — но подождём микрозадачи.
    await waitFor(() => expect(hitCount()).toBe(1), { timeout: 2000 });

    // URL хита = новый pathname+search; referer — предыдущий URL до push.
    expect(trackVirtualHitMock.mock.calls[0][0]).toBe('/vizitki/?subtype=plastic');
    expect(trackVirtualHitMock.mock.calls[0][1]).toMatchObject({ referer: '/vizitki/' });
    expect(goalNames()).toContain('calc_param_change');
  }, 10000);

  it('один pushState + несколько server-расчётов = 1 hit', async () => {
    render(<Calculator slug="/vizitki/" name="Визитки" />);
    await waitDefinitionAndCalc();
    const calcsBefore = postCalculateMock.mock.calls.length;

    fireEvent.click(screen.getByText('Пластиковые'));
    await waitFor(() => expect(hitCount()).toBe(1), { timeout: 3000 });
    // Смена параметра повторно вызвала server calculate (было ≥1 до изменения).
    expect(postCalculateMock.mock.calls.length).toBeGreaterThan(calcsBefore);
    // Но hit — ровно один на один pushState.
    expect(hitCount()).toBe(1);
  }, 10000);

  it('два разных pushState → 2 hits', async () => {
    render(<Calculator slug="/vizitki/" name="Визитки" />);
    await waitDefinitionAndCalc();

    fireEvent.click(screen.getByText('Пластиковые'));
    await waitFor(() => expect(hitCount()).toBe(1), { timeout: 3000 });

    fireEvent.click(screen.getByText('Мелованная 350 г'));
    await waitFor(() => expect(window.location.search).toContain('paper=coated-350'), { timeout: 3000 });
    await waitFor(() => expect(hitCount()).toBe(2), { timeout: 2000 });
  }, 12000);

  it('popstate (Back) восстанавливает состояние, но 0 новых virtual hits', async () => {
    render(<Calculator slug="/vizitki/" name="Визитки" />);
    await waitDefinitionAndCalc();

    // URL A (/vizitki/) → пользователь меняет → URL B (?subtype=plastic).
    fireEvent.click(screen.getByText('Пластиковые'));
    await waitFor(() => expect(hitCount()).toBe(1), { timeout: 3000 });

    // Back к URL A: восстанавливаем адрес и шлём popstate (как браузер).
    window.history.replaceState(window.history.state, '', '/vizitki/');
    window.dispatchEvent(new PopStateEvent('popstate'));

    // Состояние восстановилось (standard снова активен), пересчёт мог пройти…
    await waitFor(() => {
      const standard = screen.getByText('Стандартные').closest('button')!;
      expect(standard.getAttribute('aria-pressed')).toBe('true');
    });
    await new Promise((r) => setTimeout(r, 600));
    // …но новый virtual hit НЕ отправлен.
    expect(hitCount()).toBe(1);
  }, 12000);

  it('replaceState-нормализация (legacy-регистр) не даёт virtual hit', async () => {
    // design-premium — дефолт; в верхнем регистре нормализуется replaceState'ом.
    window.history.replaceState(null, '', '/vizitki/?paper=DESIGN-PREMIUM');
    render(<Calculator slug="/vizitki/" name="Визитки" />);
    await waitDefinitionAndCalc();
    // Нормализация URL прошла (search очищен от дефолта), но hit не отправлен.
    await new Promise((r) => setTimeout(r, 300));
    expect(hitCount()).toBe(0);
  }, 10000);
});
