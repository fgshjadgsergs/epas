'use client';

import { useEffect, useState } from 'react';
import { getCalculatorDefinition, type CalculatorDefinitionDto } from '@/lib/api/calculator';

/**
 * Определение калькулятора с backend. 404 или сеть → null (эталонный
 * калькулятор работает и без backend — на локальном демо-расчёте).
 *
 * Расчёт цены — см. @/hooks/use-server-calculation (useServerCalculation):
 * отслеживает свежесть результата и блокирует add-to-cart при stale/error
 * (Codex review, блок 2). Прежний useBackendCalculation отсюда удалён.
 */
export function useCalculatorDefinition(serviceSlug: string): {
  definition: CalculatorDefinitionDto | null;
  loaded: boolean;
} {
  const [definition, setDefinition] = useState<CalculatorDefinitionDto | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Пустой slug = у страницы нет calculator binding: definition не
    // запрашивается вовсе (никакого угадывания slug по pathname).
    if (!serviceSlug) {
      setDefinition(null);
      setLoaded(true);
      return;
    }
    getCalculatorDefinition(serviceSlug)
      .then((def) => {
        if (!cancelled) setDefinition(def);
      })
      .catch(() => {
        /* нет определения — остаёмся на локальном фолбэке */
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [serviceSlug]);

  return { definition, loaded };
}
