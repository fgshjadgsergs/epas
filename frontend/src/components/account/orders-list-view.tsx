'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronRight, Info, Package } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { ApiError } from '@/lib/api/client';
import { tokenStorage } from '@/lib/api/auth';
import { getOrders, type OrderListDto } from '@/lib/api/orders';
import { loginUrlWithReturn } from '@/lib/auth/return-url';
import { formatOrderDate, orderDetailPath, orderStatusBadge, orderStatusLabel } from '@/lib/orders/presentation';
import { DEMO_PRICING_NOTICE, showDemoPricingNotice } from '@/lib/demo-pricing';

const PAGE_SIZE = 10;
const ORDERS_PATH = '/lichnyy-kabinet/moi-zakazy/';

const rub = (amountMinor: number) => formatPrice(amountMinor / 100);

type ListState =
  | { status: 'loading' }
  | { status: 'ready'; page: OrderListDto }
  | { status: 'unauthorized' }
  | { status: 'error'; message: string };

/**
 * История заказов из GET /orders. Названия, конфигурации и суммы берутся из
 * ответа заказов (immutable-снимки), каталог для этого не запрашивается.
 */
export function OrdersListView() {
  const [state, setState] = useState<ListState>({ status: 'loading' });
  const [page, setPage] = useState(1);

  const load = useCallback((targetPage: number) => {
    const token = tokenStorage.getAccessToken();
    if (!token) {
      setState({ status: 'unauthorized' });
      return;
    }
    setState({ status: 'loading' });
    getOrders(token, { page: targetPage, pageSize: PAGE_SIZE })
      .then((result) => setState({ status: 'ready', page: result }))
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) {
          setState({ status: 'unauthorized' });
          return;
        }
        setState({
          status: 'error',
          message: error instanceof ApiError ? error.message : 'Не удалось загрузить заказы.',
        });
      });
  }, []);

  useEffect(() => {
    load(page);
  }, [load, page]);

  if (state.status === 'loading') {
    return (
      <Section>
        <p role="status" className="text-muted">
          Загружаем заказы…
        </p>
      </Section>
    );
  }

  if (state.status === 'unauthorized') {
    return (
      <Section>
        <div className="rounded-2xl border border-border bg-surface p-6 text-center">
          <Package size={32} className="mx-auto text-subtle" />
          <p className="mt-3 font-semibold">Войдите, чтобы увидеть заказы</p>
          <p className="mt-1 text-sm text-muted">История заказов доступна только вам.</p>
          <Link
            href={loginUrlWithReturn(ORDERS_PATH)}
            className="mt-4 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
          >
            Войти
          </Link>
        </div>
      </Section>
    );
  }

  if (state.status === 'error') {
    return (
      <Section>
        <div className="rounded-2xl border border-danger/40 bg-surface p-6 text-center">
          <AlertTriangle size={32} className="mx-auto text-danger" />
          <p className="mt-3 font-semibold">Не удалось загрузить заказы</p>
          <p className="mt-1 text-sm text-muted">{state.message}</p>
          <button
            onClick={() => load(page)}
            className="mt-4 inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm font-medium hover:border-primary hover:text-primary"
          >
            Повторить
          </button>
        </div>
      </Section>
    );
  }

  const { items, total } = state.page;

  if (items.length === 0) {
    return (
      <Section>
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <Package size={36} className="mx-auto text-subtle" />
          <p className="mt-3 font-semibold">Заказов пока нет</p>
          <p className="mt-1 text-sm text-muted">
            Рассчитайте стоимость нужной услуги и оформите первый заказ.
          </p>
          <Link
            href="/poligrafiya/"
            className="mt-4 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
          >
            Перейти в каталог
          </Link>
        </div>
      </Section>
    );
  }

  const lastPage = Math.max(1, Math.ceil(total / (state.page.pageSize || PAGE_SIZE)));

  return (
    <Section>
      <ul className="space-y-3">
        {items.map((order) => (
          <li key={order.id}>
            <Link
              href={orderDetailPath(order.id)}
              className="block rounded-2xl border border-border bg-surface p-5 hover:border-primary"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">Заказ {order.orderNumber}</p>
                  <p className="text-sm text-subtle">{formatOrderDate(order.createdAt)}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${orderStatusBadge(order.status)}`}
                >
                  {orderStatusLabel(order.status)}
                </span>
              </div>

              <p className="mt-3 text-sm text-muted">
                {order.itemCount} {pluralItems(order.itemCount)}
              </p>

              {showDemoPricingNotice(order.pricingMode) && (
                <p className="mt-2 inline-flex items-start gap-1.5 rounded-lg bg-warning/10 px-2.5 py-1 text-xs text-warning">
                  <Info size={12} className="mt-0.5 shrink-0" />
                  {DEMO_PRICING_NOTICE}
                </p>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <span className="font-bold">
                  {rub(order.total.amountMinor)}
                  <span className="ml-1 text-xs font-normal text-subtle">{order.total.currency}</span>
                </span>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Подробнее <ChevronRight size={15} />
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {lastPage > 1 && (
        <nav aria-label="Страницы заказов" className="mt-5 flex items-center justify-between gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="h-10 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-40"
          >
            Назад
          </button>
          <span className="text-sm text-muted">
            Страница {state.page.page} из {lastPage}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            disabled={page >= lastPage}
            className="h-10 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-40"
          >
            Вперёд
          </button>
        </nav>
      )}
    </Section>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-4 text-lg font-bold">Мои заказы</h2>
      {children}
    </div>
  );
}

function pluralItems(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'позиция';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'позиции';
  return 'позиций';
}
