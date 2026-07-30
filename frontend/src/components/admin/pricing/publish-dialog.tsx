'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { PriceListDetail, PriceListSummary } from '@/lib/api/admin-pricing';
import { ModeBadge } from './pricing-definitions-list';

/**
 * Подтверждение публикации DRAFT. Показывает какую версию публикуем, текущую
 * ACTIVE (станет ARCHIVED), режим DEMO/LIVE и предупреждение про STALE-корзины.
 * Про Orders не пишем — они immutable. Publish не срабатывает по первому клику.
 */
export function PublishDialog({
  draft,
  currentActive,
  submitting,
  onConfirm,
  onCancel,
}: {
  draft: PriceListDetail;
  currentActive: PriceListSummary | null;
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, submitting]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="presentation" onClick={() => !submitting && onCancel()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-title"
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="publish-title" className="text-lg font-bold">Опубликовать версию {draft.version}?</h3>

        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Публикуется</dt>
            <dd className="font-semibold">Версия {draft.version} <ModeBadge isDemo={draft.isDemo} /></dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Текущая активная</dt>
            <dd className="font-medium">
              {currentActive ? `Версия ${currentActive.version} → в архив` : 'нет'}
            </dd>
          </div>
        </dl>

        <div className="mt-3 flex items-start gap-2 rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            После публикации существующие корзины клиентов могут стать неактуальными (STALE) и потребуют
            пересчёта. Уже оформленные заказы не меняются.
          </span>
        </div>

        {draft.isDemo && (
          <p className="mt-2 rounded-xl bg-warning/15 px-3 py-2 text-xs font-semibold text-warning">
            Это ДЕМО-прайс. В боевом окружении публикация демо-прайса запрещена backend.
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            ref={confirmRef}
            onClick={onConfirm}
            disabled={submitting}
            className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary-hover disabled:opacity-60"
          >
            {submitting ? 'Публикуем…' : 'Опубликовать'}
          </button>
          <button onClick={onCancel} disabled={submitting} className="h-10 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-60">
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
