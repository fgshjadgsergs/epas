'use client';

import { useCallback, useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { tokenStorage } from '@/lib/api/auth';
import { getPricingAudit, type PricingAuditEntry } from '@/lib/api/admin-pricing';
import { auditActionLabel, formatPricingDate } from '@/lib/admin/pricing-presentation';

const PAGE_SIZE = 10;

/**
 * Компактная история изменений прайса. Безопасное имя сотрудника (displayName),
 * без сырого actorId и без гигантского JSON. Load more через пагинацию API.
 */
export function AuditHistory({ priceListId }: { priceListId: string }) {
  const [entries, setEntries] = useState<PricingAuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(
    (targetPage: number) => {
      const token = tokenStorage.getAccessToken();
      if (!token) return;
      setLoading(true);
      setError(false);
      getPricingAudit(token, { priceListId, page: targetPage, pageSize: PAGE_SIZE })
        .then((res) => {
          setEntries((prev) => (targetPage === 1 ? res.items : [...prev, ...res.items]));
          setTotal(res.total);
        })
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    },
    [priceListId],
  );

  useEffect(() => {
    load(1);
    setPage(1);
  }, [load]);

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h3 className="flex items-center gap-2 font-semibold">
        <History size={16} className="text-muted" /> История изменений
      </h3>

      {loading && entries.length === 0 && <p className="mt-3 text-sm text-muted" role="status">Загружаем историю…</p>}
      {error && entries.length === 0 && <p className="mt-3 text-sm text-muted">Не удалось загрузить историю.</p>}
      {!loading && entries.length === 0 && !error && <p className="mt-3 text-sm text-muted">Изменений пока нет.</p>}

      {entries.length > 0 && (
        <ol className="mt-3 space-y-3">
          {entries.map((e) => (
            <li key={e.id} className="flex gap-3 text-sm">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
              <span className="min-w-0">
                <span className="font-medium">{e.changedBy?.displayName ?? 'Система'}</span>
                <span className="text-muted"> — {auditActionLabel(e.action)}</span>
                <span className="ml-2 text-xs text-subtle">{formatPricingDate(e.createdAt)}</span>
                {summarize(e) && <span className="mt-0.5 block text-xs text-muted">{summarize(e)}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}

      {entries.length < total && (
        <button
          onClick={() => {
            const next = page + 1;
            setPage(next);
            load(next);
          }}
          disabled={loading}
          className="mt-3 h-9 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Загрузка…' : 'Показать ещё'}
        </button>
      )}
    </section>
  );
}

/** Компактное безопасное описание изменения (без raw JSON). */
function summarize(entry: PricingAuditEntry): string {
  const after = entry.after ?? {};
  const before = entry.before ?? {};
  if (entry.action === 'pricing.publish') {
    const v = (after as { version?: number }).version;
    return v ? `версия ${v}` : '';
  }
  if (entry.action === 'pricing.draft.clone') {
    const v = (after as { version?: number }).version;
    return v ? `черновик версии ${v}` : '';
  }
  if (entry.action.startsWith('pricing.rule')) {
    const kind = (after as { kind?: string }).kind ?? (before as { kind?: string }).kind;
    return kind ? `правило: ${kind}` : '';
  }
  return '';
}
