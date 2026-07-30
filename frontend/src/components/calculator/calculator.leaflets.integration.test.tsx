// @vitest-environment jsdom
/**
 * Интеграционные тесты реального Calculator для «Листовок»: рендер из
 * backend definition, показ/скрытие custom-размера, сериализация URL без
 * неприменимых параметров, confirm с точным входом, production-fallback.
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

/** Definition листовок «с backend»: формат содержит опцию A7, которой нет в локальном конфиге. */
function makeLeafletsDefinition(): CalculatorDefinitionDto {
  return {
    serviceSlug: 'listovki',
    code: 'leaflets',
    title: 'Листовки',
    version: 1,
    pricingMode: 'TIER',
    urlOrder: ['format', 'w', 'h', 'paper', 'color', 'coating', 'qty', 'express'],
    qty: { min: 100, max: 100000, step: 100, default: 500 },
    preset: null,
    parameters: [
      param({
        urlKey: 'format',
        label: 'Формат',
        default: 'A5',
        options: [
          { value: 'A4', label: 'A4', isDefault: false, meta: null },
          { value: 'A5', label: 'A5', isDefault: true, meta: null },
          { value: 'A6', label: 'A6', isDefault: false, meta: null },
          { value: 'DL', label: 'Евро (DL)', isDefault: false, meta: null },
          { value: 'A7', label: 'A7 мини', isDefault: false, meta: null }, // только в backend
          { value: 'custom', label: 'Свой размер', isDefault: false, meta: null },
        ],
      }),
      param({
        urlKey: 'w',
        label: 'Ширина',
        type: 'DIMENSION',
        unit: 'мм',
        min: 74,
        max: 297,
        step: 1,
        default: '148',
        visibleIf: { format: 'custom' },
      }),
      param({
        urlKey: 'h',
        label: 'Высота',
        type: 'DIMENSION',
        unit: 'мм',
        min: 74,
        max: 297,
        step: 1,
        default: '210',
        visibleIf: { format: 'custom' },
      }),
      param({
        urlKey: 'paper',
        label: 'Бумага',
        type: 'SWATCH',
        default: 'coated-150',
        options: [
          { value: 'offset-80', label: 'Офсет 80 г', isDefault: false, meta: null },
          { value: 'coated-150', label: 'Мелованная 150 г', isDefault: true, meta: null },
        ],
      }),
      param({
        urlKey: 'color',
        label: 'Цветность',
        default: '4+4',
        options: [
          { value: '4+4', label: 'Цвет 2 стороны', isDefault: true, meta: null },
          { value: '4+0', label: 'Цвет 1 сторона', isDefault: false, meta: null },
        ],
      }),
      param({
        urlKey: 'coating',
        label: 'Ламинация',
        type: 'SWATCH',
        default: 'none',
        options: [
          { value: 'none', label: 'Без ламинации', isDefault: true, meta: null },
          { value: 'matte-lam', label: 'Матовая', isDefault: false, meta: null },
        ],
      }),
      param({ urlKey: 'express', label: 'Срочно', type: 'TOGGLE', default: '0', required: false }),
    ],
    compatibility: [
      {
        kind: 'DISABLE_OPTIONS',
        when: { paper: 'offset-80' },
        target: { param: 'coating', options: ['matte-lam'] },
        message: 'Ламинация недоступна для офсетной бумаги 80 г',
      },
    ],
    upsells: [{ code: 'numbering', label: 'Нумерация', visibleIf: null }],
    hasActivePriceList: true,
    calculationVersion: 'leaflets:v1:p1',
  };
}

function makeCalcResponse(amountMinor: number) {
  return {
    serviceSlug: 'listovki',
    normalizedParameters: {},
    quantity: 500,
    price: { amountMinor, currency: 'RUB' },
    unitPrice: { amountMinor: Math.round(amountMinor / 500), currency: 'RUB' },
    priceWithVat: { amountMinor: Math.round(amountMinor * 1.2), currency: 'RUB' },
    production: { workingDays: 2, readyAt: '2026-07-22', readyDateLabel: 'ср, 22 июля', cutoff: '14:00' },
    appliedUpsells: [],
    warnings: [],
    calculationVersion: 'leaflets:v1:p1',
  };
}

