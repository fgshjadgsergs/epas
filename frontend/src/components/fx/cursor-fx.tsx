'use client';

import { useEffect } from 'react';

/**
 * Курсор-реактивные эффекты для элементов с классами .spotlight / .tilt.
 * Один passive-слушатель pointermove, троттлинг через requestAnimationFrame,
 * пишет только CSS-переменные (анимация — на GPU). Включается лишь на устройствах
 * с настоящей мышью (pointer: fine) и выключается при prefers-reduced-motion.
 */
export function CursorFX() {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;

    let raf = 0;
    let lastTarget: Element | null = null;
    let ex = 0;
    let ey = 0;
    let current: HTMLElement | null = null;

    const SEL = '.spotlight, .tilt';

    const reset = (el: HTMLElement) => {
      el.style.removeProperty('--rx');
      el.style.removeProperty('--ry');
    };

    const apply = () => {
      raf = 0;
      const card = (lastTarget && (lastTarget as HTMLElement).closest?.(SEL)) as HTMLElement | null;
      if (card !== current) {
        if (current) reset(current);
        current = card;
      }
      if (!card) return;

      const r = card.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const px = (ex - r.left) / r.width; // 0..1
      const py = (ey - r.top) / r.height;

      if (card.classList.contains('spotlight')) {
        card.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
        card.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
      }
      if (card.classList.contains('tilt')) {
        card.style.setProperty('--rx', `${((px - 0.5) * 9).toFixed(2)}deg`);
        card.style.setProperty('--ry', `${(-(py - 0.5) * 9).toFixed(2)}deg`);
      }
    };

    const onMove = (e: PointerEvent) => {
      lastTarget = e.target as Element;
      ex = e.clientX;
      ey = e.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (raf) cancelAnimationFrame(raf);
      if (current) reset(current);
    };
  }, []);

  return null;
}
