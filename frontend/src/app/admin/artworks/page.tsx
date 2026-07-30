import { Suspense } from 'react';
import { AdminAccessGate } from '@/components/admin/admin-access-gate';
import { AdminArtworksList } from '@/components/admin/artworks/admin-artworks-list';

/** Список читает фильтры из useSearchParams — нужен Suspense-барьер. */
export default function AdminArtworksPage() {
  return (
    <AdminAccessGate returnUrl="/admin/artworks/">
      <Suspense>
        <AdminArtworksList />
      </Suspense>
    </AdminAccessGate>
  );
}
