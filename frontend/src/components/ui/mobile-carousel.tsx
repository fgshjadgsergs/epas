'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Горизонтальная карусель для мобильных на CSS scroll-snap (без библиотек).
 * Раскладку задаёт вызывающая сторона классами: на мобиле — flex-лента со
 * snap-прокруткой, с брейкпоинта — обычная сетка (overflow-visible), и тогда
 * компонент ведёт себя как простой div.
 *
 * Автопрокрутка листает по одному слайду и останавливается НАВСЕГДА при любом
 * взаимодействии с каруселью (тач/клик, колесо, клавиатура, фокус). Не работает:
 * при prefers-reduced-motion, вне зоны видимости, и когда листать нечего
 * (десктопная сетка или всё влезло).
 */
export function MobileCarousel({
  auto = true,
  interval = 3500,
  className,
  children,
}: {
  /** Автопрокрутка (до первого взаимодействия). */
  auto?: boolean;
  /** Пауза между слайдами, мс. */
  interval?: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !auto) return;
    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    // Любое взаимодействие с каруселью — стоп навсегда.
    let stopped = false;
    const stop = () => {
      stopped = true;
    };
    const events = ['pointerdown', 'wheel', 'keydown', 'focusin'] as const;
    events.forEach((e) => el.addEventListener(e, stop, { passive: true }));

    // Листаем только когда карусель на экране.
    let inView = false;
    let io: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
      }, { threshold: 0.35 });
      io.observe(el);
    } else {
      inView = true;
    }

    const id = setInterval(() => {
      if (stopped || !inView) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max < 8) return; // сетка/всё влезло — листать нечего
      if (el.scrollLeft >= max - 8) {
        el.scrollTo({ left: 0, behavior: 'smooth' }); // цикл: с конца в начало
        return;
      }
      // Следующий слайд — первый ребёнок правее текущей позиции прокрутки.
      const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
      const next = (Array.from(el.children) as HTMLElement[]).find(
        (s) => s.offsetLeft - pad > el.scrollLeft + 8,
      );
      el.scrollTo({ left: next ? Math.min(next.offsetLeft - pad, max) : max, behavior: 'smooth' });
    }, interval);

    return () => {
      clearInterval(id);
      io?.disconnect();
      events.forEach((e) => el.removeEventListener(e, stop));
    };
  }, [auto, interval]);

  // relative — чтобы offsetLeft слайдов считался от самой карусели.
  return (
    <div ref={ref} data-carousel className={`relative ${className ?? ''}`}>
      {children}
    </div>
  );
}
