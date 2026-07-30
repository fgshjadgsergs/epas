'use client';

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Появление элемента при попадании в зону видимости (fade-up).
 * Лёгкое: IntersectionObserver + CSS-переход, без анимационных библиотек.
 * Доступность: под prefers-reduced-motion CSS показывает контент сразу.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = 'div',
  stagger = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: ElementType;
  /** Каскадное появление прямых детей (для сеток карточек) вместо фейда контейнера. */
  stagger?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={cn(stagger ? 'stagger' : 'reveal', visible && 'is-visible', className)}
      style={stagger ? undefined : { transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

/** Счётчик-анимация числа при появлении в зоне видимости. */
export function StatCounter({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Пересчёт числа — не «движение» в смысле WCAG (нет смещения/масштаба),
    // короче 5 с (2.2.2), поэтому работает и при prefers-reduced-motion.
    if (typeof IntersectionObserver === 'undefined') {
      setShown(value);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const duration = 1200;
        const start = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - start) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          setShown(value * eased);
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value]);

  const formatted = shown.toLocaleString('ru-RU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
