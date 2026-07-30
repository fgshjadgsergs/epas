'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  SceneBanner,
  SceneBook,
  SceneCalendar,
  SceneListovka,
  SceneStickers,
  SceneVizitka,
} from '@/components/catalog/work-scenes';

/**
 * «Примеры наших работ» (макет): чипы-фильтр по категориям + коллаж работ
 * разного размера. Работы — стилизованные CSS-композиции (без изображений),
 * при клике ведут в портфолио.
 */

const CATS = ['Все', 'Визитки', 'Листовки', 'Баннеры', 'Фотокниги', 'Календари', 'Наклейки'];

const WORKS: { cat: string; span: string; scene: React.ReactNode; label: string }[] = [
  { cat: 'Визитки', span: 'col-span-2 row-span-2', scene: <SceneVizitka />, label: 'Визитки с тиснением' },
  { cat: 'Листовки', span: '', scene: <SceneListovka />, label: 'Листовки А5' },
  { cat: 'Баннеры', span: 'col-span-2', scene: <SceneBanner />, label: 'Баннер 3×2 м' },
  { cat: 'Фотокниги', span: '', scene: <SceneBook />, label: 'Фотокнига LayFlat' },
  { cat: 'Календари', span: '', scene: <SceneCalendar />, label: 'Календарь-домик' },
  { cat: 'Наклейки', span: '', scene: <SceneStickers />, label: 'Наклейки на заказ' },
  { cat: 'Визитки', span: '', scene: <SceneVizitka alt />, label: 'Визитки Soft Touch' },
  { cat: 'Фотокниги', span: 'col-span-2', scene: <SceneBook />, label: 'Свадебный альбом' },
  { cat: 'Листовки', span: '', scene: <SceneListovka />, label: 'Флаеры Евро' },
  { cat: 'Календари', span: '', scene: <SceneCalendar />, label: 'Квартальный календарь' },
  { cat: 'Наклейки', span: '', scene: <SceneStickers />, label: 'Этикетки на бутылки' },
];

export function ExamplesGallery() {
  const [active, setActive] = useState('Все');
  const visible = WORKS.filter((w) => active === 'Все' || w.cat === active);

  return (
    <div>
      {/* Чипы-фильтр по категориям (макет). */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Категории работ">
        {CATS.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={active === c}
            onClick={() => setActive(c)}
            className={`h-9 rounded-full border px-4 text-sm font-medium transition-all duration-200 ${
              active === c
                ? 'border-transparent bg-gradient-to-r from-primary to-accent text-white shadow-[0_10px_24px_-10px_rgb(var(--primary)/0.7)]'
                : 'border-border bg-surface text-muted hover:border-primary hover:text-fg'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Коллаж: тайлы разного размера, grid-flow-dense закрывает дыры при фильтре. */}
      <div className="mt-6 grid auto-rows-[9rem] grid-flow-dense grid-cols-2 gap-4 md:auto-rows-[10rem] md:grid-cols-4">
        {visible.map((w, i) => (
          <Link
            key={`${active}-${w.label}-${i}`}
            href="/portfolio/"
            className={`page-enter group relative overflow-hidden rounded-2xl border border-border bg-surface transition-colors hover:border-primary ${w.span}`}
            style={{ animationDelay: `${Math.min(i * 45, 320)}ms` }}
          >
            {w.scene}
            {/* Подпись на скриме — появляется при наведении. */}
            <div className="absolute inset-x-0 bottom-0 flex translate-y-1 items-center justify-between gap-2 bg-gradient-to-t from-bg/90 to-transparent p-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
              <span className="text-sm font-medium">{w.label}</span>
              <ArrowRight size={15} className="shrink-0 text-primary" />
            </div>
            <span className="absolute left-3 top-3 rounded-full bg-bg/70 px-2.5 py-1 text-xs font-medium text-muted backdrop-blur-sm">
              {w.cat}
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-8 flex justify-center">
        <Button href="/portfolio/" size="lg" variant="outline">
          Посмотреть все работы <ArrowRight size={17} />
        </Button>
      </div>
    </div>
  );
}
