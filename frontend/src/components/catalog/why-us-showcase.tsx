'use client';

import { useEffect, useState } from 'react';
import { FileCheck2, Palette, Receipt, Truck, Zap } from 'lucide-react';

/**
 * «Почему заказывают … у нас» — интерактивная витрина.
 * Слева большая панель активного преимущества (номер, иконка, текст),
 * справа список из 5 пунктов с прогресс-баром автопереключения.
 * Автопереключение идёт до ПЕРВОГО взаимодействия (наведение, клик/тап,
 * фокус) — после него останавливается навсегда, выбор только ручной.
 * На мобиле — вертикальный список-аккордеон без панели.
 */
const ITEMS = [
  {
    icon: Zap,
    title: 'Срочно за 1 час',
    text: 'Экспресс-изготовление популярных позиций: визитки, листовки и фото на документы заберёте в день заказа.',
  },
  {
    icon: Palette,
    title: 'Точная цветопередача',
    text: 'Профессиональная цифровая и офсетная печать на калиброванном оборудовании — цвета макета совпадают с тиражом.',
  },
  {
    icon: FileCheck2,
    title: 'Проверка макета бесплатно',
    text: 'Технолог проверит файл перед печатью: вылеты, разрешение, цветовую модель — и подскажет, как исправить.',
  },
  {
    icon: Truck,
    title: 'Доставка по России',
    text: 'Курьер по городу в день готовности, СДЭК и Почта России до двери. Самовывоз — бесплатно.',
  },
  {
    icon: Receipt,
    title: 'Документы для бизнеса',
    text: 'Счёт, счёт-фактура и акт с НДС 20%. Электронный документооборот: Диадок, СБИС.',
  },
];

const INTERVAL = 3400;

export function WhyUsShowcase() {
  const [active, setActive] = useState(0);
  // Любое взаимодействие (наведение, клик/тап, фокус) — стоп навсегда.
  const [stopped, setStopped] = useState(false);
  const stop = () => setStopped(true);

  useEffect(() => {
    if (stopped) return;
    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const id = setInterval(() => setActive((a) => (a + 1) % ITEMS.length), INTERVAL);
    return () => clearInterval(id);
  }, [stopped]);

  const item = ITEMS[active];

  return (
    <div
      className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr] lg:gap-6"
      onMouseEnter={stop}
      onPointerDown={stop}
    >
      {/* Панель активного пункта (desktop). */}
      <div className="relative hidden overflow-hidden rounded-3xl border border-border bg-surface p-8 lg:block">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl"
        />
        {/* Контент перемонтируется по key — плавный вход. */}
        <div key={active} className="page-enter relative flex h-full flex-col">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-2 -top-4 select-none bg-gradient-to-br from-primary/15 to-accent/10 bg-clip-text text-[120px] font-extrabold leading-none tracking-tighter text-transparent"
          >
            0{active + 1}
          </span>
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-fg shadow-[0_16px_36px_-14px_rgb(var(--primary)/0.7)]">
            <item.icon size={30} />
          </span>
          <h3 className="mt-auto pt-10 text-2xl font-bold">{item.title}</h3>
          <p className="mt-2 max-w-md text-muted">{item.text}</p>
        </div>
      </div>

      {/* Список пунктов. */}
      <div className="grid content-start gap-2.5" role="tablist" aria-label="Наши преимущества">
        {ITEMS.map((w, i) => {
          const isActive = i === active;
          return (
            <button
              key={w.title}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                stop();
                setActive(i);
              }}
              onFocus={() => {
                stop();
                setActive(i);
              }}
              className={`group relative overflow-hidden rounded-2xl border px-5 py-4 text-left transition-all duration-300 ${
                isActive
                  ? 'border-primary/60 bg-primary/5'
                  : 'border-border bg-surface hover:border-primary/40'
              }`}
            >
              <div className="flex items-center gap-4">
                <span
                  className={`font-mono text-sm tabular-nums transition-colors ${isActive ? 'text-primary' : 'text-subtle'}`}
                >
                  0{i + 1}
                </span>
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-br from-primary to-accent text-primary-fg'
                      : 'bg-primary/10 text-primary'
                  }`}
                >
                  <w.icon size={19} />
                </span>
                <span className={`font-semibold transition-colors ${isActive ? 'text-fg' : 'text-muted group-hover:text-fg'}`}>
                  {w.title}
                </span>
              </div>
              {/* Текст пункта — на мобиле (панели нет) раскрывается под активным. */}
              {isActive && <p className="mt-2 pl-[4.75rem] text-sm text-muted lg:hidden">{w.text}</p>}
              {/* Прогресс автопереключения (после остановки не показывается). */}
              {isActive && !stopped && (
                <span
                  key={`p-${active}`}
                  aria-hidden
                  className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-primary to-accent"
                  style={{ animation: `progress-x ${INTERVAL}ms linear forwards` }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
