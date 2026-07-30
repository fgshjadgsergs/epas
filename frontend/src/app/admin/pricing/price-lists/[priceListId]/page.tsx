import { AdminAccessGate } from '@/components/admin/admin-access-gate';
import { PriceListView } from '@/components/admin/pricing/price-list-view';

export const dynamic = 'force-dynamic';

export default function PriceListPage({ params }: { params: { priceListId: string } }) {
  return (
    <AdminAccessGate returnUrl={`/admin/pricing/price-lists/${params.priceListId}/`}>
      <PriceListView priceListId={params.priceListId} />
    </AdminAccessGate>
  );
}
