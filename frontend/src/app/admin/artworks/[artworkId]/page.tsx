import { AdminAccessGate } from '@/components/admin/admin-access-gate';
import { AdminArtworkDetail } from '@/components/admin/artworks/admin-artwork-detail';

/** Макет тянется на клиенте по JWT — из общего кэша страниц исключаем. */
export const dynamic = 'force-dynamic';

export default function AdminArtworkDetailPage({ params }: { params: { artworkId: string } }) {
  return (
    <AdminAccessGate returnUrl={`/admin/artworks/${params.artworkId}/`}>
      <AdminArtworkDetail artworkId={params.artworkId} />
    </AdminAccessGate>
  );
}
