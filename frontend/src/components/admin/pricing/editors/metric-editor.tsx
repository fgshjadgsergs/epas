'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { PriceRuleView, PricingDefinitionDetail } from '@/lib/api/admin-pricing';
import { useRuleEditor } from '@/lib/admin/use-rule-editor';
import { minorToRub } from '@/lib/admin/pricing-presentation';
import { humanizeCondition, type EditableRule } from '@/lib/admin/pricing-rule-edit';
import { ConditionEditor, DeleteConfirm, EditorFrame, MoneyInput, MultiplierList } from './shared';

/** Единица цены доплаты по её config. */
function surchargeUnit(row: EditableRule): string {
  if (row.kind === 'SURCHARGE_PER_LENGTH') {
    const u = (row.config as { unit?: string } | null)?.unit ?? 'м';
    return `₽/${u}`;
  }
  if (row.kind === 'SURCHARGE_PER_INTERVAL_COUNT') return '₽/интервал';
  return '₽';
}

/** Человеческое описание метрической доплаты. */
function surchargeDesc(row: EditableRule): string {
  const cfg = (row.config ?? {}) as { sourceMetric?: string; interval?: number; intervalUnit?: string };
  if (row.kind === 'SURCHARGE_PER_INTERVAL_COUNT') {
    return `по количеству интервалов ${cfg.sourceMetric ?? ''}${cfg.interval ? `, каждые ${cfg.interval} ${cfg.intervalUnit ?? ''}` : ''}`;
  }
  if (row.kind === 'SURCHARGE_PER_LENGTH') return `за длину ${cfg.sourceMetric ?? ''}`;
  return '';
}

/**
 * Редактор баннеров: базовая цена за м² по материалам, метрические доплаты
 * (люверсы/проклейка), минимальная стоимость и множители. config метрических
 * правил фронт не сочиняет — сохраняет как есть; итог считает backend.
 */
