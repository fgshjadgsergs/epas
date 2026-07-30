import { AdminAccessGate } from '@/components/admin/admin-access-gate';
import { AdminOrderDetail } from '@/components/admin/admin-order-detail';

/** Заказ тянется на клиенте по JWT — из общего кэша страниц исключаем. */
export const dynamic = 'force-dynamic';

export default function AdminOrderDetailPage({ params }: { params: { orderId: string } }) {
  return (
    <AdminAccessGate returnUrl={`/admin/orders/${params.orderId}/`}>
      <AdminOrderDetail orderId={params.orderId} />
    </AdminAccessGate>
  );
}
