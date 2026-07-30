import { AdminAccessGate } from '@/components/admin/admin-access-gate';
import { PricingDefinitionsList } from '@/components/admin/pricing/pricing-definitions-list';

export default function AdminPricingPage() {
  return (
    <AdminAccessGate returnUrl="/admin/pricing/">
      <PricingDefinitionsList />
    </AdminAccessGate>
  );
}
