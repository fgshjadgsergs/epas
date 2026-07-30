import { Suspense } from 'react';
import { AdminAccessGate } from '@/components/admin/admin-access-gate';
import { CatalogWorkspace } from '@/components/admin/catalog/catalog-workspace';

/** Раздел читает активную вкладку из useSearchParams — нужен Suspense-барьер. */
export default function AdminCatalogPage() {
  return (
    <AdminAccessGate returnUrl="/admin/catalog/" capability="catalog">
      <Suspense>
        <CatalogWorkspace />
      </Suspense>
    </AdminAccessGate>
  );
}
