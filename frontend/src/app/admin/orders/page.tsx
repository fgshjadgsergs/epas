import { Suspense } from 'react';
import { AdminAccessGate } from '@/components/admin/admin-access-gate';
import { AdminOrdersList } from '@/components/admin/admin-orders-list';

/** Список читает фильтры из useSearchParams — нужен Suspense-барьер. */
export default function AdminOrdersPage() {
  return (
    <AdminAccessGate returnUrl="/admin/orders/">
      <Suspense>
        <AdminOrdersList />
      </Suspense>
    </AdminAccessGate>
  );
}
