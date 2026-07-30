'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tokenStorage } from '@/lib/api/auth';
import type { PriceRuleView } from '@/lib/api/admin-pricing';
import {
  applyRuleChanges,
  isRowChanged,
  nextLocalKey,
  ruleToEditable,
  type EditableRule,
} from './pricing-rule-edit';
import type { PricingError } from './pricing-errors';

/**
 * Состояние специализированного редактора: локальные строки правил, признак
 * несохранённых изменений и последовательное сохранение через rule CRUD.
 * revision берётся из refetch после сохранения — локально не выдумывается.
 */
export function useRuleEditor(options: {
  rules: PriceRuleView[];
  priceListId: string;
  revision: number;
  reload: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { rules, priceListId, revision, reload, onDirtyChange } = options;

  const [rows, setRows] = useState<EditableRule[]>(() => rules.map(ruleToEditable));
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<PricingError | null>(null);

  // Синхронизируемся с backend, когда правила пришли заново (после reload).
  const rulesKey = useMemo(() => rules.map((r) => `${r.id}:${r.priority}:${r.amountMinor}:${r.multiplier}:${r.qtyFrom}:${r.qtyTo}`).join('|'), [rules]);
  useEffect(() => {
    setRows(rules.map(ruleToEditable));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rulesKey]);

  const originalById = useMemo(() => new Map(rules.map((r) => [r.id, r])), [rules]);

  const dirty = useMemo(() => {
    const hasDeleted = rows.some((r) => r.deleted && r.id);
    const hasNew = rows.some((r) => !r.id && !r.deleted);
    const hasChanged = rows.some((r) => !r.deleted && r.id && isRowChanged(r, originalById.get(r.id!)));
    // Новая строка, помеченная удалённой (не сохранённая), не считается изменением.
    return hasDeleted || hasNew || hasChanged;
  }, [rows, originalById]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const updateRow = useCallback((localKey: string, patch: Partial<EditableRule>) => {
    setRows((rs) => rs.map((r) => (r.localKey === localKey ? { ...r, ...patch } : r)));
  }, []);

  const addRow = useCallback((row: Omit<EditableRule, 'localKey'>) => {
    setRows((rs) => [...rs, { ...row, localKey: nextLocalKey() }]);
  }, []);

  const markDelete = useCallback((localKey: string) => {
    setRows((rs) =>
      rs
        // Новую (несохранённую) строку убираем сразу; существующую помечаем deleted.
        .map((r) => (r.localKey === localKey && r.id ? { ...r, deleted: true } : r))
        .filter((r) => !(r.localKey === localKey && !r.id)),
    );
  }, []);

  const cancel = useCallback(() => {
    setRows(rules.map(ruleToEditable));
    setError(null);
  }, [rules]);

  const save = useCallback(async (): Promise<boolean> => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    const token = tokenStorage.getAccessToken();
    if (!token) {
      setError({ kind: 'unauthorized', message: 'Сессия истекла. Войдите заново.', reload: false });
      savingRef.current = false;
      setSaving(false);
      return false;
    }
    const outcome = await applyRuleChanges(priceListId, revision, rows, originalById, token);
    savingRef.current = false;
    setSaving(false);
    // Всегда рефетчим — забираем актуальные правила и revision (в т.ч. при
    // частичном применении, чтобы не показывать устаревшее состояние).
    reload();
    if (outcome.error) {
      setError(outcome.error);
      return false;
    }
    return true;
  }, [priceListId, revision, rows, originalById, reload]);

  return { rows, dirty, saving, error, updateRow, addRow, markDelete, cancel, save, setError };
}
