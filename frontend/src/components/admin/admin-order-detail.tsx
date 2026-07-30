'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Info, ShieldAlert } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { tokenStorage } from '@/lib/api/auth';
import { updateAdminOrderStatus, type AdminOrderDto, type AdminOrderItemDto, type AdminOrderStatus } from '@/lib/api/admin-orders';
import { useAdminOrder } from '@/lib/admin/use-admin-order';
import { ordersListPathWithFilters } from '@/lib/admin/last-list-search';
import { describeStatusChangeError, type StatusChangeError } from '@/lib/admin/status-change-errors';
import { adminStatusBadge, adminStatusLabel, adminTransitionAction, formatAdminDate } from '@/lib/admin/presentation';
import { loginUrlWithReturn } from '@/lib/auth/return-url';
import { DEMO_PRICING_NOTICE, showDemoPricingNotice } from '@/lib/demo-pricing';
import { OrderArtworksCard } from '@/components/admin/artworks/order-artworks-card';

const rub = (amountMinor: number) => formatPrice(amountMinor / 100);
const ADMIN_ORDERS_PATH = '/admin/orders/';

/**
 * Карточка заказа в админке.
 *
 * Позиции — строго из OrderItem snapshots (каталог не запрашивается). Доступные
 * действия берутся из order.allowedTransitions (карта переходов — на backend,
 * во фронте не дублируется). Служебные поля (idempotencyKey, sourceCartId,
 * snapshot-токены) в ответе отсутствуют и не показываются.
 */
export function AdminOrderDetail({ orderId }: { orderId: string }) {
  const { state, reload } = useAdminOrder(orderId);

  if (state.status === 'loading') {
    return (
      <Shell>
        <div className="h-40 animate-pulse rounded-2xl border border-border bg-surface" aria-hidden />
        <p role="status" className="sr-only">
          Загружаем заказ…
        </p>
      </Shell>
    );
  }

  if (state.status === 'unauthorized') {
    return (
      <Shell>
        <Notice title="Сессия истекла" tone="warning">
          <Link href={loginUrlWithReturn(ADMIN_ORDERS_PATH)} className="font-semibold text-primary underline">
            Войдите заново
          </Link>
          , чтобы открыть заказ.
        </Notice>
      </Shell>
    );
  }

  if (state.status === 'forbidden') {
    return (
      <Shell>
        <Notice title="Нет доступа" tone="danger">
          У вашей учётной записи нет прав на просмотр этого заказа.
        </Notice>
      </Shell>
    );
  }

  if (state.status === 'notFound') {
    return (
      <Shell>
        <Notice title="Заказ не найден" tone="muted">
          Возможно, ссылка устарела.{' '}
          <Link href={ADMIN_ORDERS_PATH} className="font-semibold text-primary underline">
            К списку заказов
          </Link>
        </Notice>
      </Shell>
    );
  }

  if (state.status === 'error') {
    return (
      <Shell>
        <Notice title="Не удалось загрузить заказ" tone="danger">
          {state.message}{' '}
          <button onClick={reload} className="font-semibold text-primary underline">
            Повторить
          </button>
        </Notice>
      </Shell>
    );
  }

  return <Loaded order={state.order} reload={reload} />;
}

