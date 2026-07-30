'use client';

import { useEffect, useRef } from 'react';
import {
  buildUrl,
  mergeSearch,
  parseUrlState,
  serializeUrlState,
  type UrlStateSpec,
} from '@/lib/calculator/url-state';

/**
 * Синхронизация состояния калькулятора с URL (ТЗ «URL-адреса в калькуляторах»).
 *
 * Поведение:
 * - изменение shareable-параметра → debounce 1000 мс → один pushState
 *   (три быстрых изменения = один push, не три);
 * - push не выполняется, если итоговый URL не изменился;
 * - инициализация: состояние восстанавливается из URL, push НЕ делается;
 *   некорректные значения игнорируются (default) и URL нормализуется
 *   через replaceState (без новой записи истории);
 * - popstate («Назад»): состояние восстанавливается из URL, push и
 *   аналитический hit НЕ делаются;
 * - чужие query-параметры (utm_* и т.п.) сохраняются как есть;
 * - таймер и слушатель снимаются при unmount.
 *
 * Только клиент: сервер/SSR не затрагивается (эффекты не выполняются).
 */
export function useCalculatorUrlState(options: {
  spec: UrlStateSpec;
  /** Текущие shareable-значения состояния калькулятора. */
  values: Record<string, string | number | boolean | undefined>;
  /** Восстановление состояния из URL (init и popstate). */
  onRestore: (values: Record<string, string>) => void;
  /** Вызывается ПОСЛЕ успешного pushState — точка отправки аналитики. */
  onUrlPushed?: (url: string, previousUrl: string) => void;
  debounceMs?: number;
}): void {
  const { spec, values, onRestore, onUrlPushed, debounceMs = 1000 } = options;

  const specRef = useRef(spec);
  specRef.current = spec;
  const restoreRef = useRef(onRestore);
  restoreRef.current = onRestore;
  const pushedRef = useRef(onUrlPushed);
  pushedRef.current = onUrlPushed;

  /** URL, который сейчас считается «текущим» (защита от duplicate push). */
  const currentUrlRef = useRef('');
  /** true, пока идёт восстановление из URL (init/popstate) — push подавлен. */
  const restoringRef = useRef(false);
  const initializedRef = useRef(false);

  // Инициализация из URL + подписка на popstate. Выполняется один раз.
  useEffect(() => {
    const s = specRef.current;
    const parsed = parseUrlState(s, window.location.search);
    currentUrlRef.current = window.location.pathname + window.location.search;

    restoringRef.current = true;
    if (Object.keys(parsed.values).length > 0) restoreRef.current(parsed.values);

    // Некорректные значения → нормализованный URL через replaceState
    // (не pushState — без новой записи истории и без hit).
    if (parsed.invalidKeys.length > 0) {
      const serialized = serializeUrlState(s, parsed.values);
      const search = mergeSearch(s, serialized, window.location.search);
      const normalized = buildUrl(window.location.pathname, search);
      window.history.replaceState(window.history.state, '', normalized);
      currentUrlRef.current = normalized;
    }
    // Снимаем флаг в микротаске — после того как setState из onRestore применён.
    queueMicrotask(() => {
      restoringRef.current = false;
      initializedRef.current = true;
    });

    const onPop = () => {
      restoringRef.current = true;
      const restored = parseUrlState(specRef.current, window.location.search);
      currentUrlRef.current = window.location.pathname + window.location.search;
      restoreRef.current(restored.values);
      queueMicrotask(() => {
        restoringRef.current = false;
      });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Debounce-обновление URL при изменении значений.
  useEffect(() => {
    if (!initializedRef.current || restoringRef.current) return;
    const timer = setTimeout(() => {
      if (restoringRef.current) return;
      const s = specRef.current;
      const serialized = serializeUrlState(s, values);
      const search = mergeSearch(s, serialized, window.location.search);
      const nextUrl = buildUrl(window.location.pathname, search);
      const prevUrl = currentUrlRef.current;
      if (nextUrl === prevUrl) return; // duplicate push запрещён
      window.history.pushState(window.history.state, '', nextUrl);
      currentUrlRef.current = nextUrl;
      pushedRef.current?.(nextUrl, prevUrl);
    }, debounceMs);
    return () => clearTimeout(timer); // отмена предыдущего таймера / unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(values), debounceMs]);
}
