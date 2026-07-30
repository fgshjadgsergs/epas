'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { PriceRuleView, PricingDefinitionDetail } from '@/lib/api/admin-pricing';
import { useRuleEditor } from '@/lib/admin/use-rule-editor';
import { minorToRub, ruleKindLabel } from '@/lib/admin/pricing-presentation';
import type { EditableRule } from '@/lib/admin/pricing-rule-edit';
import { DeleteConfirm, EditorFrame, MoneyInput, MultiplierList } from './shared';

/**
 * Редактор тиражных цен (визитки, листовки). Базовые цены — таблица по тиражу
 * (цена за штуку), плюс список условных множителей. Прочие виды правил
 * показываются read-only (структуру определения не трогаем).
 */
export function TierEditor({
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

  const tiers = editor.rows.filter((r) => r.kind === 'BASE_TIER' && !r.deleted);
  const multipliers = editor.rows.filter((r) => r.kind === 'MULTIPLIER');
  const others = editor.rows.filter((r) => !r.deleted && r.kind !== 'BASE_TIER' && r.kind !== 'MULTIPLIER');
  const nextPriority = () => Math.max(0, ...editor.rows.map((r) => r.priority)) + 1;

  function addTier() {
    const lastTo = tiers.reduce((max, t) => Math.max(max, t.qtyTo ?? t.qtyFrom ?? 0), 0);
    editor.addRow({ kind: 'BASE_TIER', priority: nextPriority(), condition: null, qtyFrom: lastTo ? lastTo + 1 : definition.minQty, qtyTo: null, amountMinor: 0, multiplier: null, config: null });
  }

  return (
    <>
      <EditorFrame title="Цены по тиражу" dirty={editor.dirty} saving={editor.saving} error={editor.error} canEdit={canEdit} onSave={editor.save} onCancel={editor.cancel}>
        {/* Desktop — таблица */}
        <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-subtle">
              <tr>
                <th className="px-3 py-2 font-semibold">Тираж с</th>
                <th className="px-3 py-2 font-semibold">Тираж по</th>
                <th className="px-3 py-2 font-semibold">Цена за штуку</th>
                {canEdit && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {tiers.map((row) => {
                const highlighted = row.id ? errorRuleIds.has(row.id) : false;
                return (
                  <tr key={row.localKey} className={`border-t border-border ${highlighted ? 'bg-danger/5' : ''}`} data-testid="tier-row">
                    <td className="px-3 py-2">{canEdit ? <input type="number" aria-label="Тираж с" value={row.qtyFrom ?? ''} onChange={(e) => editor.updateRow(row.localKey, { qtyFrom: e.target.value === '' ? null : Number(e.target.value) })} className="h-8 w-24 rounded-lg border border-border bg-bg px-2 text-fg focus:border-primary focus:outline-none" /> : (row.qtyFrom ?? '—')}</td>
                    <td className="px-3 py-2">{canEdit ? <input type="number" aria-label="Тираж по" placeholder="∞" value={row.qtyTo ?? ''} onChange={(e) => editor.updateRow(row.localKey, { qtyTo: e.target.value === '' ? null : Number(e.target.value) })} className="h-8 w-24 rounded-lg border border-border bg-bg px-2 text-fg focus:border-primary focus:outline-none" /> : (row.qtyTo ?? '∞')}</td>
                    <td className="px-3 py-2">{canEdit ? <MoneyInput amountMinor={row.amountMinor} onChange={(v) => editor.updateRow(row.localKey, { amountMinor: v })} /> : `${minorToRub(row.amountMinor)} ${currency}`}</td>
                    {canEdit && <td className="px-3 py-2 text-right"><button onClick={() => setToDelete({ row, description: `Тираж ${row.qtyFrom ?? '—'}–${row.qtyTo ?? '∞'}, цена ${minorToRub(row.amountMinor)} ${currency}` })} aria-label="Удалить строку тиража" className="text-subtle hover:text-danger"><Trash2 size={15} /></button></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile — карточки */}
        <ul className="space-y-2 md:hidden">
          {tiers.map((row) => (
            <li key={row.localKey} className="rounded-xl border border-border bg-bg p-3">
              {canEdit ? (
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs">Тираж с<input type="number" aria-label="Тираж с" value={row.qtyFrom ?? ''} onChange={(e) => editor.updateRow(row.localKey, { qtyFrom: e.target.value === '' ? null : Number(e.target.value) })} className="mt-1 h-9 w-full rounded-lg border border-border bg-bg px-2" /></label>
                  <label className="text-xs">Тираж по<input type="number" aria-label="Тираж по" value={row.qtyTo ?? ''} onChange={(e) => editor.updateRow(row.localKey, { qtyTo: e.target.value === '' ? null : Number(e.target.value) })} className="mt-1 h-9 w-full rounded-lg border border-border bg-bg px-2" /></label>
                  <div className="col-span-2 flex items-end justify-between"><MoneyInput label="Цена за штуку" amountMinor={row.amountMinor} onChange={(v) => editor.updateRow(row.localKey, { amountMinor: v })} /><button onClick={() => setToDelete({ row, description: `Тираж ${row.qtyFrom ?? '—'}–${row.qtyTo ?? '∞'}` })} className="text-subtle hover:text-danger"><Trash2 size={16} /></button></div>
                </div>
              ) : (
                <div className="flex justify-between text-sm"><span>Тираж {row.qtyFrom ?? '—'}–{row.qtyTo ?? '∞'}</span><span className="font-medium">{minorToRub(row.amountMinor)} {currency}</span></div>
              )}
            </li>
          ))}
        </ul>

        {tiers.length === 0 && <p className="text-sm text-muted">Строк тиража нет.</p>}
        {canEdit && (
          <button onClick={addTier} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            <Plus size={14} /> Добавить строку тиража
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

        {others.length > 0 && (
          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-2 text-sm font-medium text-muted">Прочие правила (только просмотр)</p>
            <ul className="space-y-1 text-xs text-muted">
              {others.map((r) => (<li key={r.localKey}>{ruleKindLabel(r.kind)}{r.amountMinor != null ? ` — ${minorToRub(r.amountMinor)} ${currency}` : ''}</li>))}
            </ul>
          </div>
        )}
      </EditorFrame>

      {toDelete && (
        <DeleteConfirm
          description={toDelete.description}
          onConfirm={() => { editor.markDelete(toDelete.row.localKey); setToDelete(null); }}
          onCancel={() => setToDelete(null)}
        />
      )}
    </>
  );
}
