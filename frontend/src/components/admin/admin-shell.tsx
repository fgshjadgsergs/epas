'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, ClipboardList, FileImage, FolderTree, LogOut, Menu, Tag, X } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth/auth-context';
import { useAdminAccess } from '@/lib/admin/use-admin-access';
import { canAccessArtworks, canAccessOrders, canAccessPricing, canManageCatalog } from '@/lib/admin/access';

/**
 * Каркас админ-панели: заголовок, навигация «Заказы» (+ место под «Прайсы»),
 * возврат на сайт и выход, мобильное меню. Секция «Прайсы» помечена «скоро» и
 * не ведёт на пустую рабочую страницу.
 */
/** can(permissions) — UX-гейт пункта по праву из БД. Backend остаётся authority. */
const NAV = [
  { href: '/admin/orders/', label: 'Заказы', icon: ClipboardList, ready: true, can: canAccessOrders },
  { href: '/admin/pricing/', label: 'Прайсы', icon: Tag, ready: true, can: canAccessPricing },
  { href: '/admin/artworks/', label: 'Макеты', icon: FileImage, ready: true, can: canAccessArtworks },
  { href: '/admin/catalog/', label: 'Каталог', icon: FolderTree, ready: true, can: canManageCatalog },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const access = useAdminAccess();
  const { signOut } = useAuth();
  // До подтверждения сессии ссылок не показываем — не мигаем чужими разделами.
  const permissions = access.status === 'granted' ? access.permissions : [];
  const items = NAV.filter((item) => item.can(permissions));

  async function handleLogout() {
    await signOut();
    window.location.href = '/';
  }

  const nav = (
    <nav aria-label="Разделы панели" className="flex flex-col gap-1">
      {items.map((item) => {
        const active = item.ready && pathname.startsWith(item.href);
        if (!item.ready) {
          return (
            <span
              key={item.label}
              aria-disabled="true"
              className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-subtle"
            >
              <span className="flex items-center gap-2.5">
                <item.icon size={17} /> {item.label}
              </span>
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px]">скоро</span>
            </span>
          );
        }
        return (
          <Link
            key={item.label}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium',
              active ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-surface-2 hover:text-fg',
            )}
          >
            <item.icon size={17} /> {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const footerActions = (
    <div className="flex flex-col gap-1 border-t border-border pt-3">
      <Link
        href="/"
        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg"
      >
        <ArrowLeft size={17} /> На сайт
      </Link>
      <button
        onClick={handleLogout}
        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg"
      >
        <LogOut size={17} /> Выйти
      </button>
    </div>
  );

  return (
    <Container className="py-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-subtle">KidsPrint</p>
          <h1 className="text-xl font-bold sm:text-2xl">Панель управления</h1>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? 'Закрыть меню' : 'Открыть меню'}
          aria-expanded={mobileOpen}
          className="grid h-11 w-11 place-items-center rounded-xl border border-border lg:hidden"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="mb-4 rounded-2xl border border-border bg-surface p-3 lg:hidden">
          {nav}
          <div className="mt-2">{footerActions}</div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="hidden min-w-0 lg:sticky lg:top-24 lg:block lg:self-start">
          <div className="rounded-2xl border border-border bg-surface p-3">
            {nav}
            <div className="mt-2">{footerActions}</div>
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  );
}