export function MetricEditor({
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

  const perSqm = editor.rows.filter((r) => r.kind === 'BASE_PER_SQM' && !r.deleted);
  const surcharges = editor.rows.filter((r) => (r.kind === 'SURCHARGE_PER_LENGTH' || r.kind === 'SURCHARGE_PER_INTERVAL_COUNT') && !r.deleted);
  const minTotals = editor.rows.filter((r) => r.kind === 'MIN_TOTAL' && !r.deleted);
  const multipliers = editor.rows.filter((r) => r.kind === 'MULTIPLIER');
  const nextPriority = () => Math.max(0, ...editor.rows.map((r) => r.priority)) + 1;
  const rowHighlighted = (row: EditableRule) => (row.id ? errorRuleIds.has(row.id) : false);

  return (
    <>
      <EditorFrame title="Цены баннеров" dirty={editor.dirty} saving={editor.saving} error={editor.error} canEdit={canEdit} onSave={editor.save} onCancel={editor.cancel}>
        {/* Базовая цена за м² */}
        <p className="mb-2 text-sm font-medium text-muted">Базовая цена за м²</p>
        <ul className="space-y-2">
          {perSqm.map((row) => (
            <li key={row.localKey} className={`rounded-xl border p-3 ${rowHighlighted(row) ? 'border-danger bg-danger/5' : 'border-border bg-bg'}`} data-testid="persqm-row">
              {canEdit ? (
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-[180px] flex-1">
                    <span className="mb-1 block text-xs text-muted">Условие (материал)</span>
                    <ConditionEditor condition={row.condition} definition={definition} onChange={(c) => editor.updateRow(row.localKey, { condition: c })} />
                  </div>
                  <MoneyInput label="Цена" amountMinor={row.amountMinor} onChange={(v) => editor.updateRow(row.localKey, { amountMinor: v })} suffix="₽/м²" />
                  <button onClick={() => setToDelete({ row, description: `Цена за м²: ${humanizeCondition(row.condition, definition)} — ${minorToRub(row.amountMinor)} ${currency}/м²` })} aria-label="Удалить цену за м²" className="mt-4 text-subtle hover:text-danger"><Trash2 size={15} /></button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 text-sm"><span className="text-muted">{humanizeCondition(row.condition, definition)}</span><span className="font-medium">{minorToRub(row.amountMinor)} {currency}/м²</span></div>
              )}
            </li>
          ))}
        </ul>
        {canEdit && (
          <button onClick={() => editor.addRow({ kind: 'BASE_PER_SQM', priority: nextPriority(), condition: null, qtyFrom: null, qtyTo: null, amountMinor: 0, multiplier: null, config: null })} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            <Plus size={14} /> Добавить материал
          </button>
        )}

        {/* Метрические доплаты */}
        <div className="mt-5 border-t border-border pt-4">
          <p className="mb-2 text-sm font-medium text-muted">Доплаты (люверсы, проклейка)</p>
          {surcharges.length === 0 && <p className="text-sm text-muted">Доплат нет.</p>}
          <ul className="space-y-2">
            {surcharges.map((row) => (
              <li key={row.localKey} className={`rounded-xl border p-3 ${rowHighlighted(row) ? 'border-danger bg-danger/5' : 'border-border bg-bg'}`} data-testid="surcharge-row">
                <p className="text-xs text-subtle">{surchargeDesc(row)}</p>
                {canEdit ? (
                  <div className="mt-1 flex flex-wrap items-start gap-3">
                    <div className="min-w-[180px] flex-1">
                      <span className="mb-1 block text-xs text-muted">Условие</span>
                      <ConditionEditor condition={row.condition} definition={definition} onChange={(c) => editor.updateRow(row.localKey, { condition: c })} />
                    </div>
                    <MoneyInput label="Цена" amountMinor={row.amountMinor} onChange={(v) => editor.updateRow(row.localKey, { amountMinor: v })} suffix={surchargeUnit(row)} />
                    <button onClick={() => setToDelete({ row, description: `Доплата ${surchargeDesc(row)}: ${humanizeCondition(row.condition, definition)} — ${minorToRub(row.amountMinor)} ${surchargeUnit(row)}` })} aria-label="Удалить доплату" className="mt-4 text-subtle hover:text-danger"><Trash2 size={15} /></button>
                  </div>
                ) : (
                  <div className="mt-1 flex items-center justify-between gap-3 text-sm"><span className="text-muted">{humanizeCondition(row.condition, definition)}</span><span className="font-medium">{minorToRub(row.amountMinor)} {surchargeUnit(row)}</span></div>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Минимальная стоимость */}
        <div className="mt-5 border-t border-border pt-4">
          <p className="mb-2 text-sm font-medium text-muted">Минимальная стоимость заказа</p>
          {minTotals.length === 0 ? (
            <p className="text-sm text-muted">Не задана.{canEdit && <button onClick={() => editor.addRow({ kind: 'MIN_TOTAL', priority: nextPriority(), condition: null, qtyFrom: null, qtyTo: null, amountMinor: 0, multiplier: null, config: null })} className="ml-2 font-medium text-primary hover:underline">Задать</button>}</p>
          ) : (
            <ul className="space-y-2">
              {minTotals.map((row) => (
                <li key={row.localKey} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg p-3">
                  {canEdit ? (
                    <>
                      <MoneyInput label="Минимум за заказ" amountMinor={row.amountMinor} onChange={(v) => editor.updateRow(row.localKey, { amountMinor: v })} />
                      <button onClick={() => setToDelete({ row, description: `Минимальная стоимость ${minorToRub(row.amountMinor)} ${currency}` })} aria-label="Удалить минимум" className="text-subtle hover:text-danger"><Trash2 size={15} /></button>
                    </>
                  ) : (
                    <span className="text-sm font-medium">{minorToRub(row.amountMinor)} {currency}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Множители */}
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
