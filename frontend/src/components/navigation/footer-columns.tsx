'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FooterColumn {
  title: string;
  links: { label: string; href: string }[];
}

/**
 * Колонки ссылок футера: на мобиле — аккордеоны (ТЗ навигации, п.4.2),
 * с md — обычные открытые колонки. Ссылки всегда присутствуют в DOM (SEO):
 * закрытый на мобиле список скрыт только визуально (hidden md:block).
 */
export function FooterColumns({ columns }: { columns: readonly FooterColumn[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <>
      {columns.map((col) => {
        const isOpen = open === col.title;
        return (
          <nav key={col.title} aria-label={col.title} className="col-span-2 md:col-span-1">
            <h3 className="mb-3 hidden text-sm font-semibold text-fg md:block">{col.title}</h3>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : col.title)}
              aria-expanded={isOpen}
              className="flex min-h-[44px] w-full items-center justify-between border-b border-border text-sm font-semibold text-fg md:hidden"
            >
              {col.title}
              <ChevronDown
                aria-hidden
                size={16}
                className={cn('text-subtle transition-transform', isOpen && 'rotate-180')}
              />
            </button>
            <ul className={cn('space-y-2 py-3 md:py-0', !isOpen && 'hidden md:block')}>
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-muted hover:text-primary">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        );
      })}
    </>
  );
}
