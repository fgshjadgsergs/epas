'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronRight, ImageOff, Plus, Search, ShieldAlert } from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { tokenStorage } from '@/lib/api/auth';
import { getAdminCategories, getAdminServices, type AdminCategory, type AdminService } from '@/lib/api/admin-catalog';
import { formatCatalogDate } from './presentation';
import { ServiceCreateDialog } from './service-create-dialog';

type State =
  | { status: 'loading' }
  | { status: 'ready'; services: AdminService[]; categories: AdminCategory[] }
  | { status: 'forbidden' }
  | { status: 'unauthorized' }
  | { status: 'error'; message: string };

/** Список услуг: категория, статус, порядок, основное изображение, калькулятор. */
export function ServicesPanel() {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [creating, setCreating] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState<'' | 'active' | 'hidden'>('');
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    const token = tokenStorage.getAccessToken();
    if (!token) return setState({ status: 'unauthorized' });
    setState({ status: 'loading' });
    Promise.all([getAdminServices(token), getAdminCategories(token)])
      .then(([services, categories]) => setState({ status: 'ready', services, categories }))
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 403) return setState({ status: 'forbidden' });
        if (error instanceof ApiError && error.status === 401) return setState({ status: 'unauthorized' });
        setState({ status: 'error', message: error instanceof ApiError ? error.message : 'Не удалось загрузить услуги.' });
      });
  }, []);
  useEffect(() => load(), [load]);

  const filtered = useMemo(() => {
    if (state.status !== 'ready') return [];
    const q = search.trim().toLowerCase();
    return state.services.filter((s) => {
      if (categoryId && s.categoryId !== categoryId) return false;
      if (status === 'active' && !s.isActive) return false;
      if (status === 'hidden' && s.isActive) return false;
      if (q && !s.title.toLowerCase().includes(q) && !s.slug.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [state, categoryId, status, search]);

  if (state.status === 'loading') return <Skeleton />;
  if (state.status === 'unauthorized') return <Notice icon={ShieldAlert} title="Сессия истекла" text="Войдите заново, чтобы продолжить." />;
  if (state.status === 'forbidden') return <Notice icon={ShieldAlert} title="Нет доступа" text="Нужно право управления каталогом." />;
  if (state.status === 'error') {
    return (
      <div className="rounded-2xl border border-danger/40 bg-surface p-6 text-center">
        <AlertTriangle size={30} className="mx-auto text-danger" />
        <p className="mt-2 text-sm text-muted">{state.message}</p>
        <button onClick={load} className="mt-3 h-10 rounded-xl border border-border px-4 text-sm font-medium hover:border-primary hover:text-primary">Повторить</button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="grid gap-2 sm:grid-cols-3">
          <select aria-label="Категория" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={selectCls}>
            <option value="">Все категории</option>
            {state.categories.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <select aria-label="Статус" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={selectCls}>
            <option value="">Все статусы</option>
            <option value="active">Активные</option>
            <option value="hidden">Скрытые</option>
          </select>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
            <input aria-label="Поиск" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Название или slug" className={`${selectCls} pl-9`} />
          </div>
        </div>
        <button onClick={() => setCreating(true)} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary-hover">
          <Plus size={16} /> Услуга
        </button>
      </div>

      <p className="mb-3 text-sm text-muted">{filtered.length} из {state.services.length}</p>

      {filtered.length === 0 ? (
        <Notice icon={Search} title="Услуги не найдены" text="Измените фильтры или создайте новую услугу." />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border border-border md:block">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-subtle">
                <tr>
                  <th className="px-4 py-3 font-semibold">Услуга</th>
                  <th className="px-4 py-3 font-semibold">Категория</th>
                  <th className="px-4 py-3 font-semibold">Статус</th>
                  <th className="px-4 py-3 font-semibold">Порядок</th>
                  <th className="px-4 py-3 font-semibold">Калькулятор</th>
                  <th className="px-4 py-3 font-semibold">Обновлена</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Thumb service={s} />
                        <div className="min-w-0">
                          <Link href={servicePath(s.id)} className="font-medium hover:text-primary">{s.title}</Link>
                          <div className="text-xs text-subtle">{s.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{s.category.title}</td>
                    <td className="px-4 py-3"><StatusBadge active={s.isActive} /></td>
                    <td className="px-4 py-3">{s.sortOrder}</td>
                    <td className="px-4 py-3"><CalcBadge service={s} /></td>
                    <td className="px-4 py-3 text-xs text-subtle">{formatCatalogDate(s.updatedAt)}</td>
                    <td className="px-4 py-3 text-right"><Link href={servicePath(s.id)} aria-label="Открыть услугу" className="inline-flex text-primary"><ChevronRight size={18} /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {filtered.map((s) => (
              <li key={s.id}>
                <Link href={servicePath(s.id)} className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 hover:border-primary">
                  <Thumb service={s} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{s.title}</p>
                      <StatusBadge active={s.isActive} />
                    </div>
                    <p className="truncate text-xs text-subtle">{s.category.title} · {s.slug}</p>
                    <p className="mt-1 text-xs"><CalcBadge service={s} /></p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {creating && (
        <ServiceCreateDialog categories={state.categories} onClose={() => setCreating(false)} />
      )}
    </div>
  );
}

const selectCls = 'h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg focus:border-primary focus:outline-none';
const servicePath = (id: string) => `/admin/catalog/services/${encodeURIComponent(id)}/`;

function Thumb({ service }: { service: AdminService }) {
  const main = service.images.find((i) => i.isMain) ?? service.images[0];
  if (main?.url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={main.url} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-border object-cover" />;
  }
  return <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border bg-surface-2 text-subtle"><ImageOff size={16} /></span>;
}
function CalcBadge({ service }: { service: AdminService }) {
  return service.calculator
    ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Подключён</span>
    : <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">Нет</span>;
}
function StatusBadge({ active }: { active: boolean }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${active ? 'bg-success/15 text-success' : 'bg-surface-2 text-muted'}`}>{active ? 'Активна' : 'Скрыта'}</span>;
}
function Skeleton() {
  return <div className="space-y-3" aria-hidden>{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl border border-border bg-surface" />)}</div>;
}
function Notice({ icon: Icon, title, text }: { icon: typeof Search; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-8 text-center">
      <Icon size={30} className="mx-auto text-subtle" />
      <p className="mt-2 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{text}</p>
    </div>
  );
}
