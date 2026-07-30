'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronRight, Layers, ShieldAlert } from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { tokenStorage } from '@/lib/api/auth';
import { getPricingDefinitions, type Paginated, type PricingDefinitionSummary } from '@/lib/api/admin-pricing';
import { pricingDefinitionPath } from '@/lib/admin/pricing-presentation';

const PAGE_SIZE = 20;

type State =
  | { status: 'loading' }
  | { status: 'ready'; page: Paginated<PricingDefinitionSummary> }
  | { status: 'unauthorized' }
  | { status: 'forbidden' }
  | { status: 'error'; message: string };

/** Список калькуляторов (definition) с версиями прайсов. */
export function PricingDefinitionsList() {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [page, setPage] = useState(1);

  const load = useCallback((targetPage: number) => {
    const token = tokenStorage.getAccessToken();
    if (!token) {
      setState({ status: 'unauthorized' });
      return;
    }
    setState({ status: 'loading' });
    getPricingDefinitions(token, { page: targetPage, pageSize: PAGE_SIZE })
      .then((result) => setState({ status: 'ready', page: result }))
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 403) return setState({ status: 'forbidden' });
        if (error instanceof ApiError && error.status === 401) return setState({ status: 'unauthorized' });
        setState({
          status: 'error',
          message: error instanceof ApiError ? error.message : 'Не удалось загрузить прайсы.',
        });
      });
  }, []);

  useEffect(() => {
    load(page);
  }, [load, page]);

  return (
    <div>
      <h2 className="mb-4 text-lg font-bold">Прайсы</h2>
      <Body state={state} page={page} onRetry={() => load(page)} onPage={setPage} />
    </div>
  );
}

function Body({
  state,
  page,
  onRetry,
  onPage,
}: {
  state: State;
  page: number;
  onRetry: () => void;
  onPage: (page: number) => void;
}) {
  if (state.status === 'loading') return <Skeleton />;

  if (state.status === 'forbidden') {
    return (
      <Notice icon={ShieldAlert} tone="danger" title="Нет доступа">
        У вашей учётной записи нет прав на просмотр прайсов.
      </Notice>
    );
  }
  if (state.status === 'unauthorized') {
    return (
      <Notice icon={ShieldAlert} tone="warning" title="Сессия истекла">
        Войдите заново, чтобы продолжить работу.
      </Notice>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="rounded-2xl border border-danger/40 bg-surface p-6 text-center">
        <AlertTriangle size={32} className="mx-auto text-danger" />
        <p className="mt-3 font-semibold">Не удалось загрузить прайсы</p>
        <p className="mt-1 text-sm text-muted">{state.message}</p>
        <button onClick={onRetry} className="mt-4 h-10 rounded-xl border border-border px-4 text-sm font-medium hover:border-primary hover:text-primary">
          Повторить
        </button>
      </div>
    );
  }

  const { items, total, pageSize } = state.page;
  if (items.length === 0) {
    return (
      <Notice icon={Layers} tone="muted" title="Калькуляторов нет">
        Пока нет ни одного калькулятора с прайсами.
      </Notice>
    );
  }
  const lastPage = Math.max(1, Math.ceil(total / (pageSize || PAGE_SIZE)));

  return (
    <>
      {/* Desktop — таблица */}
      <div className="hidden overflow-x-auto rounded-2xl border border-border md:block">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-subtle">
            <tr>
              <th className="px-4 py-3 font-semibold">Калькулятор</th>
              <th className="px-4 py-3 font-semibold">Версия</th>
              <th className="px-4 py-3 font-semibold">Статус</th>
              <th className="px-4 py-3 font-semibold">Прайсов</th>
              <th className="px-4 py-3 font-semibold">Режим</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.id} className="border-t border-border hover:bg-surface-2/40">
                <td className="px-4 py-3">
                  <Link href={pricingDefinitionPath(d.id)} className="font-semibold hover:text-primary">
                    {d.title}
                  </Link>
                  <div className="text-xs text-subtle">{d.code}</div>
                </td>
                <td className="px-4 py-3">v{d.version}</td>
                <td className="px-4 py-3">{d.status}</td>
                <td className="px-4 py-3">{d.priceListCount}</td>
                <td className="px-4 py-3">
                  <ModeBadge isDemo={d.isDemo} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={pricingDefinitionPath(d.id)} className="inline-flex text-primary" aria-label={`Открыть ${d.title}`}>
                    <ChevronRight size={18} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile — карточки */}
      <ul className="space-y-3 md:hidden">
        {items.map((d) => (
          <li key={d.id}>
            <Link href={pricingDefinitionPath(d.id)} className="block rounded-2xl border border-border bg-surface p-4 hover:border-primary">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{d.title}</p>
                  <p className="text-xs text-subtle">{d.code} · v{d.version}</p>
                </div>
                <ModeBadge isDemo={d.isDemo} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted">
                <span>{d.status}</span>
                <span>{d.priceListCount} прайс(ов)</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {lastPage > 1 && (
        <nav aria-label="Страницы" className="mt-5 flex items-center justify-between gap-3">
          <button onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1} className="h-10 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-40">
            Назад
          </button>
          <span className="text-sm text-muted">Страница {state.page.page} из {lastPage}</span>
          <button onClick={() => onPage(Math.min(lastPage, page + 1))} disabled={page >= lastPage} className="h-10 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-40">
            Вперёд
          </button>
        </nav>
      )}
    </>
  );
}

export function ModeBadge({ isDemo }: { isDemo: boolean }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${isDemo ? 'bg-warning/15 text-warning' : 'bg-primary/15 text-primary'}`}>
      {isDemo ? 'DEMO' : 'LIVE'}
    </span>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-2xl border border-border bg-surface" />
      ))}
    </div>
  );
}

function Notice({ icon: Icon, tone, title, children }: { icon: typeof Layers; tone: 'danger' | 'warning' | 'muted'; title: string; children: React.ReactNode }) {
  const color = tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-subtle';
  return (
    <div className="rounded-2xl border border-border bg-surface p-8 text-center">
      <Icon size={32} className={`mx-auto ${color}`} />
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{children}</p>
    </div>
  );
}
