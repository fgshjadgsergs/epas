'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Calculator, Package, Percent, Repeat } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { tokenStorage } from '@/lib/api/auth';
import { getOrders, type OrderSummaryDto } from '@/lib/api/orders';
import { loginUrlWithReturn } from '@/lib/auth/return-url';
import { formatOrderDate, orderDetailPath, orderStatusBadge, orderStatusLabel } from '@/lib/orders/presentation';
import { mockUser } from '@/components/account/account-data';

const RECENT_COUNT = 2;
const ACCOUNT_PATH = '/lichnyy-kabinet/';

const rub = (amountMinor: number) => formatPrice(amountMinor / 100);

type OrdersState =
  | { status: 'loading' }
  | { status: 'ready'; total: number; recent: OrderSummaryDto[] }
  | { status: 'unauthorized' }
  | { status: 'error' };

/**
 * Обзор кабинета. Блок заказов работает на GET /orders — выдуманных заказов
 * здесь нет. Программа лояльности и профиль пока остаются демо-данными:
 * соответствующих API ещё не существует.
 */
export function AccountDashboard() {
  const [orders, setOrders] = useState<OrdersState>({ status: 'loading' });

  useEffect(() => {
    const token = tokenStorage.getAccessToken();
    if (!token) {
      setOrders({ status: 'unauthorized' });
      return;
    }
    let cancelled = false;
    getOrders(token, { page: 1, pageSize: RECENT_COUNT })
      .then((page) => {
        if (!cancelled) setOrders({ status: 'ready', total: page.total, recent: page.items });
      })
      .catch(() => {
        if (!cancelled) setOrders({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ordersCount = orders.status === 'ready' ? String(orders.total) : '—';

  return (
    <div className="space-y-6">
      <p className="text-muted">
        Здравствуйте, <span className="font-semibold text-fg">{mockUser.name}</span> 👋
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={Package} label="Заказов" value={ordersCount} href="/lichnyy-kabinet/moi-zakazy/" />
        <Stat
          icon={Percent}
          label={`Баллы · ${mockUser.loyaltyLevel}`}
          value={mockUser.loyaltyPoints.toLocaleString('ru-RU')}
          href="/lichnyy-kabinet/programma-loyalnosti/"
        />
        <Stat
          icon={Calculator}
          label="Сохранённые расчёты"
          value="—"
          href="/lichnyy-kabinet/moi-raschyoty/"
        />
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Последние заказы</h2>
          <Link href="/lichnyy-kabinet/moi-zakazy/" className="text-sm text-primary hover:underline">
            Все заказы →
          </Link>
        </div>

        {orders.status === 'loading' && (
          <p role="status" className="py-2 text-sm text-muted">
            Загружаем заказы…
          </p>
        )}

        {orders.status === 'unauthorized' && (
          <p className="py-2 text-sm text-muted">
            <Link href={loginUrlWithReturn(ACCOUNT_PATH)} className="text-primary hover:underline">
              Войдите
            </Link>
            , чтобы увидеть свои заказы.
          </p>
        )}

        {orders.status === 'error' && (
          <p className="py-2 text-sm text-muted">Не удалось загрузить заказы.</p>
        )}

        {orders.status === 'ready' && orders.recent.length === 0 && (
          <p className="py-2 text-sm text-muted">Заказов пока нет.</p>
        )}

        {orders.status === 'ready' && orders.recent.length > 0 && (
          <ul className="divide-y divide-border">
            {orders.recent.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <Link href={orderDetailPath(order.id)} className="font-medium hover:text-primary">
                    {order.orderNumber}
                  </Link>
                  <p className="text-sm text-muted">{formatOrderDate(order.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${orderStatusBadge(order.status)}`}
                  >
                    {orderStatusLabel(order.status)}
                  </span>
                  <span className="font-semibold">{rub(order.total.amountMinor)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <Quick icon={Repeat} label="Мои заказы" href="/lichnyy-kabinet/moi-zakazy/" />
        <Quick icon={Calculator} label="Рассчитать новую печать" href="/poligrafiya/" />
        <Quick icon={Package} label="Собрать фотокнигу" href="/fotoknigi/konstruktor/" />
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  href: string;
}) {
  return (
    <Link href={href} className="lift rounded-2xl border border-border bg-surface p-5 hover:border-primary">
      <Icon size={20} className="text-primary" />
      <p className="mt-3 text-2xl font-extrabold">{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </Link>
  );
}

function Quick({ icon: Icon, label, href }: { icon: typeof Package; label: string; href: string }) {
  return (
    <Link
      href={href}
      className="lift flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 hover:border-primary"
    >
      <Icon size={18} className="text-primary" />
      <span className="flex-1 text-sm font-medium">{label}</span>
      <ArrowRight size={16} className="text-subtle" />
    </Link>
  );
}
