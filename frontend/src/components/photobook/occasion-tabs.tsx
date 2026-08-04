'use client';

import * as Tabs from '@radix-ui/react-tabs';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * «Виды фотокниг по поводу» (ТЗ страницы фотокниги, блок 5) — вкладки
 * Свадьба | Детский альбом | Путешествие | Корпоративный подарок | На выпускной.
 * Каждая: изображение (заглушка до реальных фото), описание, рекомендуемый
 * формат и подтип, цена от, кнопка «Создать … фотокнигу».
 */
const OCCASIONS = [
  {
    id: 'wedding',
    tab: 'Свадьба',
    title: 'Свадебная фотокнига',
    text: 'Главный альбом семьи: панорамные развороты без шва — кадры церемонии на всю ширину книги. Обложка из кожзама или ткани с тиснением.',
    format: 'LayFlat 30×30 см, обложка кожзам',
    priceFrom: 'от 8 900 ₽',
    cta: 'Создать свадебную фотокнигу',
    tint: 'from-primary/25 to-accent/20',
  },
  {
    id: 'kids',
    tab: 'Детский альбом',
    title: 'Детский альбом',
    text: 'Первый год, детский сад, семейные праздники. Плотные страницы, которые выдержат частые просмотры, и яркая фотообложка.',
    format: 'Hardcover 20×20 см, мелованная 200 г',
    priceFrom: 'от 3 400 ₽',
    cta: 'Создать детский альбом',
    tint: 'from-accent/25 to-primary/15',
  },
  {
    id: 'travel',
    tab: 'Путешествие',
    title: 'Книга путешествия',
    text: 'Маршрут, пейзажи и лучшие моменты поездки в одной книге. Горизонтальный формат — для панорам и широких кадров.',
    format: 'Hardcover 30×20 см, мелованная 170 г',
    priceFrom: 'от 3 900 ₽',
    cta: 'Создать книгу путешествия',
    tint: 'from-primary/20 to-accent/25',
  },
  {
    id: 'corporate',
    tab: 'Корпоративный подарок',
    title: 'Корпоративная фотокнига',
    text: 'Итоги года, юбилей компании или подарок партнёрам. Печать тиражом с персонализацией и документами для бухгалтерии.',
    format: 'LayFlat 25×25 см, тираж от 5 шт.',
    priceFrom: 'от 4 800 ₽',
    cta: 'Создать корпоративную фотокнигу',
    tint: 'from-accent/20 to-primary/20',
  },
  {
    id: 'grad',
    tab: 'На выпускной',
    title: 'Выпускной альбом',
    text: 'Для сада, школы и вуза: общие развороты класса и персональные страницы. Скидки на тираж от 10 экземпляров.',
    format: 'Hardcover 25×25 см, тираж от 10 шт.',
    priceFrom: 'от 2 900 ₽',
    cta: 'Создать выпускной альбом',
    tint: 'from-primary/25 to-accent/15',
  },
];

export function OccasionTabs({
  constructorHref,
  images = {},
}: {
  constructorHref: string;
  /** Фото по id повода (из public/img/catalog); нет — CSS-сцена. */
  images?: Partial<Record<string, string | undefined>>;
}) {
  return (
    <Tabs.Root defaultValue={OCCASIONS[0].id}>
      <Tabs.List
        aria-label="Виды фотокниг по поводу"
        className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {OCCASIONS.map((o) => (
          <Tabs.Trigger
            key={o.id}
            value={o.id}
            className={cn(
              'h-10 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors',
              'border-border text-muted hover:text-fg',
              'data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:text-primary',
            )}
          >
            {o.tab}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      {OCCASIONS.map((o) => (
        <Tabs.Content key={o.id} value={o.id} className="mt-6 focus:outline-none">
          <div className="grid items-center gap-6 overflow-hidden rounded-3xl border border-border bg-surface lg:grid-cols-[1fr_1.1fr]">
            {/* Фото работы (public/img/catalog); фолбэк — CSS-сцена. */}
            <div className={cn('photo-tint relative aspect-[4/3] overflow-hidden bg-gradient-to-br lg:aspect-auto lg:h-full', o.tint)} aria-hidden>
              {images[o.id] ? (
                // eslint-disable-next-line @next/next/no-img-element -- клиентский компонент, файл уже оптимизирован
                <img
                  src={images[o.id]!}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center">
                  <div className="grid h-1/2 w-2/3 grid-cols-2 gap-[2%] rounded-md bg-surface p-[3%] shadow-xl [transform:perspective(500px)_rotateX(14deg)]">
                    <div className="rounded-sm bg-gradient-to-br from-primary/40 to-accent/30" />
                    <div className="rounded-sm bg-gradient-to-br from-accent/40 to-primary/30" />
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 lg:p-8">
              <h3 className="text-xl font-bold sm:text-2xl">{o.title}</h3>
              <p className="mt-3 text-muted">{o.text}</p>
              <dl className="mt-5 space-y-1.5 text-sm">
                <div className="flex gap-2">
                  <dt className="text-muted">Рекомендуем:</dt>
                  <dd className="font-medium">{o.format}</dd>
                </div>
              </dl>
              <div className="mt-5 flex flex-wrap items-center gap-4">
                <span className="text-2xl font-extrabold tracking-tight">{o.priceFrom}</span>
                <Link
                  href={constructorHref}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
                >
                  {o.cta} <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
