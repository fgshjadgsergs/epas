'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';

type Work = { id: number; cat: string; h: number; title: string };

const CATS = ['Все', 'Визитки', 'Листовки', 'Баннеры', 'Фотокниги', 'Наклейки', 'Календари'];

const GRADS = [
  'bg-gradient-to-br from-primary/30 via-surface-2 to-bg-2',
  'bg-gradient-to-tr from-accent/30 via-surface-2 to-bg-2',
  'bg-gradient-to-br from-surface-2 to-bg-2',
  'bg-gradient-to-bl from-primary/20 to-accent/20',
  'bg-gradient-to-tr from-accent/25 to-bg-2',
  'bg-gradient-to-br from-primary/25 to-surface-2',
];

// Высоты подобраны вразнобой — для «кирпичной» masonry-раскладки.
const WORKS: Work[] = [
  { id: 1, cat: 'Визитки', h: 240, title: 'Премиум-визитки, Soft Touch' },
  { id: 2, cat: 'Баннеры', h: 320, title: 'Баннер 3×2 м, люверсы' },
  { id: 3, cat: 'Фотокниги', h: 300, title: 'Свадебная фотокнига LayFlat' },
  { id: 4, cat: 'Листовки', h: 200, title: 'Листовки А5, 4+4' },
  { id: 5, cat: 'Наклейки', h: 220, title: 'Наклейки на заказ, контур' },
  { id: 6, cat: 'Календари', h: 280, title: 'Настенный перекидной календарь' },
  { id: 7, cat: 'Визитки', h: 200, title: 'Визитки с тиснением фольгой' },
  { id: 8, cat: 'Баннеры', h: 260, title: 'Press Wall для мероприятия' },
  { id: 9, cat: 'Фотокниги', h: 340, title: 'Детская фотокнига Hardcover' },
  { id: 10, cat: 'Листовки', h: 240, title: 'Буклет-евро, 3 фальца' },
  { id: 11, cat: 'Наклейки', h: 300, title: 'Этикетки для продукции' },
  { id: 12, cat: 'Календари', h: 220, title: 'Карманные календари' },
  { id: 13, cat: 'Визитки', h: 300, title: 'Пластиковые визики' },
  { id: 14, cat: 'Баннеры', h: 200, title: 'Roll Up стенд 200×85' },
];

export function PortfolioGallery() {
  const [cat, setCat] = useState('Все');
  const [open, setOpen] = useState<Work | null>(null);
  const shown = WORKS.filter((w) => cat === 'Все' || w.cat === cat);

  return (
    <>
      {/* Фильтр-чипы */}
      <div className="mb-6 flex flex-wrap gap-2">
        {CATS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            aria-pressed={cat === c}
            className={cn(
              'h-9 rounded-full border px-4 text-sm font-medium transition-colors',
              cat === c
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted hover:border-primary/50',
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Masonry (CSS columns). cv-auto — не рендерить за экраном. */}
      <div className="cv-auto columns-2 gap-4 md:columns-3 lg:columns-4">
        {shown.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => setOpen(w)}
            className="spotlight group mb-4 block w-full overflow-hidden rounded-2xl border border-border text-left [break-inside:avoid]"
          >
            <div
              className={cn('relative w-full overflow-hidden', GRADS[w.id % GRADS.length])}
              style={{ height: w.h }}
            >
              <div className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-105" />
              <span className="absolute left-3 top-3 rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
                {w.cat}
              </span>
              <span className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/35 text-white opacity-0 backdrop-blur transition-opacity duration-300 group-hover:opacity-100">
                <ZoomIn size={15} />
              </span>
              <span className="absolute inset-x-3 bottom-3 translate-y-1 text-sm font-semibold text-white/95 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                {w.title}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Лайтбокс */}
      <Dialog.Root open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm data-[state=open]:animate-fade-in" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-border bg-surface shadow-pop focus:outline-none data-[state=open]:animate-fade-in">
            <Dialog.Title className="sr-only">{open?.title ?? 'Работа'}</Dialog.Title>
            <div className={cn('aspect-[16/10] w-full', open ? GRADS[open.id % GRADS.length] : '')} />
            <div className="flex items-center justify-between gap-4 p-5">
              <div>
                <p className="text-xs font-medium text-primary">{open?.cat}</p>
                <p className="mt-0.5 font-semibold">{open?.title}</p>
              </div>
              <Dialog.Close asChild>
                <button
                  aria-label="Закрыть"
                  className="grid h-10 w-10 place-items-center rounded-lg border border-border hover:bg-surface-2"
                >
                  <X size={18} />
                </button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
