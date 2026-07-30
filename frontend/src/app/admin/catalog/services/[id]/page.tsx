import { AdminAccessGate } from '@/components/admin/admin-access-gate';
import { ServiceEditor } from '@/components/admin/catalog/service-editor';

/** Услуга тянется на клиенте по JWT — из общего кэша страниц исключаем. */
export const dynamic = 'force-dynamic';

export default function AdminServiceEditPage({ params }: { params: { id: string } }) {
  return (
    <AdminAccessGate returnUrl={`/admin/catalog/services/${params.id}/`} capability="catalog">
      <ServiceEditor serviceId={params.id} />
    </AdminAccessGate>
  );
}
