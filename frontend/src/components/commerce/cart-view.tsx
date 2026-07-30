'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { AlertTriangle, Info, RefreshCw, ShoppingCart, Trash2 } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Button } from '@/components/ui/button';
import { Reveal } from '@/components/reveal';
import { cn, formatPrice } from '@/lib/utils';
import { useCart } from '@/lib/cart/store';
import { DEMO_PRICING_NOTICE, showDemoPricingNotice } from '@/lib/demo-pricing';
import type { CartItemDto } from '@/lib/api/cart';

/** Копейки → рубли для отображения (суммы считает backend). */
const rub = (amountMinor: number) => formatPrice(amountMinor / 100);

/**
 * Корзина полностью на серверных данных: состав, цены, статусы позиций,
 * суммы и возможность оформления приходят из GET /api/v1/cart. Клиент
 * ничего не пересчитывает.
 */
export function CartView() {
  const cart = useCart((s) => s.cart);
  const loading = useCart((s) => s.loading);
  const error = useCart((s) => s.error);
  const pending = useCart((s) => s.pending);
  const loadCart = useCart((s) => s.loadCart);
  const removeItem = useCart((s) => s.removeItem);
  const refreshItem = useCart((s) => s.refreshItem);

  useEffect(() => {
    void loadCart();
  }, [loadCart]);

  // Первая загрузка.
  if (!cart && loading) {
    return (
      <Container className="flex min-h-[50vh] items-center justify-center py-16">
        <p className="text-muted" role="status">
          Загружаем корзину…
        </p>
      </Container>
    );
  }

  // Ошибка загрузки — с возможностью повтора.
  if (!cart && error) {
    return (
      <Container className="flex min-h-[50vh] flex-col items-center justify-center py-16 text-center">
        <AlertTriangle size={36} className="mb-3 text-danger" />
        <h1 className="text-2xl font-bold">Не удалось загрузить корзину</h1>
        <p className="mt-2 text-muted">{error}</p>
        <Button className="mt-6" onClick={() => void loadCart({ force: true })}>
          Повторить
        </Button>
      </Container>
    );
  }

  if (!cart || cart.itemCount === 0) {
    return (
      <Container className="flex min-h-[50vh] flex-col items-center justify-center py-16 text-center">
        <Reveal className="flex flex-col items-center">
          <ShoppingCart size={40} className="mb-4 text-subtle" />
          <h1 className="text-2xl font-bold">Корзина пуста</h1>
          <p className="mt-2 text-muted">Выберите услугу, рассчитайте стоимость и добавьте в корзину.</p>
          <Button href="/poligrafiya/" className="mt-6">
            Перейти в каталог
          </Button>
        </Reveal>
      </Container>
    );
  }

  return (
    <Container className="py-8">
      <Reveal as="h1" className="text-2xl font-bold sm:text-3xl">
        Корзина
      </Reveal>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <Reveal as="ul" delay={60} className="space-y-3">
          {cart.items.map((item) => (
            <CartLine
              key={item.id}
              item={item}
              disabled={pending}
              onRemove={() => void removeItem(item.id)}
              onRefresh={() => void refreshItem(item.id)}
            />
          ))}
        </Reveal>

        <Reveal delay={120} className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <dl className="space-y-2 text-sm">
              <Row k={`Товары (${cart.itemCount})`} v={rub(cart.totals.itemsSubtotal.amountMinor)} />
              {cart.totals.discounts.amountMinor > 0 && (
                <Row k="Скидка" v={`−${rub(cart.totals.discounts.amountMinor)}`} accent />
              )}
            </dl>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <span className="font-semibold">Итого</span>
              <span className="text-2xl font-extrabold">{rub(cart.totals.total.amountMinor)}</span>
            </div>
            <p className="mt-1 text-xs text-subtle">Доставка рассчитывается на следующем этапе</p>

            {showDemoPricingNotice(cart.pricingMode) && (
              <p className="mt-3 inline-flex items-start gap-1.5 rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
                <Info size={13} className="mt-0.5 shrink-0" />
                {DEMO_PRICING_NOTICE}
              </p>
            )}

            {!cart.canCheckout && (
              <p className="mt-3 text-xs text-warning">
                Часть позиций требует пересчёта или недоступна — оформление недоступно.
              </p>
            )}

            {/* Оформление открыто только когда backend подтвердил canCheckout:
                решение принимает сервер, клиент его не переопределяет. */}
            {cart.canCheckout ? (
              <Link
                href="/oformlenie-zakaza/"
                className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-primary px-3 text-center text-sm font-semibold text-primary-fg hover:bg-primary-hover"
              >
                Оформить заказ
              </Link>
            ) : (
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="mt-4 flex h-12 w-full cursor-not-allowed items-center justify-center rounded-xl bg-surface-2 px-3 text-center text-sm font-semibold text-subtle"
              >
                Оформить заказ
              </button>
            )}
            <Link
              href="/poligrafiya/"
              className="mt-3 block text-center text-sm text-muted hover:text-primary"
            >
              Продолжить покупки
            </Link>
          </div>
        </Reveal>
      </div>
    </Container>
  );
}

function CartLine({
  item,
  disabled,
  onRemove,
  onRefresh,
}: {
  item: CartItemDto;
  disabled: boolean;
  onRemove: () => void;
  onRefresh: () => void;
}) {
  const isStale = item.status === 'STALE';
  const isBroken = item.status === 'UNAVAILABLE' || item.status === 'REQUIRES_RECALCULATION';

  return (
    <li
      className={cn(
        'flex gap-4 rounded-2xl border bg-surface p-4',
        isBroken ? 'border-danger/40' : isStale ? 'border-warning/40' : 'border-border',
      )}
      data-status={item.status}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold">{item.title}</p>
            <p className="mt-0.5 text-sm text-muted">{summarize(item.configuration)}</p>
            <p className="mt-0.5 text-xs text-subtle">
              Срок изготовления: {item.production.workingDays} раб. дн.
            </p>
          </div>
          <button
            onClick={onRemove}
            disabled={disabled}
            className="text-subtle hover:text-danger disabled:opacity-40"
            aria-label={`Удалить «${item.title}»`}
          >
            <Trash2 size={18} />
          </button>
        </div>

        {isStale && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning">
            <AlertTriangle size={14} className="shrink-0" />
            <span>Цена изменилась — пересчитайте позицию.</span>
            <button
              onClick={onRefresh}
              disabled={disabled}
              className="inline-flex items-center gap-1 rounded-lg border border-warning/40 px-2 py-1 font-medium hover:bg-warning/10 disabled:opacity-40"
            >
              <RefreshCw size={12} /> Пересчитать
            </button>
          </div>
        )}

        {isBroken && (
          <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">
            <AlertTriangle size={14} className="mr-1 inline shrink-0" />
            Услуга сейчас недоступна — удалите позицию, чтобы оформить заказ.
          </p>
        )}

        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm text-muted">{item.quantity} шт.</span>
          <p className={cn('font-bold', isBroken && 'text-subtle line-through')}>
            {rub(item.lineTotal.amountMinor)}
          </p>
        </div>
      </div>
    </li>
  );
}

/** Краткое описание конфигурации из snapshot (только отображение). */
function summarize(configuration: Record<string, unknown>): string {
  return Object.entries(configuration)
    .filter(([, value]) => value !== null && value !== '' && typeof value !== 'object')
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' · ');
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{k}</dt>
      <dd className={accent ? 'font-medium text-success' : 'font-medium'}>{v}</dd>
    </div>
  );
}
