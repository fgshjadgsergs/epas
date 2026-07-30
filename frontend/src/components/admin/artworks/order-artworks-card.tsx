'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, FileImage } from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { tokenStorage } from '@/lib/api/auth';
import { getAdminArtworks, type AdminArtworkSummary } from '@/lib/api/admin-artworks';
import {
  adminArtworkDetailPath,
  artworkStatusBadge,
  artworkStatusLabel,
  formatArtworkDate,
  formatFileSize,
  humanFileType,
} from '@/lib/artworks/presentation';

/** Позиция заказа: только то, что нужно для группировки и подписи. */
export interface OrderArtworksItem {
  id: string;
  title: string;
}

type State =
  | { status: 'loading' }
  | { status: 'ready'; byItem: Map<string, AdminArtworkSummary[]> }
  | { status: 'forbidden' }
  | { status: 'error'; message: string };

/**
 * Сводка макетов заказа в карточке заказа админки. Данные — из общего
 * admin/artworks (фильтр по orderNumber). Макеты раскладываются строго по
 * orderItemId (opaque технический id, в DOM как подпись не выводится) — не по
 * названию услуги, поэтому одинаковые названия позиций не путаются. Название —
 * из immutable snapshot самой позиции.
 */
export function OrderArtworksCard({ orderNumber, items }: { orderNumber: string; items: OrderArtworksItem[] }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  const load = useCallback(() => {
    const token = tokenStorage.getAccessToken();
    if (!token) return setState({ status: 'forbidden' });
    setState({ status: 'loading' });
    getAdminArtworks(token, { orderNumber, pageSize: 100 })
      .then((page) => {
        const byItem = new Map<string, AdminArtworkSummary[]>();
        for (const a of page.items) {
          const list = byItem.get(a.orderItemId) ?? [];
          list.push(a);
          byItem.set(a.orderItemId, list);
        }
        // Внутри позиции — по возрастанию версии (v1, v2, …).
        for (const list of byItem.values()) list.sort((x, y) => x.version - y.version);
        setState({ status: 'ready', byItem });
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && (error.status === 403 || error.status === 401)) return setState({ status: 'forbidden' });
        setState({ status: 'error', message: error instanceof ApiError ? error.message : 'Не удалось загрузить макеты.' });
      });
  }, [orderNumber]);

  useEffect(() => load(), [load]);

  return (
    <section className="mt-4 rounded-2xl border border-border bg-surface p-5">
      <h3 className="mb-3 flex items-center gap-1.5 font-semibold"><FileImage size={16} className="text-primary" /> Макеты</h3>

      {state.status === 'loading' && <div className="h-16 animate-pulse rounded-xl border border-border bg-bg" aria-hidden />}
      {state.status === 'forbidden' && <p className="text-sm text-muted">Нет прав на просмотр макетов.</p>}
      {state.status === 'error' && (
        <p className="text-sm text-muted">{state.message} <button onClick={load} className="font-medium text-primary underline">Повторить</button></p>
      )}

      {state.status === 'ready' && (
        <ul aria-label="Позиции заказа" className="space-y-4">
          {items.map((item) => (
            <li key={item.id}>
              {/* Подпись — immutable snapshot позиции, не название услуги. */}
              <p className="text-sm font-semibold">{item.title}</p>
              <ItemArtworks artworks={state.byItem.get(item.id) ?? []} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ItemArtworks({ artworks }: { artworks: AdminArtworkSummary[] }) {
  if (artworks.length === 0) {
    return <p className="mt-1 text-sm text-muted">Макет для этой позиции ещё не загружен.</p>;
  }
  return (
    <ul className="mt-2 space-y-2">
      {artworks.map((a) => (
        <li key={a.id}>
          <Link href={adminArtworkDetailPath(a.id)} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg px-3 py-2.5 hover:border-primary">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">v{a.version} · {a.file.filename}</p>
              <p className="mt-0.5 text-xs text-subtle">{humanFileType(a.file.mimeType)} · {formatFileSize(a.file.size)} · {formatArtworkDate(a.createdAt)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${artworkStatusBadge(a.status)}`}>{artworkStatusLabel(a.status)}</span>
              <ChevronRight size={16} className="text-muted" />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
