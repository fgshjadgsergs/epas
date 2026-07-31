'use client';

import { useEffect, useRef, useState } from 'react';
import { BadgePercent, Check, Clock3, Share2, TrendingDown, Upload, Wand2 } from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';
import { DEMO_PRICING_NOTICE, showDemoPricingNotice, type PricingMode } from '@/lib/demo-pricing';
import type { CalcResult } from '@/lib/calc/pricing';

/** Плавная анимация числа при пересчёте. */
function useCountUp(value: number, ms = 400) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

export function PricePanel({
  result,
  b2b,
  onB2b,
  qty,
  onCheckout,
  /** Блок 2: без свежего подтверждённого backend-расчёта заказ недоступен. */
  checkoutDisabled = false,
  /** Цена показана, но уже не соответствует текущим параметрам (пересчитывается). */
  stale = false,
  /** Режим прайса от backend: DEMO включает пометку о демонстрационных ценах. */
  pricingMode = null,
}: {
  result: CalcResult;
  b2b: boolean;
  onB2b: (v: boolean) => void;
  qty: number;
  onCheckout?: () => void;
  checkoutDisabled?: boolean;
  stale?: boolean;
  pricingMode?: PricingMode | null;
}) {
  const amount = b2b ? result.priceWithVat : result.price;
  const display = useCountUp(amount);
  const [copied, setCopied] = useState(false);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard недоступен */
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      {/* B2B-переключатель */}
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-border p-1 text-sm">
        <button
          type="button"
          onClick={() => onB2b(false)}
          className={cn('h-9 rounded-lg font-medium', !b2b ? 'bg-primary text-primary-fg' : 'text-muted')}
        >
          Физлицо
        </button>
        <button
          type="button"
          onClick={() => onB2b(true)}
          className={cn('h-9 rounded-lg font-medium', b2b ? 'bg-primary text-primary-fg' : 'text-muted')}
        >
          Юрлицо
        </button>
      </div>

      <p className="text-sm text-muted">Стоимость{b2b ? ' с НДС' : ''}</p>
      <p
        key={amount}
        className={cn('price-pop text-4xl font-extrabold tabular-nums', stale && 'opacity-50')}
        aria-live="polite"
      >
        {formatPrice(display)}
      </p>
      {stale && <p className="mt-1 text-xs text-muted">Пересчитываем цену для новых параметров…</p>}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">{formatPrice(result.pricePerUnit)} за шт.</span>
        {result.savingsPct > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
            <TrendingDown size={12} /> выгода {result.savingsPct}%
          </span>
        )}
      </div>

      {/* Скидка 5% за онлайн-заказ (эталонная посадочная из SEO-анализа). */}
      <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-success/10 px-2.5 py-1.5 text-xs font-medium text-success">
        <BadgePercent size={14} /> Скидка 5% за онлайн-заказ — уже в цене
      </p>

      <dl className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Готовность</dt>
          <dd className="text-right font-medium">{result.readyDateLabel}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Тираж</dt>
          <dd className="font-medium">{qty.toLocaleString('ru-RU')} шт.</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted">Дедлайн оформления</dt>
          <dd className="inline-flex items-center gap-1 font-medium">
            <Clock3 size={13} className="text-warning" /> сегодня до {result.cutoff}
          </dd>
        </div>
      </dl>

      <button
        onClick={onCheckout}
        disabled={checkoutDisabled}
        aria-disabled={checkoutDisabled}
        className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-fg hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-primary"
      >
        <Upload size={17} /> Загрузить макет и заказать
      </button>
      <button
        onClick={share}
        className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-medium hover:bg-surface-2"
      >
        {copied ? <Check size={15} className="text-success" /> : <Share2 size={15} />}
        {copied ? 'Ссылка скопирована' : 'Поделиться расчётом'}
      </button>
      <a
        href="#"
        className="mt-3 flex items-center justify-center gap-1.5 text-sm text-primary hover:underline"
      >
        <Wand2 size={14} /> Нет макета? Заказать дизайн
      </a>
      <p className="mt-3 text-center text-xs text-subtle">
        Цена актуальна 15 минут. Не является публичной офертой.
      </p>
      {showDemoPricingNotice(pricingMode) && (
        <p className="mt-2 text-center text-xs text-warning">{DEMO_PRICING_NOTICE}</p>
      )}
    </div>
  );
}
