'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle, Plus, Save, Trash2, X } from 'lucide-react';
import type { PricingDefinitionDetail } from '@/lib/api/admin-pricing';
import type { EditableRule } from '@/lib/admin/pricing-rule-edit';
import { humanizeCondition, minorToRubInput, rubToMinor } from '@/lib/admin/pricing-rule-edit';
import type { PricingError } from '@/lib/admin/pricing-errors';

/** Рамка редактора: несохранённые изменения + Save/Cancel + ошибка. */
export function EditorFrame({
  title,
  dirty,
  saving,
  error,
  canEdit,
  onSave,
  onCancel,
  children,
}: {
  title: string;
  dirty: boolean;
  saving: boolean;
  error: PricingError | null;
  canEdit: boolean;
  onSave: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        {canEdit && dirty && (
          <span className="flex items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-1 text-xs font-semibold text-warning">
            <AlertTriangle size={12} /> Есть несохранённые изменения
          </span>
        )}
      </div>

      {error && <p role="alert" className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error.message}</p>}

      <div className="mt-3">{children}</div>

      {canEdit && dirty && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={onSave} disabled={saving} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary-hover disabled:opacity-60">
            <Save size={15} /> {saving ? 'Сохраняем…' : 'Сохранить изменения'}
          </button>
          <button onClick={onCancel} disabled={saving} className="h-10 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-60">
            Отменить
          </button>
        </div>
      )}
    </section>
  );
}

