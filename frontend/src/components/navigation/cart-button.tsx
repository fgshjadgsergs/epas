'use client';

import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useCart } from '@/lib/cart/store';

/**
 * Счётчик корзины из серверного ответа (itemCount). Корзина загружается один
 * раз при монтировании шапки: store не повторяет запрос, пока данные уже
 * есть, поэтому GET /cart не уходит на каждый рендер.
 */
export function CartButton() {
  const count = useCart((s) => s.cart?.itemCount ?? 0);
  const loadCart = useCart((s) => s.loadCart);

  // Корзина зависит от cookie и известна только на клиенте — бейдж рисуем
  // после монтирования, иначе SSR-разметка разойдётся с клиентской.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    void loadCart();
  }, [loadCart]);

  return (
    <Link
      href="/korzina/"
      aria-label="Корзина"
      className="relative grid h-11 w-11 place-items-center rounded-lg text-fg hover:bg-surface-2"
    >
      <ShoppingCart size={20} aria-hidden />
      {mounted && count > 0 && (
        <span
          aria-live="polite"
          className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-fg"
        >
          {count}
        </span>
      )}
    </Link>
  );
}