describe('Calculator «Листовки» + backend definition (integration)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/listovki/');
    if (!window.requestAnimationFrame) {
      window.requestAnimationFrame = (cb: FrameRequestCallback) =>
        setTimeout(() => cb(performance.now()), 16) as unknown as number;
      window.cancelAnimationFrame = (id: number) => clearTimeout(id);
    }
    getDefinitionMock.mockReset().mockResolvedValue(makeLeafletsDefinition());
    postCalculateMock.mockReset().mockResolvedValue(makeCalcResponse(231000));
    postConfirmMock.mockReset().mockResolvedValue({
      snapshotId: 'snap-leaf',
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

  it('рендерит листовки из definition; backend-опция «A7 мини» видна без изменения конфига', async () => {
    render(<Calculator slug="/listovki/" name="Листовки" />);
    expect(await screen.findByText('A7 мини')).toBeTruthy(); // есть только в definition
    expect(screen.getByText('Евро (DL)')).toBeTruthy();
    expect(screen.getByText('Мелованная 150 г')).toBeTruthy();
    // Дефолт из definition: A5 выбран.
    const a5 = screen.getByText('A5').closest('button')!;
    await waitFor(() => expect(a5.getAttribute('aria-pressed')).toBe('true'));
  });

  it('стандартный формат скрывает w/h; «Свой размер» показывает; возврат убирает их из URL', async () => {
    render(<Calculator slug="/listovki/" name="Листовки" />);
    await screen.findByText('Свой размер');

    // A5 (default): полей размера нет.
    expect(screen.queryByLabelText('Ширина')).toBeNull();
    expect(screen.queryByLabelText('Высота')).toBeNull();

    // Свой размер → появились, границы из definition.
    fireEvent.click(screen.getByText('Свой размер'));
    const w = (await screen.findByLabelText('Ширина')) as HTMLInputElement;
    expect(w.min).toBe('74');
    expect(w.max).toBe('297');
    fireEvent.change(w, { target: { value: '200' } });

    // После debounce 1000 мс URL содержит format=custom и w=200 (h — default, опущен).
    await waitFor(() => expect(window.location.search).toContain('format=custom'), { timeout: 3000 });
    expect(window.location.search).toContain('w=200');
    expect(window.location.search).not.toContain('h=');

    // Возврат к стандартному формату: w/h неприменимы → исчезают из URL.
    fireEvent.click(screen.getByText('A5'));
    await waitFor(() => expect(window.location.search).not.toContain('format=custom'), { timeout: 3000 });
    expect(window.location.search).not.toContain('w=');
  });

  it('порядок URL из definition: пример /listovki/?format=A4&paper=offset-80', async () => {
    render(<Calculator slug="/listovki/" name="Листовки" />);
    await screen.findByText('A7 мини');
    fireEvent.click(screen.getByText('Офсет 80 г'));
    fireEvent.click(screen.getByText('A4'));
    await waitFor(() => expect(window.location.search).toContain('format=A4'), { timeout: 3000 });
    // Порядок ключей — из urlOrder definition: format раньше paper.
    expect(window.location.search).toBe('?format=A4&paper=offset-80');
  });

  it('checkout отправляет точный вход листовок: параметры definition + upsells', async () => {
    render(<Calculator slug="/listovki/" name="Листовки" />);
    await screen.findByText('A7 мини');
    const checkoutButton = screen.getByRole('button', { name: /Загрузить макет и заказать/ });
    await waitFor(() => expect(checkoutButton.hasAttribute('disabled')).toBe(false), { timeout: 3000 });

    fireEvent.click(screen.getByRole('button', { name: /Нумерация/ }));
    await waitFor(() => expect(checkoutButton.hasAttribute('disabled')).toBe(true));
    await waitFor(() => expect(checkoutButton.hasAttribute('disabled')).toBe(false), { timeout: 3000 });

    fireEvent.click(checkoutButton);
    await waitFor(() => expect(postConfirmMock).toHaveBeenCalledTimes(1));
    expect(postConfirmMock).toHaveBeenCalledWith(
      'listovki',
      expect.objectContaining({
        parameters: expect.objectContaining({
          format: 'A5',
          paper: 'coated-150',
          color: '4+4',
          coating: 'none',
          express: '0',
          qty: 500,
        }),
        upsells: ['numbering'],
      }),
    );
  });

  it('production без definition: листовки показывают состояние недоступности', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    getDefinitionMock.mockRejectedValue(new Error('offline'));
    render(<Calculator slug="/listovki/" name="Листовки" />);
    expect(await screen.findByText('Онлайн-расчёт временно недоступен')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Загрузить макет и заказать/ })).toBeNull();
  });
});