/** Инлайн-редактор условия правила: строки «параметр → значение» из metadata. */
export function ConditionEditor({
  condition,
  definition,
  onChange,
}: {
  condition: Record<string, unknown> | null;
  definition: PricingDefinitionDetail;
  onChange: (condition: Record<string, unknown> | null) => void;
}) {
  const rows = condition ? Object.entries(condition).map(([param, v]) => ({ param, value: Array.isArray(v) ? String(v[0] ?? '') : String(v ?? '') })) : [];

  function emit(next: { param: string; value: string }[]) {
    const out: Record<string, string> = {};
    for (const r of next) if (r.param && r.value) out[r.param] = r.value;
    onChange(Object.keys(out).length > 0 ? out : null);
  }

  return (
    <div className="space-y-1.5">
      {rows.map((row, i) => {
        const param = definition.parameters.find((p) => p.urlKey === row.param);
        const opts = param?.options.filter((o) => o.isActive) ?? [];
        return (
          <div key={i} className="flex flex-wrap items-center gap-1.5">
            <select
              aria-label="Параметр условия"
              value={row.param}
              onChange={(e) => emit(rows.map((r, idx) => (idx === i ? { param: e.target.value, value: '' } : r)))}
              className="h-8 min-w-[120px] flex-1 rounded-lg border border-border bg-bg px-2 text-xs text-fg focus:border-primary focus:outline-none"
            >
              <option value="">— параметр —</option>
              {definition.parameters.map((p) => (<option key={p.urlKey} value={p.urlKey}>{p.label}</option>))}
            </select>
            {opts.length > 0 ? (
              <select
                aria-label="Значение условия"
                value={row.value}
                onChange={(e) => emit(rows.map((r, idx) => (idx === i ? { ...r, value: e.target.value } : r)))}
                className="h-8 min-w-[120px] flex-1 rounded-lg border border-border bg-bg px-2 text-xs text-fg focus:border-primary focus:outline-none"
              >
                <option value="">— значение —</option>
                {opts.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
            ) : (
              <input aria-label="Значение условия" value={row.value} onChange={(e) => emit(rows.map((r, idx) => (idx === i ? { ...r, value: e.target.value } : r)))} className="h-8 min-w-[120px] flex-1 rounded-lg border border-border bg-bg px-2 text-xs text-fg focus:border-primary focus:outline-none" />
            )}
            <button type="button" onClick={() => emit(rows.filter((_, idx) => idx !== i))} aria-label="Убрать условие" className="grid h-8 w-8 place-items-center rounded-lg border border-border text-subtle hover:text-danger">
              <X size={13} />
            </button>
          </div>
        );
      })}
      <button type="button" onClick={() => emit([...rows, { param: '', value: '' }])} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
        <Plus size={12} /> Условие
      </button>
    </div>
  );
}

/** Список условных множителей (MULTIPLIER) — общий для tier/metric/multiqty. */
export function MultiplierList({
  rows,
  definition,
  canEdit,
  errorKeys,
  onUpdate,
  onAdd,
  onDelete,
}: {
  rows: EditableRule[];
  definition: PricingDefinitionDetail;
  canEdit: boolean;
  errorKeys: Set<string>;
  onUpdate: (localKey: string, patch: Partial<EditableRule>) => void;
  onAdd: () => void;
  onDelete: (row: EditableRule) => void;
}) {
  const visible = rows.filter((r) => !r.deleted);
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-muted">Модификаторы цены (множители)</p>
      {visible.length === 0 && <p className="text-sm text-muted">Модификаторов нет.</p>}
      <ul className="space-y-2">
        {visible.map((row) => {
          const highlighted = row.id ? errorKeys.has(row.id) : false;
          return (
            <li key={row.localKey} className={`rounded-xl border p-3 ${highlighted ? 'border-danger bg-danger/5' : 'border-border bg-bg'}`}>
              {canEdit ? (
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-[180px] flex-1">
                    <ConditionEditor condition={row.condition} definition={definition} onChange={(c) => onUpdate(row.localKey, { condition: c })} />
                  </div>
                  <label className="text-xs">
                    <span className="mb-1 block text-muted">× множитель</span>
                    <input type="number" step="0.0001" value={row.multiplier ?? ''} onChange={(e) => onUpdate(row.localKey, { multiplier: e.target.value === '' ? null : Number(e.target.value) })} className="h-8 w-24 rounded-lg border border-border bg-bg px-2 text-sm text-fg focus:border-primary focus:outline-none" />
                  </label>
                  <button onClick={() => onDelete(row)} aria-label="Удалить модификатор" className="mt-4 text-subtle hover:text-danger"><Trash2 size={15} /></button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted">{humanizeCondition(row.condition, definition)}</span>
                  <span className="font-medium">× {row.multiplier}</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {canEdit && (
        <button onClick={onAdd} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          <Plus size={14} /> Добавить модификатор
        </button>
      )}
    </div>
  );
}

/** Денежное поле (рубли ↔ копейки) для строк редакторов. */
export function MoneyInput({
  amountMinor,
  onChange,
  label,
  suffix,
}: {
  amountMinor: number | null;
  onChange: (amountMinor: number | null) => void;
  label?: string;
  suffix?: string;
}) {
  return (
    <label className="text-xs">
      {label && <span className="mb-1 block text-muted">{label}</span>}
      <span className="flex items-center gap-1">
        <input
          type="number"
          step="0.01"
          inputMode="decimal"
          value={minorToRubInput(amountMinor)}
          onChange={(e) => onChange(e.target.value === '' ? null : rubToMinor(e.target.value))}
          className="h-8 w-28 rounded-lg border border-border bg-bg px-2 text-sm text-fg focus:border-primary focus:outline-none"
        />
        <span className="text-xs text-subtle">{suffix ?? '₽'}</span>
      </span>
    </label>
  );
}

/** Подтверждение удаления правила с человекочитаемым описанием. */
export function DeleteConfirm({
  description,
  onConfirm,
  onCancel,
}: {
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="presentation" onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-label="Удаление правила" className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h4 className="font-bold">Удалить правило?</h4>
        <p className="mt-2 text-sm text-muted">{description}</p>
        <div className="mt-4 flex gap-2">
          <button ref={ref} onClick={onConfirm} className="h-10 rounded-xl bg-danger px-4 text-sm font-semibold text-white hover:bg-danger/90">Удалить</button>
          <button onClick={onCancel} className="h-10 rounded-xl border border-border px-4 text-sm font-medium">Отмена</button>
        </div>
      </div>
    </div>
  );
}
