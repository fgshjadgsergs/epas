'use client';

import { useEffect, useRef, useState } from 'react';
import { postCalculate, type CalculateRequestBody, type CalculateResponseDto } from '@/lib/api/calculator';
import { ApiError } from '@/lib/api/client';

/**
 * Единственный источник истины по «свежести» серверной цены (Codex review,
 * блок 2). Состояние:
 * - 'idle'    — ещё не считали (нет definition/тела запроса);
 * - 'pending' — запрос выполняется (либо ждёт debounce);
 * - 'fresh'   — data соответствует ТЕКУЩИМ параметрам, можно оформлять заказ;
 * - 'stale'   — параметры изменились ПОСЛЕ последнего успешного расчёта,
 *               предыдущая цена показывается только как устаревшая;
 * - 'error'   — 422 или сетевая ошибка для ТЕКУЩИХ параметров — предыдущий
 *               результат не действителен для новой конфигурации.
 *
 * add-to-cart разрешён ТОЛЬКО при status === 'fresh'.
 */
export type CalculationStatus = 'idle' | 'pending' | 'fresh' | 'stale' | 'error';

export interface ServerCalculationState {
  status: CalculationStatus;
  /** Последний успешный результат — для UI «устаревшая цена», не для checkout. */
  data: CalculateResponseDto | null;
  fieldErrors: { param: string; message: string }[];
  /** Сетевая ошибка (не 422) — показываем последнюю цену с пометкой + retry 5 с. */
  offline: boolean;
  /**
   * true ТОЛЬКО когда data получены ровно для текущего body (exact bodyKey).
   * Вычисляется синхронно при render: сравнение ключа успешного результата с
   * ключом текущего body закрывает окно «status ещё fresh, но параметры уже
   * другие» между render и useEffect.
   */
  canAddToCart: boolean;
}

function serializeBody(body: CalculateRequestBody | null): string {
  return body ? JSON.stringify(body) : '';
}

export function useServerCalculation(
  serviceSlug: string,
  body: CalculateRequestBody | null,
  enabled: boolean,
  options: {
    debounceMs?: number;
    onSucceeded?: (data: CalculateResponseDto) => void;
    onFailed?: (reason: 'validation' | 'network') => void;
  } = {},
): ServerCalculationState {
  const { debounceMs = 300, onSucceeded, onFailed } = options;
  const [data, setData] = useState<CalculateResponseDto | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ param: string; message: string }[]>([]);
  const [offline, setOffline] = useState(false);
  const [status, setStatus] = useState<CalculationStatus>('idle');
  const [retryTick, setRetryTick] = useState(0);
  /**
   * Exact bodyKey успешного результата (state, не ref): участвует в
   * СИНХРОННОМ вычислении canAddToCart при render — первый же render с новым
   * body даёт false, не дожидаясь эффектов.
   */
  const [freshForKey, setFreshForKey] = useState<string | null>(null);

  const bodyKey = serializeBody(body);
  /** Ключ параметров, для которых сейчас идёт (или последний раз завершился) запрос. */
  const requestSeq = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSucceededRef = useRef(onSucceeded);
  onSucceededRef.current = onSucceeded;
  const onFailedRef = useRef(onFailed);
  onFailedRef.current = onFailed;

  // Любое изменение параметров немедленно делает предыдущий результат stale
  // (для отображения «цена устарела»). Блокировка checkout НЕ зависит от
  // этого эффекта: canAddToCart ниже сверяет exact bodyKey синхронно.
  useEffect(() => {
    if (!enabled || !body) {
      setStatus('idle');
      return;
    }
    if (freshForKey !== bodyKey) {
      setStatus((prev) => (prev === 'fresh' || prev === 'stale' ? 'stale' : prev === 'idle' ? 'idle' : prev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyKey, enabled]);

  useEffect(() => {
    if (!enabled || !body) return;
    const mySeq = ++requestSeq.current;
    const controller = new AbortController();
    setStatus('pending');

    const timer = setTimeout(async () => {
      try {
        const res = await postCalculate(serviceSlug, body, controller.signal);
        // Поздний ответ устаревшего запроса не должен перезаписывать более
        // новый результат и не может разблокировать чужую конфигурацию.
        if (mySeq !== requestSeq.current) return;
        setData(res);
        setFieldErrors([]);
        setOffline(false);
        setFreshForKey(bodyKey);
        setStatus('fresh');
        onSucceededRef.current?.(res);
      } catch (error) {
        if (controller.signal.aborted || mySeq !== requestSeq.current) return;
        if (error instanceof ApiError && error.status === 422) {
          const errs = (error.errors as unknown as { param: string; message: string }[]) ?? [];
          setFieldErrors(errs.length > 0 ? errs : [{ param: 'qty', message: error.message }]);
          setOffline(false);
          setStatus('error'); // предыдущий результат недействителен для этой конфигурации
          onFailedRef.current?.('validation');
        } else {
          setOffline(true);
          setStatus('error');
          onFailedRef.current?.('network');
          if (retryTimer.current) clearTimeout(retryTimer.current);
          // Форсируем повтор для того же bodyKey без ожидания нового
          // изменения параметров (ТЗ §15.4: retry через 5 с при сетевой ошибке).
          retryTimer.current = setTimeout(() => setRetryTick((t) => t + 1), 5000);
        }
      }
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceSlug, bodyKey, enabled, debounceMs, retryTick]);

  useEffect(
    () => () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    [],
  );

  return {
    status,
    data,
    fieldErrors,
    offline,
    // Синхронная привязка к exact bodyKey: даже если status в первом render
    // после смены параметров формально ещё 'fresh', несовпадение ключей
    // немедленно блокирует checkout — эффектов ждать не нужно.
    canAddToCart: status === 'fresh' && freshForKey !== null && freshForKey === bodyKey,
  };
}
