'use client';

import { useEffect, useRef, useState } from 'react';
import { formatPrice } from '@/lib/utils';

/**
 * Анимированная цена: при изменении значения число плавно «доезжает» до нового
 * (rAF-твин, ease-out). Табличные цифры — чтобы ширина не прыгала.
 * При prefers-reduced-motion значение меняется мгновенно.
 */
export function AnimatedPrice({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const raf = useRef(0);
  const from = useRef(value);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    const b = value;
    const dur = 450;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      const cur = a + (b - a) * e;
      setShown(cur);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else from.current = b;
    };
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);

  return <span className={`tabnum ${className ?? ''}`}>{formatPrice(Math.round(shown))}</span>;
}
