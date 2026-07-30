'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronRight, Search, ShieldAlert } from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { tokenStorage } from '@/lib/api/auth';
import { getAdminArtworks, type AdminArtworkListResponse, type AdminArtworksQuery } from '@/lib/api/admin-artworks';
import type { ArtworkStatus } from '@/lib/api/artworks';
import {
  adminArtworkDetailPath,
  artworkStatusBadge,
  artworkStatusLabel,
  formatArtworkDate,
  formatFileSize,
  humanFileType,
} from '@/lib/artworks/presentation';

const PAGE_SIZE = 20;
const STATUSES: ArtworkStatus[] = ['UPLOADED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'SUPERSEDED', 'WITHDRAWN'];
const SEARCH_DEBOUNCE_MS = 400;

type State =
  | { status: 'loading' }
  | { status: 'ready'; page: AdminArtworkListResponse }
  | { status: 'forbidden' }
  | { status: 'unauthorized' }
  | { status: 'error'; message: string };

interface Filters {
  page: number;
  status: ArtworkStatus | '';
  orderNumber: string;
  from: string;
  to: string;
}

function filtersFromParams(params: URLSearchParams): Filters {
  const rawStatus = params.get('status');
  const status = rawStatus && (STATUSES as string[]).includes(rawStatus) ? (rawStatus as ArtworkStatus) : '';
  const page = Number.parseInt(params.get('page') ?? '1', 10);
  return {
    page: Number.isFinite(page) && page >= 1 ? page : 1,
    status,
    orderNumber: params.get('orderNumber')?.trim() ?? '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
  };
}
function filtersToSearch(f: Filters): string {
  const p = new URLSearchParams();
  if (f.page > 1) p.set('page', String(f.page));
  if (f.status) p.set('status', f.status);
  if (f.orderNumber) p.set('orderNumber', f.orderNumber);
  if (f.from) p.set('from', f.from);
  if (f.to) p.set('to', f.to);
  const s = p.toString();
  return s ? `?${s}` : '';
}
function toQuery(f: Filters): AdminArtworksQuery {
  return {
    page: f.page,
    pageSize: PAGE_SIZE,
    status: f.status || undefined,
    orderNumber: f.orderNumber || undefined,
    from: f.from ? `${f.from}T00:00:00.000Z` : undefined,
    to: f.to ? `${f.to}T23:59:59.999Z` : undefined,
  };
}
const dateValid = (from: string, to: string) => !from || !to || from <= to;

/** Список макетов для менеджера. Фильтры (status/orderNumber/date/page) в URL. */
export function AdminArtworksList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchString = searchParams.toString();
  const filters = useMemo(() => filtersFromParams(new URLSearchParams(searchString)), [searchString]);
  const [state, setState] = useState<State>({ status: 'loading' });
  const [orderDraft, setOrderDraft] = useState(filters.orderNumber);
  useEffect(() => setOrderDraft(filters.orderNumber), [filters.orderNumber]);

  const valid = dateValid(filters.from, filters.to);
  const push = useCallback((next: Filters) => router.replace(`/admin/artworks/${filtersToSearch(next)}`, { scroll: false }), [router]);

  useEffect(() => {
    if (!valid) return;
    const token = tokenStorage.getAccessToken();
    if (!token) return setState({ status: 'unauthorized' });
    let cancelled = false;
    setState({ status: 'loading' });
    getAdminArtworks(token, toQuery(filters))
      .then((page) => !cancelled && setState({ status: 'ready', page }))
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 403) return setState({ status: 'forbidden' });
        if (error instanceof ApiError && error.status === 401) return setState({ status: 'unauthorized' });
        setState({ status: 'error', message: error instanceof ApiError ? error.message : 'Не удалось загрузить макеты.' });
      });
    return () => {
      cancelled = true;
    };
  }, [filters, valid]);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const onOrderInput = (value: string) => {
    setOrderDraft(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => push({ ...filters, orderNumber: value, page: 1 }), SEARCH_DEBOUNCE_MS);
  };

  return (
    <div>
      <h2 className="mb-4 text-lg font-bold">Макеты</h2>

      <form
        className="mb-5 grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          clearTimeout(debounceRef.current);
          push({ ...filters, orderNumber: orderDraft, page: 1 });
        }}
      >
        <label className="text-sm">
          <span className="mb-1 block text-muted">Статус</span>
          <select value={filters.status} onChange={(e) => push({ ...filters, status: e.target.value as Filters['status'], page: 1 })} className="h-10 w-full rounded-xl border border-border bg-bg px-3 text-fg focus:border-primary focus:outline-none">
            <option value="">Все</option>
            {STATUSES.map((s) => (<option key={s} value={s}>{artworkStatusLabel(s)}</option>))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Номер заказа</span>
          <div className="flex gap-2">
            <input value={orderDraft} onChange={(e) => onOrderInput(e.target.value)} placeholder="KP-…" className="h-10 w-full rounded-xl border border-border bg-bg px-3 text-fg focus:border-primary focus:outline-none" />
            <button type="submit" aria-label="Искать" className="grid h-10 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-fg hover:bg-primary-hover"><Search size={17} /></button>
          </div>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">С даты</span>
          <input type="date" value={filters.from} onChange={(e) => push({ ...filters, from: e.target.value, page: 1 })} aria-invalid={!valid || undefined} className="h-10 w-full rounded-xl border border-border bg-bg px-3 text-fg focus:border-primary focus:outline-none" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">По дату</span>
          <input type="date" value={filters.to} onChange={(e) => push({ ...filters, to: e.target.value, page: 1 })} aria-invalid={!valid || undefined} className="h-10 w-full rounded-xl border border-border bg-bg px-3 text-fg focus:border-primary focus:outline-none" />
        </label>
      </form>

      {!valid && <p role="alert" className="mb-4 rounded-xl bg-warning/10 px-3 py-2 text-sm text-warning">Начало периода позже конца — исправьте даты.</p>}

      <Body state={state} filters={filters} onRetry={() => push({ ...filters })} onPage={(page) => push({ ...filters, page })} />
    </div>
  );
}

