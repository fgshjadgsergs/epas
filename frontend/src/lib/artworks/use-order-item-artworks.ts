'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import { getOrderItemArtworks, type OrderItemArtworksResponse } from '@/lib/api/artworks';
import { tokenStorage } from '@/lib/api/auth';

/** Загрузка макетов позиции заказа с reload (после мутаций/409). */
export type ArtworksState =
  | { status: 'loading' }
  | { status: 'ready'; data: OrderItemArtworksResponse }
  | { status: 'unauthorized' }
  | { status: 'notFound' }
  | { status: 'error'; message: string };

export function useOrderItemArtworks(orderId: string, itemId: string): {
  state: ArtworksState;
  reload: () => void;
} {
  const [state, setState] = useState<ArtworksState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    const token = tokenStorage.getAccessToken();
    if (!token) {
      setState({ status: 'unauthorized' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    getOrderItemArtworks(orderId, itemId, token)
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError) {
          if (error.status === 401) return setState({ status: 'unauthorized' });
          if (error.status === 400 || error.status === 404) return setState({ status: 'notFound' });
          return setState({ status: 'error', message: error.message });
        }
        setState({ status: 'error', message: 'Не удалось загрузить макеты.' });
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, itemId, attempt]);

  return { state, reload };
}
