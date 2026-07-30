'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { DraftRuleInput, PriceRuleKind, PriceRuleView, PricingDefinitionDetail } from '@/lib/api/admin-pricing';
import { RULE_KINDS, ruleKindFields, ruleKindLabel } from '@/lib/admin/pricing-presentation';

interface ConditionRow {
  param: string;
  value: string;
}

/** Условие {param:value} ↔ строки редактора. Массивы значений сводим к первому (технический редактор). */
function conditionToRows(condition: Record<string, unknown> | null | undefined): ConditionRow[] {
  if (!condition) return [];
  return Object.entries(condition).map(([param, v]) => ({
    param,
    value: Array.isArray(v) ? String(v[0] ?? '') : String(v ?? ''),
  }));
}

function rowsToCondition(rows: ConditionRow[]): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const r of rows) {
    if (r.param && r.value) out[r.param] = r.value;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Технический редактор одного ценового правила DRAFT. Поля зависят от вида
 * правила; условия строятся select-ами из read-only параметров/опций
 * определения (администратор не вводит id вручную). Не «arbitrary JSON editor».
 */
export function RuleEditor({
  definition,
  rule,
  saving,
  onSave,
  onCancel,
}: {
  definition: PricingDefinitionDetail;
  rule: PriceRuleView | null;
  saving: boolean;
  onSave: (fields: DraftRuleInput) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<PriceRuleKind>(rule?.kind ?? 'SURCHARGE_FLAT');
  const [priority, setPriority] = useState(String(rule?.priority ?? 0));
  const [qtyFrom, setQtyFrom] = useState(rule?.qtyFrom != null ? String(rule.qtyFrom) : '');
  const [qtyTo, setQtyTo] = useState(rule?.qtyTo != null ? String(rule.qtyTo) : '');
  const [amountRub, setAmountRub] = useState(rule?.amountMinor != null ? String(rule.amountMinor / 100) : '');
  const [multiplier, setMultiplier] = useState(rule?.multiplier != null ? String(rule.multiplier) : '');
  const [rows, setRows] = useState<ConditionRow[]>(conditionToRows(rule?.condition));

  const fields = ruleKindFields(kind);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input: DraftRuleInput = {
      kind,
      priority: Number(priority) || 0,
      condition: rowsToCondition(rows),
    };
    if (fields.tier) {
      input.qtyFrom = qtyFrom !== '' ? Number(qtyFrom) : null;
      input.qtyTo = qtyTo !== '' ? Number(qtyTo) : null;
    }
    if (fields.amount) {
      input.amountMinor = amountRub !== '' ? Math.round(Number(amountRub) * 100) : null;
    }
    if (fields.multiplier) {
      input.multiplier = multiplier !== '' ? Number(multiplier) : null;
    }
    onSave(input);
  }

  const optionParams = definition.parameters;

  return (
    <form onSubmit={submit} className="rounded-2xl border border-primary/30 bg-surface p-4" aria-label="Редактор правила">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-muted">Вид правила</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as PriceRuleKind)} className="h-10 w-full rounded-xl border border-border bg-bg px-3 text-fg focus:border-primary focus:outline-none">
            {RULE_KINDS.map((k) => (
              <option key={k} value={k}>{ruleKindLabel(k)}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Приоритет</span>
          <input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} className="h-10 w-full rounded-xl border border-border bg-bg px-3 text-fg focus:border-primary focus:outline-none" />
        </label>

        {fields.tier && (
          <>
            <label className="text-sm">
              <span className="mb-1 block text-muted">Тираж с</span>
              <input type="number" value={qtyFrom} onChange={(e) => setQtyFrom(e.target.value)} className="h-10 w-full rounded-xl border border-border bg-bg px-3 text-fg focus:border-primary focus:outline-none" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted">Тираж по (пусто = открытый)</span>
              <input type="number" value={qtyTo} onChange={(e) => setQtyTo(e.target.value)} className="h-10 w-full rounded-xl border border-border bg-bg px-3 text-fg focus:border-primary focus:outline-none" />
            </label>
          </>
        )}
        {fields.amount && (
          <label className="text-sm">
            <span className="mb-1 block text-muted">Сумма, ₽</span>
            <input type="number" step="0.01" value={amountRub} onChange={(e) => setAmountRub(e.target.value)} className="h-10 w-full rounded-xl border border-border bg-bg px-3 text-fg focus:border-primary focus:outline-none" />
          </label>
        )}
        {fields.multiplier && (
          <label className="text-sm">
            <span className="mb-1 block text-muted">Множитель</span>
            <input type="number" step="0.0001" value={multiplier} onChange={(e) => setMultiplier(e.target.value)} className="h-10 w-full rounded-xl border border-border bg-bg px-3 text-fg focus:border-primary focus:outline-none" />
          </label>
        )}
      </div>

      {/* Условие: параметр → значение (select-ы из read-only метаданных). */}
      <div className="mt-3">
        <p className="mb-1 text-sm text-muted">Условие (когда применять)</p>
        <div className="space-y-2">
          {rows.map((row, i) => {
            const param = optionParams.find((p) => p.urlKey === row.param);
            const activeOptions = param?.options.filter((o) => o.isActive) ?? [];
            return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Параметр условия"
                  value={row.param}
                  onChange={(e) => setRows((rs) => rs.map((r, idx) => (idx === i ? { param: e.target.value, value: '' } : r)))}
                  className="h-9 min-w-[140px] flex-1 rounded-xl border border-border bg-bg px-2 text-sm text-fg focus:border-primary focus:outline-none"
                >
                  <option value="">— параметр —</option>
                  {optionParams.map((p) => (
                    <option key={p.urlKey} value={p.urlKey}>{p.label} ({p.urlKey})</option>
                  ))}
                </select>
                {activeOptions.length > 0 ? (
                  <select
                    aria-label="Значение условия"
                    value={row.value}
                    onChange={(e) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, value: e.target.value } : r)))}
                    className="h-9 min-w-[140px] flex-1 rounded-xl border border-border bg-bg px-2 text-sm text-fg focus:border-primary focus:outline-none"
                  >
                    <option value="">— значение —</option>
                    {activeOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label} ({o.value})</option>
                    ))}
                  </select>
                ) : (
                  <input
                    aria-label="Значение условия"
                    value={row.value}
                    onChange={(e) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, value: e.target.value } : r)))}
                    placeholder="значение"
                    className="h-9 min-w-[140px] flex-1 rounded-xl border border-border bg-bg px-2 text-sm text-fg focus:border-primary focus:outline-none"
                  />
                )}
                <button type="button" onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))} aria-label="Убрать условие" className="grid h-9 w-9 place-items-center rounded-xl border border-border text-subtle hover:text-danger">
                  <X size={15} />
                </button>
              </div>
            );
          })}
          <button type="button" onClick={() => setRows((rs) => [...rs, { param: '', value: '' }])} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            <Plus size={14} /> Добавить условие
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="submit" disabled={saving} className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary-hover disabled:opacity-60">
          {saving ? 'Сохраняем…' : rule ? 'Сохранить правило' : 'Добавить правило'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className="h-10 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-60">
          Отмена
        </button>
      </div>
    </form>
  );
}
