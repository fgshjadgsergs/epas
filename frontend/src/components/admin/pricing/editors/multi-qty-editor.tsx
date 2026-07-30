'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { PriceRuleView, PricingDefinitionDetail } from '@/lib/api/admin-pricing';
import { useRuleEditor } from '@/lib/admin/use-rule-editor';
import { minorToRub } from '@/lib/admin/pricing-presentation';
import type { EditableRule } from '@/lib/admin/pricing-rule-edit';
import { DeleteConfirm, EditorFrame, MoneyInput, MultiplierList } from './shared';

/** Ключ формата из config правила строки. */
function lineKeyOf(row: EditableRule): string {
  const cfg = (row.config ?? {}) as { lineKey?: string };
  return cfg.lineKey ?? '';
}

/**
 * Редактор построчных цен фотопечати (MULTI_QTY): для каждого формата —
 * диапазон количества и цена за отпечаток. Подсвечивает очевидные пересечения
 * диапазонов; финальная проверка — backend validate.
 */
export function MultiQtyEditor({
  rules,
  definition,
  priceListId,
  revision,
  canEdit,
  reload,
  onDirtyChange,
  errorRuleIds,
  currency,
}: {
  rules: PriceRuleView[];
  definition: PricingDefinitionDetail;
  priceListId: string;
  revision: number;
  canEdit: boolean;
  reload: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  errorRuleIds: Set<string>;
  currency: string;
}) {
  const editor = useRuleEditor({ rules, priceListId, revision, reload, onDirtyChange });
  const [toDelete, setToDelete] = useState<{ row: EditableRule; description: string } | null>(null);

  const multiParam = definition.parameters.find((p) => p.type === 'MULTI_QTY');
  const formatOptions = multiParam?.options.filter((o) => o.isActive) ?? [];
  const formatLabel = (key: string) => formatOptions.find((o) => o.value === key)?.label ?? key;

  const lineRows = editor.rows.filter((r) => r.kind === 'BASE_PER_MULTI_QTY_LINE' && !r.deleted);
  const multipliers = editor.rows.filter((r) => r.kind === 'MULTIPLIER');
  const nextPriority = () => Math.max(0, ...editor.rows.map((r) => r.priority)) + 1;

  // Клиентская подсветка очевидных пересечений диапазонов внутри одного формата.
  const overlapKeys = useMemo(() => {
    const bad = new Set<string>();
    const byFormat = new Map<string, EditableRule[]>();
    for (const r of lineRows) {
      const k = lineKeyOf(r);
      byFormat.set(k, [...(byFormat.get(k) ?? []), r]);
    }
    for (const group of byFormat.values()) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i];
          const b = group[j];
          const aFrom = a.qtyFrom ?? 1;
          const aTo = a.qtyTo ?? Number.MAX_SAFE_INTEGER;
          const bFrom = b.qtyFrom ?? 1;
          const bTo = b.qtyTo ?? Number.MAX_SAFE_INTEGER;
          if (aFrom <= bTo && bFrom <= aTo) {
            bad.add(a.localKey);
            bad.add(b.localKey);
          }
        }
      }
    }
    return bad;
  }, [lineRows]);

  function addLine() {
    if (!multiParam) return;
    const firstFormat = formatOptions[0]?.value ?? '';
    editor.addRow({
      kind: 'BASE_PER_MULTI_QTY_LINE',
      priority: nextPriority(),
      condition: null,
      qtyFrom: 1,
      qtyTo: null,
      amountMinor: 0,
      multiplier: null,
      config: { sourceParameter: multiParam.urlKey, lineKey: firstFormat },
    });
  }

  return (
    <>
      <EditorFrame title="Цены по форматам" dirty={editor.dirty} saving={editor.saving} error={editor.error} canEdit={canEdit} onSave={editor.save} onCancel={editor.cancel}>
        {overlapKeys.size > 0 && (
          <p className="mb-2 rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning">Обнаружены пересекающиеся диапазоны — проверьте подсвеченные строки (финальная проверка при «Проверить прайс»).</p>
        )}

        <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-subtle">
              <tr>
                <th className="px-3 py-2 font-semibold">Формат</th>
                <th className="px-3 py-2 font-semibold">Кол-во с</th>
                <th className="px-3 py-2 font-semibold">Кол-во по</th>
                <th className="px-3 py-2 font-semibold">Цена за отпечаток</th>
                {canEdit && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {lineRows.map((row) => {
                const highlighted = (row.id && errorRuleIds.has(row.id)) || overlapKeys.has(row.localKey);
                return (
                  <tr key={row.localKey} className={`border-t border-border ${highlighted ? 'bg-danger/5' : ''}`} data-testid="multiqty-row">
                    <td className="px-3 py-2">
                      {canEdit ? (
                        <select aria-label="Формат" value={lineKeyOf(row)} onChange={(e) => editor.updateRow(row.localKey, { config: { ...(row.config ?? {}), sourceParameter: multiParam?.urlKey, lineKey: e.target.value } })} className="h-8 rounded-lg border border-border bg-bg px-2 text-fg focus:border-primary focus:outline-none">
                          {formatOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                        </select>
                      ) : formatLabel(lineKeyOf(row))}
                    </td>
                    <td className="px-3 py-2">{canEdit ? <input type="number" aria-label="Количество с" value={row.qtyFrom ?? ''} onChange={(e) => editor.updateRow(row.localKey, { qtyFrom: e.target.value === '' ? null : Number(e.target.value) })} className="h-8 w-20 rounded-lg border border-border bg-bg px-2 text-fg focus:border-primary focus:outline-none" /> : (row.qtyFrom ?? '—')}</td>
                    <td className="px-3 py-2">{canEdit ? <input type="number" aria-label="Количество по" placeholder="∞" value={row.qtyTo ?? ''} onChange={(e) => editor.updateRow(row.localKey, { qtyTo: e.target.value === '' ? null : Number(e.target.value) })} className="h-8 w-20 rounded-lg border border-border bg-bg px-2 text-fg focus:border-primary focus:outline-none" /> : (row.qtyTo ?? '∞')}</td>
                    <td className="px-3 py-2">{canEdit ? <MoneyInput amountMinor={row.amountMinor} onChange={(v) => editor.updateRow(row.localKey, { amountMinor: v })} /> : `${minorToRub(row.amountMinor)} ${currency}`}</td>
                    {canEdit && <td className="px-3 py-2 text-right"><button onClick={() => setToDelete({ row, description: `${formatLabel(lineKeyOf(row))}, ${row.qtyFrom ?? '—'}–${row.qtyTo ?? '∞'} шт, ${minorToRub(row.amountMinor)} ${currency}` })} aria-label="Удалить строку формата" className="text-subtle hover:text-danger"><Trash2 size={15} /></button></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <ul className="space-y-2 md:hidden">
          {lineRows.map((row) => (
            <li key={row.localKey} className={`rounded-xl border p-3 ${overlapKeys.has(row.localKey) ? 'border-danger' : 'border-border'} bg-bg`}>
              {canEdit ? (
                <div className="space-y-2">
                  <select aria-label="Формат" value={lineKeyOf(row)} onChange={(e) => editor.updateRow(row.localKey, { config: { ...(row.config ?? {}), sourceParameter: multiParam?.urlKey, lineKey: e.target.value } })} className="h-9 w-full rounded-lg border border-border bg-bg px-2">{formatOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}</select>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" aria-label="Количество с" value={row.qtyFrom ?? ''} onChange={(e) => editor.updateRow(row.localKey, { qtyFrom: e.target.value === '' ? null : Number(e.target.value) })} className="h-9 rounded-lg border border-border bg-bg px-2" />
                    <input type="number" aria-label="Количество по" value={row.qtyTo ?? ''} onChange={(e) => editor.updateRow(row.localKey, { qtyTo: e.target.value === '' ? null : Number(e.target.value) })} className="h-9 rounded-lg border border-border bg-bg px-2" />
                  </div>
                  <div className="flex items-end justify-between"><MoneyInput label="Цена за отпечаток" amountMinor={row.amountMinor} onChange={(v) => editor.updateRow(row.localKey, { amountMinor: v })} /><button onClick={() => setToDelete({ row, description: `${formatLabel(lineKeyOf(row))}` })} className="text-subtle hover:text-danger"><Trash2 size={16} /></button></div>
                </div>
              ) : (
                <div className="flex justify-between text-sm"><span>{formatLabel(lineKeyOf(row))} · {row.qtyFrom ?? '—'}–{row.qtyTo ?? '∞'}</span><span className="font-medium">{minorToRub(row.amountMinor)} {currency}</span></div>
              )}
            </li>
          ))}
        </ul>

        {lineRows.length === 0 && <p className="text-sm text-muted">Строк по форматам нет.</p>}
        {canEdit && multiParam && (
          <button onClick={addLine} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            <Plus size={14} /> Добавить формат
          </button>
        )}

        <div className="mt-5 border-t border-border pt-4">
          <MultiplierList
            rows={multipliers}
            definition={definition}
            canEdit={canEdit}
            errorKeys={errorRuleIds}
            onUpdate={editor.updateRow}
            onAdd={() => editor.addRow({ kind: 'MULTIPLIER', priority: nextPriority(), condition: null, qtyFrom: null, qtyTo: null, amountMinor: null, multiplier: 1, config: null })}
            onDelete={(row) => setToDelete({ row, description: `Модификатор × ${row.multiplier}` })}
          />
        </div>
      </EditorFrame>

      {toDelete && (
        <DeleteConfirm description={toDelete.description} onConfirm={() => { editor.markDelete(toDelete.row.localKey); setToDelete(null); }} onCancel={() => setToDelete(null)} />
      )}
    </>
  );
}
