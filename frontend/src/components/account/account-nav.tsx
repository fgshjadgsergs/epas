'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calculator, FileImage, Gauge, LayoutDashboard, LogIn, Package, Percent, Settings, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAccess } from '@/lib/admin/use-admin-access';

const LINKS = [
  { href: '/lichnyy-kabinet/', label: 'Обзор', icon: Gauge },
  { href: '/lichnyy-kabinet/moi-zakazy/', label: 'Мои заказы', icon: Package },
  { href: '/lichnyy-kabinet/moi-raschyoty/', label: 'Мои расчёты', icon: Calculator },
  { href: '/lichnyy-kabinet/moi-makety/', label: 'Мои макеты', icon: FileImage },
  { href: '/lichnyy-kabinet/programma-loyalnosti/', label: 'Программа лояльности', icon: Percent },
  { href: '/lichnyy-kabinet/rekvizity-b2b/', label: 'Реквизиты (B2B)', icon: FileText },
  { href: '/lichnyy-kabinet/nastroyki/', label: 'Настройки', icon: Settings },
];

export function AccountNav() {
  const pathname = usePathname();
  // Ссылка на панель видна только сотрудникам (UX-гейтинг; доступ решает backend).
  const access = useAdminAccess();
  const showAdmin = access.status === 'granted';
  return (
    <nav aria-label="Личный кабинет" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {showAdmin && (
        <Link
          href="/admin/orders/"
          className="flex shrink-0 items-center gap-2.5 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10"
        >
          <LayoutDashboard size={17} /> <span className="whitespace-nowrap">Панель управления</span>
        </Link>
      )}
      {LINKS.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              'flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium',
              active ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-surface-2 hover:text-fg',
            )}
          >
            <l.icon size={17} /> <span className="whitespace-nowrap">{l.label}</span>
          </Link>
        );
      })}
      <Link
        href="/lichnyy-kabinet/vhod-registraciya/"
        className="flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg lg:mt-2 lg:border-t lg:border-border lg:pt-4"
      >
        <LogIn size={17} /> <span className="whitespace-nowrap">Вход / Выход</span>
      </Link>
    </nav>
  );
}
