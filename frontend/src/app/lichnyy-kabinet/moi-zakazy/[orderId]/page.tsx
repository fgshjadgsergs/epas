import { OrderDetailView } from '@/components/account/order-detail-view';

/**
 * Карточка заказа. Данные тянутся на клиенте по JWT из GET /orders/:id —
 * заказ не должен попадать в общий кэш страниц, поэтому статики здесь нет.
 */
export const dynamic = 'force-dynamic';

export default function OrderDetailPage({ params }: { params: { orderId: string } }) {
  return <OrderDetailView orderId={params.orderId} />;
}
