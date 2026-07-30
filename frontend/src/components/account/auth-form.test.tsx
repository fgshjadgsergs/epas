// @vitest-environment jsdom
/**
 * Вход с возвратом на оформление: merge анонимной корзины выполняется один
 * раз, затем корзина перечитывается, и пользователь возвращается на checkout.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthForm } from './auth-form';
import { useCart } from '@/lib/cart/store';

const cartApi = vi.hoisted(() => ({
  getCart: vi.fn(),
  addCartItem: vi.fn(),
  removeCartItem: vi.fn(),
  clearCart: vi.fn(),
  mergeCart: vi.fn(),
  refreshCartItem: vi.fn(),
}));
const authApi = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  // Стор корзины читает access через tokenStorage — отдаём токен, чтобы merge пошёл.
  tokenStorage: { getAccessToken: () => 'jwt-token', clear: vi.fn() },
}));
const authCtx = vi.hoisted(() => ({ applySession: vi.fn(), signOut: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn() }));
const query = vi.hoisted(() => ({ ret: null as string | null }));

vi.mock('@/lib/api/cart', () => cartApi);
vi.mock('@/lib/api/auth', () => authApi);
vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ status: 'authenticated', permissions: [], roles: [], user: null, applySession: authCtx.applySession, signOut: authCtx.signOut }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useSearchParams: () => ({ get: (key: string) => (key === 'return' ? query.ret : null) }),
}));

const emptyCart = {
  id: 'cart-1',
  status: 'ACTIVE' as const,
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
  pricingMode: 'LIVE' as const,
};

function submitLogin() {
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ivan@example.com' } });
  fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'secret123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
}

beforeEach(() => {
  for (const fn of Object.values(cartApi)) fn.mockReset();
  authApi.login.mockReset();
  authCtx.applySession.mockReset();
  router.push.mockReset();
  query.ret = null;
  authApi.login.mockResolvedValue({
    accessToken: 'jwt-token',
    user: { id: 'u1', email: 'ivan@example.com', firstName: 'Иван', lastName: null, roles: ['CUSTOMER'], permissions: [] },
  });
  cartApi.mergeCart.mockResolvedValue(emptyCart);
  cartApi.getCart.mockResolvedValue(emptyCart);
  useCart.setState({ cart: null, loading: false, error: null, pending: false });
});
afterEach(() => cleanup());

describe('AuthForm — возврат на оформление', () => {
  it('после входа сливает корзину один раз и перечитывает её', async () => {
    query.ret = '/oformlenie-zakaza/';
    render(<AuthForm />);
    submitLogin();

    await waitFor(() => expect(cartApi.mergeCart).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(cartApi.getCart).toHaveBeenCalled());
  });

  it('возвращает пользователя на checkout по ?return=', async () => {
    query.ret = '/oformlenie-zakaza/';
    render(<AuthForm />);
    submitLogin();

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/oformlenie-zakaza/'));
  });

  it('без ?return= остаётся в кабинете и показывает профиль', async () => {
    render(<AuthForm />);
    submitLogin();

    expect(await screen.findByText('Вы вошли как')).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('внешний адрес в ?return= игнорируется — открытого редиректа нет', async () => {
    query.ret = 'https://evil.example/';
    render(<AuthForm />);
    submitLogin();

    await screen.findByText('Вы вошли как');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('подсказка про оформление показывается только при возврате на checkout', async () => {
    query.ret = '/oformlenie-zakaza/';
    render(<AuthForm />);
    expect(screen.getByText(/продолжить оформление заказа/)).toBeTruthy();
  });
});
