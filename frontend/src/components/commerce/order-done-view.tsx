'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Info, Package, Upload } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Button } from '@/components/ui/button';
import { Reveal } from '@/components/reveal';
import { formatPrice } from '@/lib/utils';
import { useOrder } from '@/lib/orders/use-order';
import { formatOrderDate, orderDetailPath, orderStatusBadge, orderStatusLabel } from '@/lib/orders/presentation';
import { loginUrlWithReturn } from '@/lib/auth/return-url';
import { DEMO_PRICING_NOTICE, showDemoPricingNotice } from '@/lib/demo-pricing';

const rub = (amountMinor: number) => formatPrice(amountMinor / 100);

/**
 * Страница успешного оформления.
 *
 * Номер заказа, статус, дата и сумма приходят из GET /orders/:id — фиктивный
 * номер не выдумывается и суммы не пересчитываются. Идентификатор в адресе —
 * uuid заказа: он не порядковый и не раскрывает объём заказов.
 */
export function OrderDoneView() {
  const orderId = useSearchParams().get('id');
  const { state } = useOrder(orderId);

  if (state.status === 'loading') {
    return (
      <Container className="flex min-h-[50vh] items-center justify-center py-16">
        <p role="status" className="text-muted">
          Загружаем заказ…
        </p>
      </Container>
    );
  }

  if (state.status === 'unauthorized') {
    return (
      <OrderDoneNotice
        title="Войдите, чтобы увидеть заказ"
        description="Заказ хранится в личном кабинете и доступен только вам."
        action={<Button href={loginUrlWithReturn('/lichnyy-kabinet/moi-zakazy/')}>Войти</Button>}
      />
    );
  }

  if (state.status === 'notFound') {
    return (
      <OrderDoneNotice
        title="Заказ не найден"
        description="Возможно, ссылка устарела. Все ваши заказы собраны в личном кабинете."
        action={<Button href="/lichnyy-kabinet/moi-zakazy/">Мои заказы</Button>}
      />
    );
  }

  if (state.status === 'error') {
    return (
      <OrderDoneNotice
        title="Не удалось загрузить заказ"
        description={state.message}
        action={<Button href="/lichnyy-kabinet/moi-zakazy/">Мои заказы</Button>}
      />
    );
  }

  const { order } = state;

  return (
    <Container className="flex flex-col items-center py-14 text-center">
      <Reveal className="grid place-items-center">
        <CheckCircle2 size={56} className="text-success" />
      </Reveal>

      <Reveal as="h1" delay={80} className="mt-4 text-2xl font-bold sm:text-3xl">
        Заказ {order.orderNumber} оформлен
      </Reveal>

      <Reveal as="p" delay={140} className="mt-2 max-w-md text-muted">
        Менеджер свяжется с вами по указанным контактам для подтверждения деталей.
      </Reveal>

      <Reveal delay={200} className="mt-8 w-full max-w-md rounded-2xl border border-border bg-surface p-5 text-left">
        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">Номер заказа</dt>
            <dd className="font-semibold">{order.orderNumber}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">Статус</dt>
            <dd>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${orderStatusBadge(order.status)}`}>
                {orderStatusLabel(order.status)}
              </span>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">Дата</dt>
            <dd className="font-medium">{formatOrderDate(order.createdAt)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            <dt className="font-semibold">Итого</dt>
            <dd className="text-xl font-extrabold">{rub(order.totals.total.amountMinor)}</dd>
          </div>
        </dl>

        {showDemoPricingNotice(order.pricingMode) && (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
            <Info size={13} className="mt-0.5 shrink-0" />
            {DEMO_PRICING_NOTICE}
          </p>
        )}
      </Reveal>

      <Reveal delay={260} className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
        <p className="font-semibold">Загрузите макеты для печати</p>
        <p className="mt-1 text-muted">
          Прикрепите файлы к позициям заказа — менеджер проверит их перед печатью. Это можно сделать на странице заказа.
        </p>
      </Reveal>

      <Reveal delay={280} className="mt-6 flex flex-wrap justify-center gap-3">
        {/* CTA ведёт на конкретный заказ (где живёт загрузчик), а не на случайную позицию. */}
        <Button href={orderDetailPath(order.id)}>
          <Upload size={18} /> Загрузить макет
        </Button>
        <Button href={orderDetailPath(order.id)} variant="outline">
          <Package size={18} /> Посмотреть заказ
        </Button>
        <Button href="/poligrafiya/" variant="ghost">
          Продолжить покупки
        </Button>
      </Reveal>
    </Container>
  );
}

function OrderDoneNotice({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <Container className="flex min-h-[50vh] flex-col items-center justify-center py-16 text-center">
      <AlertTriangle size={36} className="mb-3 text-warning" />
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 max-w-md text-muted">{description}</p>
      <div className="mt-6">{action}</div>
      <Link href="/" className="mt-4 text-sm text-muted hover:text-primary">
        На главную
      </Link>
    </Container>
  );
}
