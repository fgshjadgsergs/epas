'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { Minus, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseCounts, serializeCounts } from '@/lib/calc/pricing';
import type { ParamGroup, ParamOption, QtyTier, SwatchMeta } from '@/lib/calc/types';

/* ---------- Сегментированный переключатель ---------- */
export function Segmented({
  group,
  value,
  disabledIds = [],
  onChange,
}: {
  group: ParamGroup;
  value: string | number;
  disabledIds?: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {group.options?.map((o) => {
        const disabled = disabledIds.includes(o.id);
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            title={disabled ? 'Недоступно для выбранных параметров' : undefined}
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
            {o.badge && !active && <span className="ml-1.5 text-[11px] text-accent">{o.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Визуальные свотчи (бумага / ламинация / фольга) ---------- */
function sheenStyle(meta?: SwatchMeta): React.CSSProperties {
  if (!meta) return {};
  if (meta.kind === 'foil') return { backgroundImage: meta.color };
  const base = meta.color ?? '#eee';
  switch (meta.sheen) {
    case 'gloss':
      return {
        background: `linear-gradient(125deg, rgba(255,255,255,.85) 0%, rgba(255,255,255,0) 42%), ${base}`,
      };
    case 'matte':
      return { background: `linear-gradient(180deg, rgba(255,255,255,.12), rgba(0,0,0,.06)), ${base}` };
    case 'soft':
      return {
        background: `radial-gradient(60% 60% at 35% 30%, rgba(255,255,255,.4), rgba(0,0,0,.04)), ${base}`,
      };
    default:
      return { background: base };
  }
}

export function Swatches({
  group,
  value,
  disabledIds = [],
  onChange,
}: {
  group: ParamGroup;
  value: string | number;
  disabledIds?: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {group.options?.map((o: ParamOption) => {
        const disabled = disabledIds.includes(o.id);
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            title={disabled ? 'Недоступно для выбранных параметров' : o.label}
            onClick={() => onChange(o.id)}
            className={cn(
              'group/sw flex w-[88px] flex-col items-center gap-1.5 rounded-xl border p-2 transition-all',
              active ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/50',
              disabled && 'cursor-not-allowed opacity-35',
            )}
          >
            <span
              aria-hidden
              className="h-10 w-full rounded-lg border border-black/10 shadow-inner"
              style={sheenStyle(o.swatch)}
            />
            <span className="text-center text-[11px] leading-tight text-fg">{o.label}</span>
            {o.badge && (
              <span className="rounded-full bg-accent/15 px-1.5 text-[10px] font-medium text-accent">
                {o.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Слайдер размера (метры) ---------- */
export function DimensionSlider({
  group,
  value,
  onChange,
}: {
  group: ParamGroup;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm text-muted">{group.label}</span>
        <span className="font-semibold">
          {/* Десятые — только для дробного шага (метры); мм/см показываем целыми. */}
          {value.toFixed((group.step ?? 1) < 1 ? 1 : 0)} {group.unit}
        </span>
      </div>
      <input
        type="range"
        min={group.min}
        max={group.max}
        step={group.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={group.label}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-2 accent-primary"
      />
    </div>
  );
}

/* ---------- Слайдер тиража с порогами выгоды ---------- */
export function QtySlider({
  tiers,
  range,
  value,
  onChange,
  label = 'Тираж',
  minQty = 1,
}: {
  tiers?: QtyTier[];
  range?: { min: number; max: number; step: number };
  value: number;
  onChange: (v: number) => void;
  label?: string;
  /** Минимальный тираж при текущих параметрах (ТЗ: напр. пластиковые визитки — от 100). */
  minQty?: number;
}) {
  // Дискретные остановки = пороги тиража (видна выгода на каждой ступени).
  const stops = tiers ? tiers.map((t) => t.qty) : null;
  const firstIdx = stops ? Math.max(0, stops.findIndex((s) => s >= minQty)) : 0;
  const idx = stops ? Math.max(firstIdx, stops.indexOf(value)) : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm text-muted">
          {label}
          {minQty > 1 && <span className="ml-1.5 text-xs text-subtle">от {minQty.toLocaleString('ru-RU')}</span>}
        </span>
        <span className="text-lg font-bold tabular-nums">{value.toLocaleString('ru-RU')} шт.</span>
      </div>
      {stops ? (
        <>
          <input
            type="range"
            min={firstIdx}
            max={stops.length - 1}
            step={1}
            value={idx}
            onChange={(e) => onChange(stops[Number(e.target.value)])}
            aria-label="Тираж"
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-2 accent-primary"
          />
          <div className="mt-2 flex justify-between text-[11px] text-subtle">
            {stops.map((s) => {
              const disabled = s < minQty;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={disabled}
                  title={disabled ? `Минимальный тираж — ${minQty.toLocaleString('ru-RU')} шт.` : undefined}
                  onClick={() => onChange(s)}
                  className={cn(
                    'tabular-nums hover:text-primary',
                    s === value && 'font-bold text-primary',
                    disabled && 'cursor-not-allowed opacity-35 line-through hover:text-subtle',
                  )}
                >
                  {s >= 1000 ? `${s / 1000}к` : s}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <input
          type="range"
          min={Math.max(range?.min ?? 1, minQty)}
          max={range?.max}
          step={range?.step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Тираж"
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-2 accent-primary"
        />
      )}
    </div>
  );
}

/* ---------- Мультиколичество: счётчик на каждую опцию (ТЗ п.3.1/8.1) ---------- */
export function MultiQty({
  group,
  value,
  onChange,
}: {
  group: ParamGroup;
  value: string | number;
  onChange: (v: string) => void;
}) {
  const counts = parseCounts(value);
  // Границы строки приходят из definition (group.min/max из multiQty-конфига).
  const lineMax = group.max ?? 9999;
  const set = (id: string, n: number) => {
    const next = { ...counts, [id]: Math.max(0, Math.min(lineMax, n)) };
    onChange(serializeCounts(next));
  };
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {group.options?.map((o, i) => {
        const cnt = counts[o.id] ?? 0;
        return (
          <div
            key={o.id}
            className={cn(
              'flex items-center justify-between gap-3 px-3 py-2.5',
              i > 0 && 'border-t border-border',
              cnt > 0 && 'bg-primary/5',
            )}
          >
            <div className="min-w-0">
              <p className={cn('text-sm font-medium', cnt === 0 && 'text-muted')}>{o.label}</p>
              {(o.note || o.price != null) && (
                <p className="text-xs text-subtle">
                  {o.note}
                  {o.note && o.price != null && ' · '}
                  {o.price != null && `${o.price} ₽/шт.`}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label={`Убрать ${o.label}`}
                disabled={cnt === 0}
                onClick={() => set(o.id, cnt - (group.step ?? 1))}
                className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:border-primary/60 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Minus size={15} />
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={9999}
                value={cnt}
                aria-label={`${o.label}, количество`}
                onChange={(e) => set(o.id, Number(e.target.value) || 0)}
                className="h-9 w-14 rounded-lg border border-border bg-bg text-center text-sm font-semibold tabular-nums text-fg focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                aria-label={`Добавить ${o.label}`}
                onClick={() => set(o.id, cnt + (group.step ?? 1))}
                className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:border-primary/60"
              >
                <Plus size={15} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Селектор с поиском-автоподсказкой (ТЗ п.3.3) ---------- */
export function SearchSelect({
  group,
  value,
  onChange,
}: {
  group: ParamGroup;
  value: string | number;
  onChange: (v: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = group.options?.find((o) => o.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return group.options ?? [];
    return (group.options ?? []).filter(
      (o) => o.label.toLowerCase().includes(q) || o.note?.toLowerCase().includes(q),
    );
  }, [group.options, query]);

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={group.label}
          placeholder={selected ? `${selected.label} — искать другой…` : 'Начните вводить название…'}
          value={query}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          className="h-11 w-full rounded-xl border border-border bg-bg pl-9 pr-3 text-fg placeholder:text-subtle focus:border-primary focus:outline-none"
        />
      </div>
      {selected && !open && (
        <p className="mt-1.5 text-sm">
          <span className="font-medium">{selected.label}</span>
          {selected.note && <span className="text-muted"> · {selected.note}</span>}
          {selected.price != null && <span className="text-muted"> · {selected.price} ₽</span>}
        </p>
      )}
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1.5 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-xl"
        >
          {filtered.length === 0 && (
            <li className="px-3 py-2.5 text-sm text-muted">Ничего не найдено — уточните запрос</li>
          )}
          {filtered.map((o) => (
            <li key={o.id} role="option" aria-selected={o.id === value}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(o.id);
                  setQuery('');
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-baseline justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2',
                  o.id === value && 'bg-primary/10 text-primary',
                )}
              >
                <span className="min-w-0">
                  {o.label}
                  {o.note && <span className="ml-1.5 text-xs text-subtle">{o.note}</span>}
                </span>
                {o.price != null && <span className="shrink-0 font-semibold tabular-nums">{o.price} ₽</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Выпадающий список (селектор документа и т.п.) ---------- */
export function Select({
  group,
  value,
  onChange,
}: {
  group: ParamGroup;
  value: string | number;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={group.label}
      className="h-11 w-full rounded-xl border border-border bg-bg px-3 text-fg focus:border-primary focus:outline-none"
    >
      {group.options?.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
          {o.note ? ` — ${o.note}` : ''}
        </option>
      ))}
    </select>
  );
}

/* ---------- Тумблер срочности ---------- */
export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn('flex min-w-0 items-center gap-2.5 text-left', disabled && 'cursor-not-allowed opacity-45')}
    >
      <span
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-surface-2',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
