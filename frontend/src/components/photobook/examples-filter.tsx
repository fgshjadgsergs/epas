'use client';

import { useState } from 'react';

/**
 * Примеры фотокниг с фильтром по тематике (ТЗ страницы фотокниги, блок 7):
 * Все | Свадебные | Детские | Путешествия | Корпоративные. 8 работ —
 * заглушки с подписями до реальных фотографий.
 */
const CATS = ['Все', 'Свадебные', 'Детские', 'Путешествия', 'Корпоративные'] as const;

const WORKS: { cat: (typeof CATS)[number]; label: string }[] = [
  { cat: 'Свадебные', label: 'Свадебная LayFlat 30×30' },
  { cat: 'Детские', label: 'Первый год, Hardcover 20×20' },
  { cat: 'Путешествия', label: 'Исландия, панорамы 30×20' },
  { cat: 'Корпоративные', label: 'Итоги года, тираж 50 шт.' },
  { cat: 'Свадебные', label: 'Венчание, обложка кожзам' },
  { cat: 'Детские', label: 'Выпускной в саду, 25×25' },
  { cat: 'Путешествия', label: 'Алтай, Softcover 20×20' },
  { cat: 'Корпоративные', label: 'Юбилей компании, LayFlat' },
];

export function PhotobookExamples() {
  const [active, setActive] = useState<(typeof CATS)[number]>('Все');
  const visible = WORKS.filter((w) => active === 'Все' || w.cat === active);

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Тематика фотокниг">
        {CATS.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={active === c}
            onClick={() => setActive(c)}
            className={`h-9 rounded-full border px-4 text-sm font-medium transition-colors ${
              active === c
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted hover:text-fg'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {visible.map((w) => (
          <figure
            key={w.label}
            className="lift relative aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface-2 to-bg-2"
          >
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg/90 to-transparent p-3 pt-8 text-xs font-medium">
              {w.label}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
