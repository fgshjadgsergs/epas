'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import { getOrder, type OrderDto } from '@/lib/api/orders';
import { tokenStorage } from '@/lib/api/auth';

/**
 * Загрузка одного заказа по id с backend.
 *
 * Используется и страницей успеха, и карточкой заказа: при прямом открытии или
 * перезагрузке данные берутся из GET /orders/:id, а не из React state — иначе
 * после F5 экран оставался бы пустым.
 *
 * Чужой и несуществующий заказ неразличимы: 403/404 и некорректный id
 * одинаково дают notFound, чтобы нельзя было перебором подтвердить
 * существование заказа.
 */
export type OrderLoadState =
  | { status: 'loading' }
  | { status: 'ready'; order: OrderDto }
  | { status: 'notFound' }
  | { status: 'unauthorized' }
  | { status: 'error'; message: string };

export function useOrder(orderId: string | null | undefined): {
  state: OrderLoadState;
  reload: () => void;
} {
  const [state, setState] = useState<OrderLoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!orderId) {
      setState({ status: 'notFound' });
      return;
    }

    const token = tokenStorage.getAccessToken();
    if (!token) {
      setState({ status: 'unauthorized' });
      return;
    }

    let cancelled = false;
    setState({ status: 'loading' });

    getOrder(orderId, token)
      .then((order) => {
        if (!cancelled) setState({ status: 'ready', order });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError) {
          if (error.status === 401) return setState({ status: 'unauthorized' });
          // 400 — id не uuid; 403/404 — чужой или отсутствующий заказ.
          if ([400, 403, 404].includes(error.status)) return setState({ status: 'notFound' });
          return setState({ status: 'error', message: error.message });
        }
        setState({ status: 'error', message: 'Не удалось загрузить заказ.' });
      });

    return () => {
      cancelled = true;
    };
  }, [orderId, attempt]);

  return { state, reload };
}
