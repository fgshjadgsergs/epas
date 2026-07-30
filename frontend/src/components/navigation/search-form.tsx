import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Поиск по сайту (ТЗ навигации, п.3.1). role=search, label связан с input. */
export function SearchForm({ className, id = 'header-search' }: { className?: string; id?: string }) {
  return (
    <form role="search" action="/search/" className={cn('relative w-full', className)}>
      <label htmlFor={id} className="visually-hidden">
        Поиск по сайту
      </label>
      <Search
        aria-hidden
        size={18}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle"
      />
      <input
        id={id}
        type="search"
        name="q"
        autoComplete="off"
        placeholder="Поиск: «печать визиток», «фото на паспорт»..."
        className="h-11 w-full rounded-xl border border-border bg-surface pl-11 pr-24 text-sm text-fg placeholder:text-subtle focus:border-primary focus:outline-none"
      />
      <button
        type="submit"
        aria-label="Найти"
        className="absolute right-1.5 top-1/2 grid h-8 -translate-y-1/2 place-items-center rounded-lg bg-primary px-3 text-primary-fg"
      >
        <Search aria-hidden size={16} />
      </button>
    </form>
  );
}
