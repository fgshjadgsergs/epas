'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import { getAdminOrder, type AdminOrderDto } from '@/lib/api/admin-orders';
import { tokenStorage } from '@/lib/api/auth';

/**
 * Загрузка одного заказа для админки по id (GET /admin/orders/:id).
 *
 * Данные всегда из backend, не из React state: карточка переживает перезагрузку
 * и прямое открытие. 403 отделён от 404 — у менеджера есть доступ к чужим
 * заказам, поэтому «нет прав» и «нет заказа» — разные экраны.
 */
export type AdminOrderState =
  | { status: 'loading' }
  | { status: 'ready'; order: AdminOrderDto }
  | { status: 'unauthorized' }
  | { status: 'forbidden' }
  | { status: 'notFound' }
  | { status: 'error'; message: string };

export function useAdminOrder(orderId: string | null | undefined): {
  state: AdminOrderState;
  reload: () => void;
} {
  const [state, setState] = useState<AdminOrderState>({ status: 'loading' });
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

    getAdminOrder(orderId, token)
      .then((order) => {
        if (!cancelled) setState({ status: 'ready', order });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError) {
          if (error.status === 401) return setState({ status: 'unauthorized' });
          if (error.status === 403) return setState({ status: 'forbidden' });
          if (error.status === 400 || error.status === 404) return setState({ status: 'notFound' });
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
