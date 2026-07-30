'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AnimatedPrice } from '@/components/fx/animated-price';

/**
 * Мини-калькулятор главной (макет «Рассчитайте стоимость за минуту»):
 * акцентная панель, выбор чипами — услуга, тираж, ламинация; цена и «Заказать».
 * Оценка примерная, точный расчёт — в калькуляторе услуги.
 */
const SERVICES = [
  { label: 'Визитки', base: 1200, href: '/vizitki/', lam: true },
  { label: 'Листовки', base: 1900, href: '/listovki/', lam: true },
  { label: 'Баннеры', base: 1400, href: '/shirokoformat/bannery/', lam: false },
  { label: 'Фото на документы', base: 300, href: '/foto-na-dokumenty/', lam: false },
];
const QTYS = [100, 200, 500, 1000];
// Чем больше тираж — тем дешевле за штуку (грубая модель для оценки).
const FACTOR: Record<number, number> = { 100: 1, 200: 1.7, 500: 3.4, 1000: 5.6 };
const LAMS = [
  { label: 'Без ламинации', k: 1 },
  { label: 'Матовая', k: 1.3 },
  { label: 'Глянцевая', k: 1.25 },
];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-10 rounded-full border px-4 text-sm font-medium transition-all duration-200 ${
        active
          ? 'border-primary-fg bg-primary-fg text-primary shadow-[0_8px_20px_-8px_rgb(0_0_0/0.5)]'
          : 'border-primary-fg/25 bg-primary-fg/10 text-primary-fg hover:bg-primary-fg/20'
      }`}
    >
      {children}
    </button>
  );
}

export function MiniCalc() {
  const [svc, setSvc] = useState(0);
  const [qty, setQty] = useState(100);
  const [lam, setLam] = useState(0);

  const service = SERVICES[svc];
  const price = useMemo(() => {
    const perQty = service.base * FACTOR[qty];
    const withLam = service.lam ? perQty * LAMS[lam].k : perQty;
    return Math.round(withLam / 10) * 10;
  }, [service, qty, lam]);

  return (
    /* Фон (градиент на всю ширину) рисует секция на главной — здесь только контент. */
    <div className="relative text-primary-fg">
      <div className="relative grid gap-8 lg:grid-cols-[1fr_220px]">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Рассчитайте стоимость за минуту
          </h2>
          <p className="mt-2 max-w-xl text-sm text-primary-fg/75">
            Выберите услугу — калькулятор сразу покажет цену с учётом тиража и отделки. Точный срок и
            доставка — в калькуляторе услуги.
          </p>
        </div>
        {/* CSS-иллюстрация: стопка отпечатанных листов. */}
        <div aria-hidden className="relative hidden lg:block">
          <div className="absolute right-10 top-0 h-24 w-36 rotate-6 rounded-lg bg-primary-fg/15 shadow-lg" />
          <div className="absolute right-5 top-3 h-24 w-36 rotate-3 rounded-lg bg-primary-fg/25 shadow-lg" />
          <div className="absolute right-0 top-6 h-24 w-36 rounded-lg bg-primary-fg p-3 shadow-xl">
            <div className="h-2 w-14 rounded-full bg-gradient-to-r from-primary to-accent" />
            <div className="mt-2 h-1.5 w-24 rounded-full bg-primary/15" />
            <div className="mt-1.5 h-1.5 w-20 rounded-full bg-primary/15" />
            <div className="mt-1.5 h-1.5 w-16 rounded-full bg-primary/15" />
          </div>
        </div>
      </div>

      <div className="relative mt-7 space-y-5">
        <div>
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-primary-fg/60">Услуга</p>
          <div className="flex flex-wrap gap-2">
            {SERVICES.map((s, i) => (
              <Chip key={s.label} active={svc === i} onClick={() => setSvc(i)}>
                {s.label}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-primary-fg/60">Тираж</p>
          <div className="flex flex-wrap gap-2">
            {QTYS.map((q) => (
              <Chip key={q} active={qty === q} onClick={() => setQty(q)}>
                {q.toLocaleString('ru-RU')} шт.
              </Chip>
            ))}
            <Link
              href={service.href}
              className="inline-flex h-10 items-center rounded-full border border-dashed border-primary-fg/40 px-4 text-sm font-medium text-primary-fg/80 transition-colors hover:bg-primary-fg/10"
            >
              Свой тираж
            </Link>
          </div>
        </div>
        {service.lam && (
          <div>
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-primary-fg/60">Ламинация</p>
            <div className="flex flex-wrap gap-2">
              {LAMS.map((l, i) => (
                <Chip key={l.label} active={lam === i} onClick={() => setLam(i)}>
                  {l.label}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="relative mt-8 flex flex-wrap items-end justify-between gap-5 border-t border-primary-fg/15 pt-6">
        <div>
          <p className="text-sm text-primary-fg/70">Примерная стоимость</p>
          <AnimatedPrice value={price} className="text-4xl font-extrabold tracking-tight" />
        </div>
        <Link
          href={service.href}
          className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary-fg px-7 font-semibold text-primary shadow-[0_16px_32px_-12px_rgb(0_0_0/0.4)] transition-transform hover:-translate-y-0.5"
        >
          Заказать
          <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
