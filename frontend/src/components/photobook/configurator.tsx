'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Minus, Plus, Truck } from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';
import { pricePhotobook } from '@/components/constructor/pricing';
import type { BookParams } from '@/components/constructor/store';

/**
 * Конфигуратор фотокниги на странице /fotoknigi/ (макет «страница фотокниги»).
 * Параметры и расчёт — те же, что в конструкторе (переплёт/размер/бумага/
 * обложка/развороты/экземпляры). «Перейти в конструктор» ведёт в редактор.
 */
const BINDING = [
  { id: 'layflat', label: 'LayFlat' },
  { id: 'hardcover', label: 'Hardcover' },
  { id: 'softcover', label: 'Softcover' },
] as const;
const SIZE = [
  { id: '20x20', label: '20×20 см' },
  { id: '25x25', label: '25×25 см' },
  { id: '30x30', label: '30×30 см' },
] as const;
const COVER = [
  { id: 'standard', label: 'Стандарт' },
  { id: 'leatherette', label: 'Кожзам' },
  { id: 'design', label: 'Дизайнерская' },
] as const;
const PAPER = [
  { id: 'coated-170', label: 'Мелованная 170 г' },
  { id: 'coated-200', label: 'Мелованная 200 г' },
  { id: 'layflat-170', label: 'LayFlat 170 г' },
] as const;

function Seg<T extends string>({
  label,
  options,
  value,
  onChange,
  disabledIds = [],
}: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  disabledIds?: T[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border py-4 first:pt-0">
      <span className="w-40 shrink-0 text-sm text-muted">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const disabled = disabledIds.includes(o.id);
          const active = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onChange(o.id)}
              className={cn(
                'h-10 rounded-xl border px-3.5 text-sm font-medium transition-colors',
                active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-fg hover:border-primary/50',
                disabled && 'cursor-not-allowed opacity-35 line-through hover:border-border',
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border py-4">
      <span className="w-40 shrink-0 text-sm text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Меньше"
          disabled={value <= min}
          onClick={() => set(value - step)}
          className="grid h-10 w-10 place-items-center rounded-xl border border-border hover:border-primary/60 disabled:opacity-30"
        >
          <Minus size={16} />
        </button>
        <span className="min-w-24 text-center text-sm font-semibold tabular-nums">
          {value} {suffix}
        </span>
        <button
          type="button"
          aria-label="Больше"
          disabled={value >= max}
          onClick={() => set(value + step)}
          className="grid h-10 w-10 place-items-center rounded-xl border border-border hover:border-primary/60 disabled:opacity-30"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

export function PhotobookConfigurator() {
  const router = useRouter();
  const [params, setParams] = useState<BookParams>({
    binding: 'hardcover',
    size: '20x20',
    paper: 'coated-200',
    cover: 'standard',
    copies: 1,
  });
  const [spreads, setSpreads] = useState(20);

  // Обложка (кроме стандартной) — только для Hardcover (ТЗ п.3.2).
  const coverDisabled: BookParams['cover'][] =
    params.binding === 'hardcover' ? [] : ['leatherette', 'design'];
  const paperDisabled: BookParams['paper'][] = params.binding === 'layflat' ? [] : ['layflat-170'];

  const set = (p: Partial<BookParams>) => setParams((s) => ({ ...s, ...p }));

  const result = useMemo(() => pricePhotobook(params, spreads), [params, spreads]);

  return (
    <div className="grid gap-6 rounded-2xl border border-border bg-surface p-6 lg:grid-cols-[1.5fr_1fr] lg:p-8">
      <div>
        <h2 className="text-xl font-bold">Параметры фотокниги</h2>
        <div className="mt-4">
          <Seg
            label="Тип переплёта"
            options={BINDING}
            value={params.binding}
            onChange={(v) =>
              set({
                binding: v,
                // сбрасываем несовместимые обложку/бумагу
                cover: v === 'hardcover' ? params.cover : 'standard',
                paper: v === 'layflat' ? params.paper : params.paper === 'layflat-170' ? 'coated-200' : params.paper,
              })
            }
          />
          <Seg label="Размер" options={SIZE} value={params.size} onChange={(v) => set({ size: v })} />
          <Seg
            label="Обложка"
            options={COVER}
            value={params.cover}
            disabledIds={coverDisabled}
            onChange={(v) => set({ cover: v })}
          />
          <Seg
            label="Бумага блока"
            options={PAPER}
            value={params.paper}
            disabledIds={paperDisabled}
            onChange={(v) => set({ paper: v })}
          />
          <Stepper
            label="Количество разворотов"
            value={spreads}
            min={10}
            max={100}
            step={1}
            suffix="разв."
            onChange={setSpreads}
          />
          <Stepper
            label="Количество экземпляров"
            value={params.copies}
            min={1}
            max={50}
            step={1}
            suffix="шт."
            onChange={(v) => set({ copies: v })}
          />
        </div>
      </div>

      {/* Панель цены */}
      <aside className="flex flex-col rounded-2xl border border-border bg-gradient-to-br from-surface to-bg-2 p-6 lg:sticky lg:top-28 lg:self-start">
        {/* Описание выбранной конфигурации (ТЗ фотокниги, блок 3). */}
        <p className="text-sm font-medium">
          {BINDING.find((o) => o.id === params.binding)?.label} ·{' '}
          {SIZE.find((o) => o.id === params.size)?.label} ·{' '}
          {PAPER.find((o) => o.id === params.paper)?.label} · {spreads} разв. · {params.copies} шт.
        </p>
        <p className="mt-3 text-sm text-muted">Примерная стоимость</p>
        <p className="mt-1 text-4xl font-extrabold tabular-nums">{formatPrice(result.price)}</p>
        <p className="mt-1 text-sm text-muted">
          {formatPrice(result.perUnit)} за экземпляр
          {params.copies >= 2 && <span className="text-success"> · скидка за тираж</span>}
        </p>
        <dl className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Изготовление</dt>
            <dd className="font-medium">от {result.days} рабочих дней</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">Доставка</dt>
            <dd className="inline-flex items-center gap-1 font-medium">
              <Truck size={14} className="text-primary" /> СДЭК и Почта России
            </dd>
          </div>
        </dl>
        <button
          onClick={() => router.push('/fotoknigi/konstruktor/')}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-fg hover:bg-primary-hover"
        >
          Перейти в конструктор <ArrowRight size={18} />
        </button>
        {/* Вторичная кнопка (ТЗ фотокниги, блок 3): загрузка готового макета —
            тем же флоу конструктора, файл добавляется на первом шаге. */}
        <button
          onClick={() => router.push('/fotoknigi/konstruktor/')}
          className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-medium hover:bg-surface-2"
        >
          Загрузить готовый макет
        </button>
        <p className="mt-2 text-center text-xs text-subtle">
          Цена не является публичной офертой. Точная — в конструкторе.
        </p>
      </aside>
    </div>
  );
}
