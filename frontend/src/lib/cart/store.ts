'use client';

import { create } from 'zustand';
import {
  addCartItem,
  clearCart as apiClearCart,
  getCart,
  mergeCart as apiMergeCart,
  refreshCartItem,
  removeCartItem,
  type CartDto,
} from '@/lib/api/cart';
import { ApiError } from '@/lib/api/client';
import { tokenStorage } from '@/lib/api/auth';

/**
 * Кэш серверной корзины (presentation layer).
 *
 * Источник истины — backend: состав позиций, цены, статусы, суммы и
 * canCheckout приходят из GET /api/v1/cart. Store НЕ хранит локальные
 * позиции, ничего не пересчитывает и не делает optimistic-обновления цены —
 * после каждой мутации состояние заменяется ответом backend.
 *
 * Анонимная сессия живёт в httpOnly-cookie kp_cart_sid: JS её не читает,
 * идентификатор корзины в localStorage не хранится.
 */
interface CartState {
  /** Последний ответ сервера; null — ещё не загружали. */
  cart: CartDto | null;
  loading: boolean;
  /** Ошибка последней операции (для баннера + retry). */
  error: string | null;
  /** Идёт мутация (add/remove/clear/refresh) — блокирует повторные клики. */
  pending: boolean;

  loadCart: (options?: { force?: boolean }) => Promise<void>;
  addItem: (calculationSnapshotId: string) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshItem: (itemId: string) => Promise<void>;
  mergeCart: () => Promise<void>;
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Не удалось обновить корзину. Попробуйте ещё раз.';
}

/** Токен нужен, чтобы корзина авторизованного пользователя не подменялась анонимной. */
function token(): string | null {
  return tokenStorage.getAccessToken();
}

export const useCart = create<CartState>()((set, get) => ({
  cart: null,
  loading: false,
  error: null,
  pending: false,

  async loadCart(options) {
    // Повторные вызовы во время загрузки не плодят запросы; force — для retry.
    if (get().loading) return;
    if (get().cart && !options?.force) return;
    set({ loading: true, error: null });
    try {
      set({ cart: await getCart(token()), loading: false });
    } catch (error) {
      set({ loading: false, error: messageOf(error) });
    }
  },

  async addItem(calculationSnapshotId) {
    if (get().pending) return; // защита от двойного клика
    set({ pending: true, error: null });
    try {
      // Позиция появляется только из ответа backend — локально ничего не создаём.
      set({ cart: await addCartItem(calculationSnapshotId, token()), pending: false });
    } catch (error) {
      set({ pending: false, error: messageOf(error) });
      throw error;
    }
  },

  async removeItem(itemId) {
    if (get().pending) return;
    set({ pending: true, error: null });
    try {
      set({ cart: await removeCartItem(itemId, token()), pending: false });
    } catch (error) {
      set({ pending: false, error: messageOf(error) });
    }
  },

  async clearCart() {
    if (get().pending) return;
    set({ pending: true, error: null });
    try {
      set({ cart: await apiClearCart(token()), pending: false });
    } catch (error) {
      set({ pending: false, error: messageOf(error) });
    }
  },

  async refreshItem(itemId) {
    if (get().pending) return;
    set({ pending: true, error: null });
    try {
      set({ cart: await refreshCartItem(itemId, token()), pending: false });
    } catch (error) {
      set({ pending: false, error: messageOf(error) });
    }
  },

  async mergeCart() {
    const accessToken = token();
    if (!accessToken) return; // merge доступен только авторизованному
    set({ pending: true, error: null });
    try {
      set({ cart: await apiMergeCart(accessToken), pending: false });
    } catch (error) {
      // Повторный merge безопасен на backend; ошибку показываем, но не роняем UI.
      set({ pending: false, error: messageOf(error) });
    }
  },
}));

/** Количество позиций для бейджа в шапке (из серверного ответа). */
export function cartItemCount(cart: CartDto | null): number {
  return cart?.itemCount ?? 0;
}
