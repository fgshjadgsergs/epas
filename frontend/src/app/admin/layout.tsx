import type { Metadata } from 'next';
import { AdminShell } from '@/components/admin/admin-shell';

/** Панель управления не индексируется. */
export const metadata: Metadata = {
  title: 'Панель управления — ПРИНТЕРА',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
