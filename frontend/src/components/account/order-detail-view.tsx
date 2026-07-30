'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Info } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { useOrder } from '@/lib/orders/use-order';
import { loginUrlWithReturn } from '@/lib/auth/return-url';
import { formatOrderDate, orderStatusBadge, orderStatusLabel } from '@/lib/orders/presentation';
import { DEMO_PRICING_NOTICE, showDemoPricingNotice } from '@/lib/demo-pricing';
import { ArtworkSection } from '@/components/account/artwork/artwork-section';
import type { OrderItemDto } from '@/lib/api/orders';

const rub = (amountMinor: number) => formatPrice(amountMinor / 100);
const ORDERS_PATH = '/lichnyy-kabinet/moi-zakazy/';

/**
 * Карточка заказа.
 *
 * Позиции показываются строго по снимкам из OrderItem: название, конфигурация,
 * количество и суммы зафиксированы в момент оформления и не перечитываются
 * из каталога — иначе история заказа менялась бы задним числом.
 *
 * Чужой заказ backend отдаёт как 404, и экран показывает то же самое.
 */
export function OrderDetailView({ orderId }: { orderId: string }) {
  const { state, reload } = useOrder(orderId);

  if (state.status === 'loading') {
    return (
      <Shell>
        <p role="status" className="text-muted">
          Загружаем заказ…
        </p>
      </Shell>
    );
  }

  if (state.status === 'unauthorized') {
    return (
      <Shell>
        <Notice
          title="Войдите, чтобы увидеть заказ"
          description="Заказ доступен только владельцу аккаунта."
          action={
            <Link
              href={loginUrlWithReturn(ORDERS_PATH)}
              className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
            >
              Войти
            </Link>
          }
        />
      </Shell>
    );
  }

  if (state.status === 'notFound') {
    return (
      <Shell>
        <Notice
          title="Заказ не найден"
          description="Такого заказа нет либо он принадлежит другому аккаунту."
          action={
            <Link
              href={ORDERS_PATH}
              className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
            >
              К моим заказам
            </Link>
          }
        />
      </Shell>
    );
  }

  if (state.status === 'error') {
    return (
      <Shell>
        <Notice
          title="Не удалось загрузить заказ"
          description={state.message}
          action={
            <button
              onClick={reload}
              className="inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm font-medium hover:border-primary hover:text-primary"
            >
              Повторить
            </button>
          }
        />
      </Shell>
    );
  }

  const { order } = state;

  return (
    <Shell>
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">Заказ {order.orderNumber}</h2>
            <p className="text-sm text-subtle">{formatOrderDate(order.createdAt)}</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${orderStatusBadge(order.status)}`}>
            {orderStatusLabel(order.status)}
          </span>
        </div>

        {showDemoPricingNotice(order.pricingMode) && (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
            <Info size={13} className="mt-0.5 shrink-0" />
            {DEMO_PRICING_NOTICE}
          </p>
        )}
      </div>

      <section className="mt-4 rounded-2xl border border-border bg-surface p-5">
        <h3 className="font-semibold">Состав заказа</h3>
        <ul className="mt-3 space-y-3">
          {order.items.map((item) => (
            <OrderLine key={item.id} item={item} orderId={order.id} />
          ))}
        </ul>

        <dl className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Товары</dt>
            <dd className="font-medium">{rub(order.totals.itemsSubtotal.amountMinor)}</dd>
          </div>
          {order.totals.discounts.amountMinor > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted">Скидка</dt>
              <dd className="font-medium text-success">−{rub(order.totals.discounts.amountMinor)}</dd>
            </div>
          )}
        </dl>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="font-semibold">Итого</span>
          <span className="text-xl font-extrabold">
            {rub(order.totals.total.amountMinor)}
            <span className="ml-1 text-xs font-normal text-subtle">{order.currency}</span>
          </span>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-surface p-5">
        <h3 className="font-semibold">Контакты</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label="Имя" value={order.contactName} />
          <Row label="Телефон" value={order.contactPhone} />
          <Row label="E-mail" value={order.contactEmail} />
          {order.customerComment && <Row label="Комментарий" value={order.customerComment} />}
        </dl>
      </section>

      {order.statusHistory.length > 0 && (
        <section className="mt-4 rounded-2xl border border-border bg-surface p-5">
          <h3 className="font-semibold">История статусов</h3>
          <ol className="mt-3 space-y-3">
            {order.statusHistory.map((entry, index) => (
              <li key={`${entry.createdAt}-${index}`} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                <span className="min-w-0">
                  <span className="font-medium">{orderStatusLabel(entry.toStatus)}</span>
                  <span className="ml-2 text-xs text-subtle">{formatOrderDate(entry.createdAt)}</span>
                  {entry.comment && <span className="mt-0.5 block text-xs text-muted">{entry.comment}</span>}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </Shell>
  );
}

function OrderLine({ item, orderId }: { item: OrderItemDto; orderId: string }) {
  return (
    <li className="border-b border-border pb-3 last:border-0 last:pb-0">
      <div className="flex justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{item.title}</p>
          <p className="mt-0.5 text-xs text-muted">{summarize(item.configuration)}</p>
          <p className="mt-0.5 text-xs text-subtle">
            {item.quantity} шт. · {item.production.workingDays} раб. дн.
          </p>
        </div>
        <p className="shrink-0 font-semibold">{rub(item.lineTotal.amountMinor)}</p>
      </div>
      {/* Название берётся из immutable snapshot позиции — каталог не запрашивается. */}
      <ArtworkSection orderId={orderId} itemId={item.id} title={item.title} />
    </li>
  );
}

/** Конфигурация из снимка заказа (только отображение). */
function summarize(configuration: Record<string, unknown>): string {
  return Object.entries(configuration)
    .filter(([, value]) => value !== null && value !== '' && typeof value !== 'object')
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' · ');
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words font-medium">{value}</dd>
    </div>
  );
}

function Notice({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-8 text-center">
      <AlertTriangle size={32} className="mx-auto text-warning" />
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{description}</p>
      <div className="mt-4">{action}</div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Link
        href={ORDERS_PATH}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary"
      >
        <ArrowLeft size={15} /> Все заказы
      </Link>
      {children}
    </div>
  );
}
