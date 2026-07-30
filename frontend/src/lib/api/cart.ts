import { apiFetch } from './client';

/**
 * Клиент серверной корзины.
 *
 * Цена НИКОГДА не передаётся с фронта: добавление позиции принимает только
 * calculationSnapshotId подтверждённого расчёта, все суммы и статусы приходят
 * от backend. Локальный Zustand-store остаётся presentation/cache-слоем и не
 * является источником состава и цены корзины.
 *
 * Все запросы идут с credentials: 'include' — анонимная сессия хранится в
 * httpOnly-cookie и недоступна JS.
 */

export type CartItemStatus = 'VALID' | 'STALE' | 'UNAVAILABLE' | 'REQUIRES_RECALCULATION';

export interface CartMoneyDto {
  amountMinor: number;
  currency: string;
}

export interface CartItemDto {
  id: string;
  serviceSlug: string;
  /** Название на момент добавления (не меняется при правках каталога). */
  title: string;
  configuration: Record<string, unknown>;
  quantity: number;
  unitPrice: CartMoneyDto;
  lineTotal: CartMoneyDto;
  production: { workingDays: number };
  status: CartItemStatus;
  pricingMode: 'DEMO' | 'LIVE';
  calculationSnapshotId: string;
  addedAt: string;
}

export interface CartDto {
  id: string;
  status: 'ACTIVE' | 'MERGED' | 'ORDERED';
  currency: string;
  cartVersion: number;
  items: CartItemDto[];
  itemCount: number;
  totals: {
    itemsSubtotal: CartMoneyDto;
    discounts: CartMoneyDto;
    total: CartMoneyDto;
  };
  /** true только если корзина не пуста и все позиции VALID. */
  canCheckout: boolean;
  /** DEMO, если хотя бы одна позиция посчитана по демонстрационному прайсу. */
  pricingMode: 'DEMO' | 'LIVE';
}

/** Тело добавления: осознанно ТОЛЬКО идентификатор расчёта, без цены. */
export interface AddCartItemBody {
  calculationSnapshotId: string;
}

const withCookies = (token?: string | null) =>
  ({ credentials: 'include' as RequestCredentials, token: token ?? undefined });

/** Текущая корзина (создаётся сервером при первом обращении). */
export function getCart(token?: string | null): Promise<CartDto> {
  return apiFetch<CartDto>('cart', { ...withCookies(token), cache: 'no-store' });
}

/** Добавить подтверждённый расчёт. Повторный вызов с тем же id идемпотентен. */
export function addCartItem(calculationSnapshotId: string, token?: string | null): Promise<CartDto> {
  const body: AddCartItemBody = { calculationSnapshotId };
  return apiFetch<CartDto>('cart/items', { method: 'POST', body, ...withCookies(token) });
}

/** Удалить позицию из своей корзины. */
export function removeCartItem(itemId: string, token?: string | null): Promise<CartDto> {
  return apiFetch<CartDto>(`cart/items/${encodeURIComponent(itemId)}`, {
    method: 'DELETE',
    ...withCookies(token),
  });
}

/** Очистить корзину. */
export function clearCart(token?: string | null): Promise<CartDto> {
  return apiFetch<CartDto>('cart', { method: 'DELETE', ...withCookies(token) });
}

/** Слить анонимную корзину в пользовательскую после входа (идемпотентно). */
export function mergeCart(token: string): Promise<CartDto> {
  return apiFetch<CartDto>('cart/merge', { method: 'POST', ...withCookies(token) });
}

/** Пересчитать позицию по актуальному прайсу (сервер создаёт новый snapshot). */
export function refreshCartItem(itemId: string, token?: string | null): Promise<CartDto> {
  return apiFetch<CartDto>(`cart/items/${encodeURIComponent(itemId)}/refresh`, {
    method: 'POST',
    ...withCookies(token),
  });
}
