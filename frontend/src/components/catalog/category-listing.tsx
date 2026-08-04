'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Услуга раздела с выведенными фасетами для фильтра (см. deriveFacets). */
export interface ListingItem {
  slug: string;
  name: string;
  priceFrom?: string;
  term?: string;
  /** Фото продукта (из public/img/catalog); нет — градиентная заглушка. */
  image?: string;
  price: number;
  tirazh: string[];
  paper: string[];
  lamination: string[];
  srok: string[];
}

/** Группы фильтра из макета «страница категории» (Тираж/Бумага/Ламинация/Срок). */
const FACETS: { key: keyof Pick<ListingItem, 'tirazh' | 'paper' | 'lamination' | 'srok'>; title: string; values: string[] }[] = [
  { key: 'tirazh', title: 'Тираж', values: ['100 шт', '200 шт', '500 шт', '1000 шт', '2000 шт'] },
  { key: 'paper', title: 'Бумага', values: ['Мелованная', 'Дизайнерская', 'Крафт', 'Пластик'] },
  { key: 'lamination', title: 'Ламинация', values: ['Без ламинации', 'Матовая', 'Глянцевая', 'Soft Touch'] },
  { key: 'srok', title: 'Срок', values: ['Стандарт', 'Срочно', '1 час'] },
];

const SORTS = [
  { id: 'popular', label: 'По популярности' },
  { id: 'price-asc', label: 'Сначала дешёвые' },
  { id: 'price-desc', label: 'Сначала дорогие' },
  { id: 'name', label: 'По названию' },
] as const;
type SortId = (typeof SORTS)[number]['id'];

function plural(n: number, forms: [string, string, string]): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return forms[1];
  return forms[2];
}

type Selected = Record<string, Set<string>>;

export function CategoryListing({ items }: { items: ListingItem[] }) {
  const [selected, setSelected] = useState<Selected>({});
  const [sort, setSort] = useState<SortId>('popular');
  const [drawer, setDrawer] = useState(false);

  // Синхронизация с URL (?paper=Крафт&sort=price-asc). На проде фильтры —
  // отдельные ЧПУ-URL (ТЗ SEO, п.5); query-параметры дают шаринг выбора.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const next: Selected = {};
    for (const f of FACETS) {
      const raw = sp.get(f.key);
      if (raw) next[f.key] = new Set(raw.split('|').filter((v) => f.values.includes(v)));
    }
    setSelected(next);
    const s = sp.get('sort') as SortId | null;
    if (s && SORTS.some((x) => x.id === s)) setSort(s);
  }, []);

  useEffect(() => {
    const sp = new URLSearchParams();
    for (const f of FACETS) {
      const set = selected[f.key];
      if (set && set.size) sp.set(f.key, [...set].join('|'));
    }
    if (sort !== 'popular') sp.set('sort', sort);
    const qs = sp.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [selected, sort]);

  const toggle = (key: string, value: string) =>
    setSelected((prev) => {
      const set = new Set(prev[key] ?? []);
      set.has(value) ? set.delete(value) : set.add(value);
      const next = { ...prev, [key]: set };
      if (!set.size) delete next[key];
      return next;
    });

  const reset = () => setSelected({});

  const activeCount = Object.values(selected).reduce((s, set) => s + set.size, 0);

  const filtered = useMemo(() => {
    const out = items.filter((it) =>
      FACETS.every((f) => {
        const set = selected[f.key];
        if (!set || !set.size) return true;
        return [...set].some((v) => it[f.key].includes(v));
      }),
    );
    const sorted = [...out];
    if (sort === 'price-asc') sorted.sort((a, b) => a.price - b.price);
    else if (sort === 'price-desc') sorted.sort((a, b) => b.price - a.price);
    else if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    return sorted;
  }, [items, selected, sort]);

  const panel = (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Фильтр</h2>
        <button
          type="button"
          onClick={() => setDrawer(false)}
          className="grid h-8 w-8 place-items-center rounded-lg hover:bg-surface-2 lg:hidden"
          aria-label="Закрыть фильтр"
        >
          <X size={18} />
        </button>
      </div>
      <div className="mt-4 space-y-5">
        {FACETS.map((f) => (
          <fieldset key={f.key}>
            <legend className="mb-2 text-sm font-semibold text-muted">{f.title}</legend>
            <div className="space-y-1.5">
              {f.values.map((v) => {
                const checked = selected[f.key]?.has(v) ?? false;
                return (
                  <label key={v} className="flex cursor-pointer items-center gap-2.5 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(f.key, v)}
                      className="h-4 w-4 shrink-0 accent-primary"
                    />
                    <span className={cn(checked ? 'text-fg' : 'text-muted')}>{v}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="mt-6 space-y-2">
        <button
          type="button"
          onClick={() => setDrawer(false)}
          className="flex h-11 w-full items-center justify-center rounded-xl bg-primary font-semibold text-primary-fg hover:bg-primary-hover lg:hidden"
        >
          Показать {filtered.length}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={activeCount === 0}
          className="w-full text-center text-sm text-muted underline underline-offset-4 hover:text-fg disabled:opacity-40"
        >
          Сбросить фильтры
        </button>
      </div>
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      {/* Десктоп: липкий фильтр слева */}
      <aside className="hidden lg:block">
        <div className="sticky top-28">{panel}</div>
      </aside>

      {/* Мобильный выдвижной фильтр */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-[min(340px,88vw)] overflow-y-auto bg-bg p-4">
            {panel}
          </div>
        </div>
      )}

      <div>
        {/* Тулбар: количество + сортировка + кнопка фильтра (мобайл) */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Найдено {filtered.length} {plural(filtered.length, ['услуга', 'услуги', 'услуг'])}
            {activeCount > 0 && <span className="text-subtle"> из {items.length}</span>}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDrawer(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium hover:border-primary lg:hidden"
            >
              <SlidersHorizontal size={16} /> Фильтр
              {activeCount > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-xs text-primary-fg">
                  {activeCount}
                </span>
              )}
            </button>
            <label className="inline-flex items-center gap-2 text-sm">
              <span className="hidden text-muted sm:inline">Сортировка:</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortId)}
                aria-label="Сортировка"
                className="h-10 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-fg focus:border-primary focus:outline-none"
              >
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {filtered.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c) => (
              <Link
                key={c.slug}
                href={c.slug}
                className="lift group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface hover:border-primary"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-surface-2 to-bg-2" aria-hidden>
                  {c.image && (
                    // eslint-disable-next-line @next/next/no-img-element -- клиентский листинг, файл уже оптимизирован
                    <img
                      src={c.image}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="font-semibold group-hover:text-primary">{c.name}</h3>
                  <div className="mt-2 flex items-center gap-3 text-sm text-muted">
                    {c.priceFrom && <span className="font-semibold text-fg">{c.priceFrom}</span>}
                    {c.term && <span>{c.term}</span>}
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Рассчитать
                    <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-10 text-center">
            <p className="font-semibold">Ничего не найдено</p>
            <p className="mt-1 text-sm text-muted">Попробуйте ослабить фильтры.</p>
            <button
              type="button"
              onClick={reset}
              className="mt-4 inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm font-medium hover:border-primary"
            >
              Сбросить фильтры
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