function Body({ state, filters, onRetry, onPage }: { state: State; filters: Filters; onRetry: () => void; onPage: (page: number) => void }) {
  if (state.status === 'loading') return <Skeleton />;
  if (state.status === 'forbidden') return <Notice icon={ShieldAlert} tone="danger" title="Нет доступа">У вашей учётной записи нет прав на просмотр макетов.</Notice>;
  if (state.status === 'unauthorized') return <Notice icon={ShieldAlert} tone="warning" title="Сессия истекла">Войдите заново, чтобы продолжить.</Notice>;
  if (state.status === 'error') {
    return (
      <div className="rounded-2xl border border-danger/40 bg-surface p-6 text-center">
        <AlertTriangle size={32} className="mx-auto text-danger" />
        <p className="mt-3 font-semibold">Не удалось загрузить макеты</p>
        <p className="mt-1 text-sm text-muted">{state.message}</p>
        <button onClick={onRetry} className="mt-4 h-10 rounded-xl border border-border px-4 text-sm font-medium hover:border-primary hover:text-primary">Повторить</button>
      </div>
    );
  }

  const { items, total, pageSize } = state.page;
  if (items.length === 0) return <Notice icon={Search} tone="muted" title="Макеты не найдены">Измените фильтры или очистите поиск.</Notice>;
  const lastPage = Math.max(1, Math.ceil(total / (pageSize || PAGE_SIZE)));

  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl border border-border md:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-subtle">
            <tr>
              <th className="px-4 py-3 font-semibold">Заказ / позиция</th>
              <th className="px-4 py-3 font-semibold">Версия</th>
              <th className="px-4 py-3 font-semibold">Статус</th>
              <th className="px-4 py-3 font-semibold">Файл</th>
              <th className="px-4 py-3 font-semibold">Создан</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-t border-border hover:bg-surface-2/40">
                <td className="px-4 py-3">
                  <Link href={adminArtworkDetailPath(a.id)} className="font-semibold hover:text-primary">{a.orderNumber}</Link>
                  <div className="text-xs text-subtle">{a.itemTitle}</div>
                </td>
                <td className="px-4 py-3">v{a.version}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${artworkStatusBadge(a.status)}`}>{artworkStatusLabel(a.status)}</span></td>
                <td className="px-4 py-3"><span className="text-xs text-muted">{humanFileType(a.file.mimeType)} · {formatFileSize(a.file.size)}</span></td>
                <td className="px-4 py-3 text-xs text-subtle">{formatArtworkDate(a.createdAt)}</td>
                <td className="px-4 py-3 text-right"><Link href={adminArtworkDetailPath(a.id)} className="inline-flex text-primary" aria-label="Открыть макет"><ChevronRight size={18} /></Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {items.map((a) => (
          <li key={a.id}>
            <Link href={adminArtworkDetailPath(a.id)} className="block rounded-2xl border border-border bg-surface p-4 hover:border-primary">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{a.orderNumber}</p>
                  <p className="truncate text-xs text-subtle">{a.itemTitle}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${artworkStatusBadge(a.status)}`}>{artworkStatusLabel(a.status)}</span>
              </div>
              <p className="mt-2 text-xs text-muted">v{a.version} · {humanFileType(a.file.mimeType)} · {formatFileSize(a.file.size)}</p>
              <p className="mt-0.5 text-xs text-subtle">{formatArtworkDate(a.createdAt)}</p>
            </Link>
          </li>
        ))}
      </ul>

      {lastPage > 1 && (
        <nav aria-label="Страницы" className="mt-5 flex items-center justify-between gap-3">
          <button onClick={() => onPage(Math.max(1, filters.page - 1))} disabled={filters.page <= 1} className="h-10 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-40">Назад</button>
          <span className="text-sm text-muted">Страница {state.page.page} из {lastPage}</span>
          <button onClick={() => onPage(Math.min(lastPage, filters.page + 1))} disabled={filters.page >= lastPage} className="h-10 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-40">Вперёд</button>
        </nav>
      )}
    </>
  );
}

function Skeleton() {
  return <div className="space-y-3" aria-hidden>{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl border border-border bg-surface" />)}</div>;
}
function Notice({ icon: Icon, tone, title, children }: { icon: typeof Search; tone: 'danger' | 'warning' | 'muted'; title: string; children: React.ReactNode }) {
  const color = tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-subtle';
  return (
    <div className="rounded-2xl border border-border bg-surface p-8 text-center">
      <Icon size={32} className={`mx-auto ${color}`} />
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{children}</p>
    </div>
  );
}
