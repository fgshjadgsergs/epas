import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { BreadcrumbJsonLd, type Crumb } from '@/components/seo/json-ld';

/** Хлебные крошки + Schema.org BreadcrumbList (ТЗ страниц, блок 1). */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <>
      <BreadcrumbJsonLd crumbs={crumbs} />
      <nav aria-label="Хлебные крошки" className="py-4 text-sm">
        <ol className="flex flex-wrap items-center gap-1.5 text-muted">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <li key={c.item} className="flex items-center gap-1.5">
                {last ? (
                  <span aria-current="page" className="text-fg">
                    {c.name}
                  </span>
                ) : (
                  <Link href={c.item} className="hover:text-primary">
                    {c.name}
                  </Link>
                )}
                {!last && <ChevronRight size={14} aria-hidden className="text-subtle" />}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
