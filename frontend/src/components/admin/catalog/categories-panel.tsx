'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, FolderTree, Pencil, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { tokenStorage } from '@/lib/api/auth';
import {
  deleteAdminCategory,
  getAdminCategories,
  updateAdminCategory,
  type AdminCategory,
} from '@/lib/api/admin-catalog';
import { describeCatalogError } from '@/lib/catalog/errors';
import { revalidateCatalog } from '@/lib/catalog/revalidate';
import { CategoryForm } from './category-form';
import { formatCatalogDate } from './presentation';

type State =
  | { status: 'loading' }
  | { status: 'ready'; items: AdminCategory[] }
  | { status: 'forbidden' }
  | { status: 'unauthorized' }
  | { status: 'error'; message: string };

/** Список категорий: активность, порядок, число услуг; создание/правка/удаление. */
export function CategoriesPanel() {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [editing, setEditing] = useState<AdminCategory | 'new' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    const token = tokenStorage.getAccessToken();
    if (!token) return setState({ status: 'unauthorized' });
    setState({ status: 'loading' });
    getAdminCategories(token)
      .then((items) => setState({ status: 'ready', items }))
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 403) return setState({ status: 'forbidden' });
        if (error instanceof ApiError && error.status === 401) return setState({ status: 'unauthorized' });
        setState({ status: 'error', message: error instanceof ApiError ? error.message : 'Не удалось загрузить категории.' });
      });
  }, []);
  useEffect(() => load(), [load]);

  async function toggleActive(cat: AdminCategory) {
    const token = tokenStorage.getAccessToken();
    if (!token) return;
    setActionError(null);
    setBusyId(cat.id);
    try {
      await updateAdminCategory(cat.id, { isActive: !cat.isActive }, token);
      await revalidateCatalog(token);
      load();
    } catch (err) {
      const d = describeCatalogError(err);
      setActionError(d.message);
      if (d.reload) load();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(cat: AdminCategory) {
    const token = tokenStorage.getAccessToken();
    if (!token) return;
    if (!window.confirm(`Удалить категорию «${cat.title}»? Действие необратимо.`)) return;
    setActionError(null);
    setBusyId(cat.id);
    try {
      await deleteAdminCategory(cat.id, token);
      await revalidateCatalog(token);
      load();
    } catch (err) {
      const d = describeCatalogError(err);
      setActionError(d.message);
      if (d.reload) load();
    } finally {
      setBusyId(null);
    }
  }

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
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">{state.items.length} категорий</p>
        <button onClick={() => { setActionError(null); setEditing('new'); }} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary-hover">
          <Plus size={16} /> Категория
        </button>
      </div>

      {actionError && <p role="alert" className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{actionError}</p>}

      {state.items.length === 0 ? (
        <Notice icon={FolderTree} title="Категорий пока нет" text="Создайте первую категорию каталога." />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border border-border md:block">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-subtle">
                <tr>
                  <th className="px-4 py-3 font-semibold">Название</th>
                  <th className="px-4 py-3 font-semibold">Slug</th>
                  <th className="px-4 py-3 font-semibold">Статус</th>
                  <th className="px-4 py-3 font-semibold">Порядок</th>
                  <th className="px-4 py-3 font-semibold">Услуг</th>
                  <th className="px-4 py-3 font-semibold">Обновлена</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {state.items.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{c.title}</td>
                    <td className="px-4 py-3 text-muted">{c.slug}</td>
                    <td className="px-4 py-3"><StatusBadge active={c.isActive} /></td>
                    <td className="px-4 py-3">{c.sortOrder}</td>
                    <td className="px-4 py-3">{c.serviceCount}</td>
                    <td className="px-4 py-3 text-xs text-subtle">{formatCatalogDate(c.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <RowActions cat={c} busy={busyId === c.id} onEdit={() => { setActionError(null); setEditing(c); }} onToggle={() => toggleActive(c)} onDelete={() => remove(c)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {state.items.map((c) => (
              <li key={c.id} className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{c.title}</p>
                    <p className="truncate text-xs text-subtle">{c.slug} · порядок {c.sortOrder} · услуг {c.serviceCount}</p>
                  </div>
                  <StatusBadge active={c.isActive} />
                </div>
                <div className="mt-3">
                  <RowActions cat={c} busy={busyId === c.id} onEdit={() => { setActionError(null); setEditing(c); }} onToggle={() => toggleActive(c)} onDelete={() => remove(c)} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {editing && (
        <CategoryForm
          category={editing === 'new' ? null : editing}
          categories={state.items}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function RowActions({ cat, busy, onEdit, onToggle, onDelete }: { cat: AdminCategory; busy: boolean; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  const canDelete = cat.serviceCount === 0 && cat.childrenCount === 0;
  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={onEdit} disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-medium hover:border-primary hover:text-primary disabled:opacity-50">
        <Pencil size={14} /> Изменить
      </button>
      <button onClick={onToggle} disabled={busy} className="inline-flex h-9 items-center rounded-xl border border-border px-3 text-sm font-medium hover:border-primary hover:text-primary disabled:opacity-50">
        {cat.isActive ? 'Скрыть' : 'Активировать'}
      </button>
      <button
        onClick={onDelete}
        disabled={busy || !canDelete}
        title={canDelete ? undefined : 'Нельзя удалить: есть услуги или подкатегории. Скройте её.'}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-medium hover:border-danger hover:text-danger disabled:opacity-40"
      >
        <Trash2 size={14} /> Удалить
      </button>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${active ? 'bg-success/15 text-success' : 'bg-surface-2 text-muted'}`}>
      {active ? 'Активна' : 'Скрыта'}
    </span>
  );
}

function Skeleton() {
  return <div className="space-y-3" aria-hidden>{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-2xl border border-border bg-surface" />)}</div>;
}
function Notice({ icon: Icon, title, text }: { icon: typeof AlertTriangle; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-8 text-center">
      <Icon size={30} className="mx-auto text-subtle" />
      <p className="mt-2 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{text}</p>
    </div>
  );
}
