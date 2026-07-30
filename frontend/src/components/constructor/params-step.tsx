'use client';

import { ArrowRight, Minus, Plus } from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';
import { useEditor, type BookParams } from './store';
import { pricePhotobook } from './pricing';

const OPTIONS: Record<string, { id: string; label: string }[]> = {
  binding: [
    { id: 'layflat', label: 'LayFlat (без шва)' },
    { id: 'hardcover', label: 'Hardcover' },
    { id: 'softcover', label: 'Softcover' },
  ],
  size: [
    { id: '20x20', label: '20×20 см' },
    { id: '25x25', label: '25×25 см' },
    { id: '30x30', label: '30×30 см' },
  ],
  paper: [
    { id: 'coated-170', label: 'Мелованная 170 г' },
    { id: 'coated-200', label: 'Мелованная 200 г' },
    { id: 'layflat-170', label: 'LayFlat 170 г' },
  ],
  cover: [
    { id: 'standard', label: 'Стандарт' },
    { id: 'leatherette', label: 'Кожзам' },
    { id: 'design', label: 'Дизайнерская' },
  ],
};

export function ParamsStep() {
  const params = useEditor((s) => s.params);
  const setParams = useEditor((s) => s.setParams);
  const spreads = useEditor((s) => s.spreads);
  const initSpreads = useEditor((s) => s.initSpreads);
  const setStep = useEditor((s) => s.setStep);

  const innerCount = spreads.filter((s) => !s.cover).length;
  const { price, days } = pricePhotobook(params, innerCount);

  const Row = ({ label, group }: { label: string; group: keyof BookParams }) => (
    <div className="grid gap-2 sm:grid-cols-[140px_1fr] sm:items-center">
      <span className="text-sm text-muted">{label}</span>
      <div className="flex flex-wrap gap-2">
        {OPTIONS[group].map((o) => (
          <button
            key={o.id}
            onClick={() => setParams({ [group]: o.id } as Partial<BookParams>)}
            className={cn(
              'h-10 rounded-xl border px-3.5 text-sm font-medium',
              params[group] === o.id
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:border-primary/50',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">Параметры фотокниги</h1>
      <p className="mt-1 text-sm text-muted">Шаг 1 из 3 — выберите формат, затем перейдёте в редактор.</p>

      <div className="mt-6 space-y-5 rounded-2xl border border-border bg-surface p-6">
        <Row label="Тип переплёта" group="binding" />
        <Row label="Размер" group="size" />
        <Row label="Бумага блока" group="paper" />
        <Row label="Обложка" group="cover" />

        {/* Развороты */}
        <div className="grid gap-2 sm:grid-cols-[140px_1fr] sm:items-center">
          <span className="text-sm text-muted">Разворотов</span>
          <Stepper value={innerCount} min={10} max={60} onChange={(v) => initSpreads(v)} suffix="разв." />
        </div>
        {/* Экземпляры */}
        <div className="grid gap-2 sm:grid-cols-[140px_1fr] sm:items-center">
          <span className="text-sm text-muted">Экземпляров</span>
          <Stepper
            value={params.copies}
            min={1}
            max={20}
            onChange={(v) => setParams({ copies: v })}
            suffix="шт."
          />
        </div>
      </div>

      <div className="mt-5 flex flex-col items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-6 sm:flex-row">
        <div>
          <p className="text-sm text-muted">Примерная стоимость · готовность {days} дней</p>
          <p className="text-3xl font-extrabold">{formatPrice(price)}</p>
        </div>
        <button
          onClick={() => setStep('design')}
          className="flex h-12 items-center gap-2 rounded-xl bg-primary px-6 font-semibold text-primary-fg hover:bg-primary-hover"
        >
          Перейти в редактор <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

function Stepper({
  value,
  min,
  max,
  onChange,
  suffix,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  suffix: string;
}) {
  return (
    <div className="inline-flex items-center gap-3">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:border-primary"
        aria-label="Меньше"
      >
        <Minus size={16} />
      </button>
      <span className="min-w-16 text-center font-semibold">
        {value} {suffix}
      </span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:border-primary"
        aria-label="Больше"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
