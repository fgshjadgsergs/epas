import { AdminAccessGate } from '@/components/admin/admin-access-gate';
import { PricingDefinitionView } from '@/components/admin/pricing/pricing-definition-view';

export const dynamic = 'force-dynamic';

export default function PricingDefinitionPage({ params }: { params: { definitionId: string } }) {
  return (
    <AdminAccessGate returnUrl={`/admin/pricing/${params.definitionId}/`}>
      <PricingDefinitionView definitionId={params.definitionId} />
    </AdminAccessGate>
  );
}