function Loaded({ order, reload }: { order: AdminOrderDto; reload: () => void }) {
  return (
    <Shell>
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">Заказ {order.orderNumber}</h2>
            <p className="text-sm text-subtle">Создан {formatAdminDate(order.createdAt)}</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${adminStatusBadge(order.status)}`}>
            {adminStatusLabel(order.status)}
          </span>
        </div>
        {showDemoPricingNotice(order.pricingMode) && (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
            <Info size={13} className="mt-0.5 shrink-0" />
            {DEMO_PRICING_NOTICE}
          </p>
        )}
      </div>

      <StatusActions order={order} reload={reload} />

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Контакты">
          <dl className="space-y-2 text-sm">
            <Row label="Имя" value={order.contactName} />
            <Row
              label="Телефон"
              value={
                <a href={`tel:${order.contactPhone.replace(/[^\d+]/g, '')}`} className="text-primary hover:underline">
                  {order.contactPhone}
                </a>
              }
            />
            <Row
              label="E-mail"
              value={
                <a href={`mailto:${order.contactEmail}`} className="break-all text-primary hover:underline">
                  {order.contactEmail}
                </a>
              }
            />
            {order.customerComment && <Row label="Комментарий" value={order.customerComment} />}
          </dl>
        </Card>

        <Card title="Итоги">
          <dl className="space-y-2 text-sm">
            <Row label="Товары" value={rub(order.totals.itemsSubtotal.amountMinor)} />
            {order.totals.discounts.amountMinor > 0 && (
              <Row label="Скидка" value={`−${rub(order.totals.discounts.amountMinor)}`} />
            )}
            <div className="flex items-center justify-between border-t border-border pt-2">
              <dt className="font-semibold">Итого</dt>
              <dd className="text-lg font-extrabold">
                {rub(order.totals.total.amountMinor)}
                <span className="ml-1 text-xs font-normal text-subtle">{order.currency}</span>
              </dd>
            </div>
          </dl>
        </Card>
      </section>

      <Card title="Состав заказа" className="mt-4">
        <ul className="space-y-3">
          {order.items.map((item) => (
            <OrderLine key={item.id} item={item} currency={order.currency} />
          ))}
        </ul>
      </Card>

      <OrderArtworksCard
        orderNumber={order.orderNumber}
        items={order.items.map((item) => ({ id: item.id, title: item.title }))}
      />

      {order.statusHistory.length > 0 && (
        <Card title="История статусов" className="mt-4">
          <ol className="space-y-3">
            {order.statusHistory.map((entry, index) => (
              <li key={`${entry.createdAt}-${index}`} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                <span className="min-w-0">
                  <span className="font-medium">{adminStatusLabel(entry.toStatus)}</span>
                  <span className="ml-2 text-xs text-subtle">{formatAdminDate(entry.createdAt)}</span>
                  {/* Сотрудник — только безопасное имя, без сырого UUID. */}
                  {entry.changedBy && (
                    <span className="ml-2 text-xs text-muted">· {entry.changedBy.displayName}</span>
                  )}
                  {entry.comment && <span className="mt-0.5 block text-xs text-muted">{entry.comment}</span>}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </Shell>
  );
}

/** Кнопки переходов строго по allowedTransitions от backend. */
function StatusActions({ order, reload }: { order: AdminOrderDto; reload: () => void }) {
  const router = useRouter();
  const [target, setTarget] = useState<AdminOrderStatus | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState<StatusChangeError | null>(null);

  if (order.allowedTransitions.length === 0 && !target) {
    return (
      <p className="mt-4 rounded-2xl border border-border bg-surface px-5 py-3 text-sm text-muted">
        Действий со статусом нет: заказ в статусе «{adminStatusLabel(order.status)}».
      </p>
    );
  }

  async function confirm() {
    if (submittingRef.current || !target) return; // защита от двойного клика
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);

    const token = tokenStorage.getAccessToken();
    if (!token) {
      setError({ kind: 'unauthorized', message: 'Сессия истекла. Войдите заново.', reload: false });
      submittingRef.current = false;
      setSubmitting(false);
      return;
    }

    try {
      await updateAdminOrderStatus(order.id, { status: target, ...(comment.trim() ? { comment: comment.trim() } : {}) }, token);
      // Без optimistic-обновления: перечитываем заказ и историю с backend.
      setTarget(null);
      setComment('');
      reload();
    } catch (err) {
      const described = describeStatusChangeError(err);
      setError(described);
      if (described.kind === 'unauthorized') {
        router.push(loginUrlWithReturn(`/admin/orders/${order.id}/`));
      }
      // При 409 показываем актуальное состояние — заказ перечитывается.
      if (described.reload) reload();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
      <h3 className="font-semibold">Действия</h3>

      {!target ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {order.allowedTransitions.map((status) => (
            <button
              key={status}
              onClick={() => {
                setError(null);
                setTarget(status);
              }}
              className="inline-flex h-10 items-center rounded-xl border border-danger/40 px-4 text-sm font-semibold text-danger hover:bg-danger/10"
            >
              {adminTransitionAction(status)}
            </button>
          ))}
        </div>
      ) : (
        // Подтверждающее окно (inline dialog) с необязательным комментарием.
        <div role="dialog" aria-modal="false" aria-label="Подтверждение смены статуса" className="mt-3">
          <p className="text-sm">
            Перевести заказ в статус «<strong>{adminStatusLabel(target)}</strong>»? Действие изменит статус для клиента.
          </p>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-muted">Комментарий (необязательно)</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              maxLength={1000}
              className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-fg focus:border-primary focus:outline-none"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={confirm}
              disabled={submitting}
              className="inline-flex h-10 items-center rounded-xl bg-danger px-4 text-sm font-semibold text-white hover:bg-danger/90 disabled:opacity-60"
            >
              {submitting ? 'Сохраняем…' : `Подтвердить: ${adminTransitionAction(target)}`}
            </button>
            <button
              onClick={() => {
                setTarget(null);
                setError(null);
              }}
              disabled={submitting}
              className="inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-60"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          {error.message}
        </p>
      )}
    </div>
  );
}

function OrderLine({ item, currency }: { item: AdminOrderItemDto; currency: string }) {
  return (
    <li className="border-b border-border pb-3 last:border-0 last:pb-0">
      <div className="flex justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{item.title}</p>
          <p className="mt-0.5 text-xs text-muted">{summarize(item.configuration)}</p>
          <p className="mt-0.5 text-xs text-subtle">
            {item.quantity} шт. × {rub(item.unitPrice.amountMinor)} · {item.production.workingDays} раб. дн.
          </p>
        </div>
        <p className="shrink-0 font-semibold">
          {rub(item.lineTotal.amountMinor)} <span className="text-xs font-normal text-subtle">{currency}</span>
        </p>
      </div>
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

function Card({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-2xl border border-border bg-surface p-5 ${className ?? ''}`}>
      <h3 className="mb-3 font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium">{value}</dd>
    </div>
  );
}

function Notice({ title, tone, children }: { title: string; tone: 'danger' | 'warning' | 'muted'; children: React.ReactNode }) {
  const color = tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-subtle';
  const Icon = tone === 'muted' ? Info : tone === 'warning' ? ShieldAlert : AlertTriangle;
  return (
    <div className="rounded-2xl border border-border bg-surface p-8 text-center">
      <Icon size={32} className={`mx-auto ${color}`} />
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{children}</p>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  // Возврат с сохранёнными фильтрами списка (из sessionStorage).
  const [backHref, setBackHref] = useState(ADMIN_ORDERS_PATH);
  useEffect(() => setBackHref(ordersListPathWithFilters()), []);
  return (
    <div>
      <Link href={backHref} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary">
        <ArrowLeft size={15} /> К списку заказов
      </Link>
      {children}
    </div>
  );
}
