'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import { getPriceList, type PriceListDetail } from '@/lib/api/admin-pricing';
import { tokenStorage } from '@/lib/api/auth';

/**
 * Загрузка одного прайс-листа по id. Данные всегда из backend (переживает
 * перезагрузку). 403 отделён от 404. reload() перечитывает актуальное
 * состояние — используется после мутаций и при 409-конфликтах.
 */
export type PriceListState =
  | { status: 'loading' }
  | { status: 'ready'; priceList: PriceListDetail }
  | { status: 'unauthorized' }
  | { status: 'forbidden' }
  | { status: 'notFound' }
  | { status: 'error'; message: string };

export function usePriceList(priceListId: string | null | undefined): {
  state: PriceListState;
  reload: () => void;
} {
  const [state, setState] = useState<PriceListState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  // На refetch (после мутаций/publish) НЕ мигаем skeleton — держим прежние
  // данные, чтобы уведомления/состояние не пропадали и не было layout jump.
  const hasDataRef = useRef(false);

  useEffect(() => {
    if (!priceListId) {
      setState({ status: 'notFound' });
      return;
    }
    const token = tokenStorage.getAccessToken();
    if (!token) {
      setState({ status: 'unauthorized' });
      return;
    }
    let cancelled = false;
    if (!hasDataRef.current) setState({ status: 'loading' });
    getPriceList(priceListId, token)
      .then((priceList) => {
        if (cancelled) return;
        hasDataRef.current = true;
        setState({ status: 'ready', priceList });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError) {
          if (error.status === 401) return setState({ status: 'unauthorized' });
          if (error.status === 403) return setState({ status: 'forbidden' });
          if (error.status === 400 || error.status === 404) return setState({ status: 'notFound' });
          return setState({ status: 'error', message: error.message });
        }
        setState({ status: 'error', message: 'Не удалось загрузить прайс-лист.' });
      });
    return () => {
      cancelled = true;
    };
  }, [priceListId, attempt]);

  return { state, reload };
}
