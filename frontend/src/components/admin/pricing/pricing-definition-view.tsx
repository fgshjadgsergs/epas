'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Lock, ShieldAlert } from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { tokenStorage } from '@/lib/api/auth';
import { useAuth } from '@/lib/auth/auth-context';
import {
  clonePriceListDraft,
  createPriceList,
  getPriceLists,
  getPricingDefinition,
  type Paginated,
  type PriceListSummary,
  type PricingDefinitionDetail,
} from '@/lib/api/admin-pricing';
import { canEditPricing } from '@/lib/admin/access';
import { describePricingError } from '@/lib/admin/pricing-errors';
import {
  formatPricingDate,
  formatValidPeriod,
  priceListPath,
  priceStatusBadge,
  priceStatusLabel,
} from '@/lib/admin/pricing-presentation';
import { ModeBadge } from './pricing-definitions-list';

const PAGE_SIZE = 20;
const ADMIN_PRICING_PATH = '/admin/pricing/';

type State =
  | { status: 'loading' }
  | { status: 'ready'; definition: PricingDefinitionDetail; page: Paginated<PriceListSummary> }
  | { status: 'unauthorized' }
  | { status: 'forbidden' }
  | { status: 'notFound' }
  | { status: 'error'; message: string };

/** Definition read-only + история версий прайса с действием «Создать черновик». */
export function PricingDefinitionView({ definitionId }: { definitionId: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [page, setPage] = useState(1);
  const { permissions } = useAuth();
  const canEdit = canEditPricing(permissions);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [existingDraftId, setExistingDraftId] = useState<string | null>(null);
  const cloningRef = useRef(false);
  const [cloning, setCloning] = useState(false);

  const load = useCallback(
    (targetPage: number) => {
      const token = tokenStorage.getAccessToken();
      if (!token) {
        setState({ status: 'unauthorized' });
        return;
      }
      setState({ status: 'loading' });
      Promise.all([
        getPricingDefinition(definitionId, token),
        getPriceLists(definitionId, token, { page: targetPage, pageSize: PAGE_SIZE }),
      ])
        .then(([definition, priceLists]) => setState({ status: 'ready', definition, page: priceLists }))
        .catch((error: unknown) => {
          if (error instanceof ApiError && error.status === 403) return setState({ status: 'forbidden' });
          if (error instanceof ApiError && error.status === 401) return setState({ status: 'unauthorized' });
          if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
            return setState({ status: 'notFound' });
          }
          setState({ status: 'error', message: error instanceof ApiError ? error.message : 'Не удалось загрузить.' });
        });
    },
    [definitionId],
  );

  useEffect(() => {
    load(page);
  }, [load, page]);


  async function handleClone(priceListId: string) {
    if (cloningRef.current) return; // защита от двойного клика
    cloningRef.current = true;
    setCloning(true);
    setCloneError(null);
    setExistingDraftId(null);
    const token = tokenStorage.getAccessToken();
    if (!token) {
      setCloneError('Сессия истекла. Войдите заново.');
      cloningRef.current = false;
      setCloning(false);
      return;
    }
    try {
      const draft = await clonePriceListDraft(priceListId, token);
      router.push(priceListPath(draft.id));
    } catch (error) {
      const described = describePricingError(error);
      // Уже есть DRAFT — не создаём второй, показываем ссылку на него.
      const draftId = draftIdFromError(error);
      if (draftId) setExistingDraftId(draftId);
      setCloneError(
        draftId ? 'Для этого определения уже есть черновик — откройте его.' : described.message,
      );
      if (described.reload) load(page);
    } finally {
      cloningRef.current = false;
      setCloning(false);
    }
  }

  /** Создать НОВЫЙ пустой прайс (когда клонировать нечего — напр. у боевого
   *  определения ещё нет ни одного прайса). Далее — правила и публикация. */
  async function handleCreate() {
    if (cloningRef.current) return;
    cloningRef.current = true;
    setCloning(true);
    setCloneError(null);
    setExistingDraftId(null);
    const token = tokenStorage.getAccessToken();
    if (!token) {
      setCloneError('Сессия истекла. Войдите заново.');
      cloningRef.current = false;
      setCloning(false);
      return;
    }
    try {
      const draft = await createPriceList(definitionId, token);
      router.push(priceListPath(draft.id));
    } catch (error) {
      const described = describePricingError(error);
      const draftId = draftIdFromError(error);
      if (draftId) setExistingDraftId(draftId);
      setCloneError(
        draftId ? 'Для этого определения уже есть черновик — откройте его.' : described.message,
      );
      if (described.reload) load(page);
    } finally {
      cloningRef.current = false;
      setCloning(false);
    }
  }

  if (state.status === 'loading') return <Shell><Skeleton /></Shell>;
  if (state.status === 'unauthorized') return <Shell><Notice tone="warning" title="Сессия истекла">Войдите заново.</Notice></Shell>;
  if (state.status === 'forbidden') return <Shell><Notice tone="danger" title="Нет доступа">Нет прав на просмотр прайсов.</Notice></Shell>;
  if (state.status === 'notFound') return <Shell><Notice tone="muted" title="Не найдено">Калькулятор не найден.</Notice></Shell>;
  if (state.status === 'error') {
    return (
      <Shell>
        <Notice tone="danger" title="Ошибка загрузки">
          {state.message}{' '}
          <button onClick={() => load(page)} className="font-semibold text-primary underline">Повторить</button>
        </Notice>
      </Shell>
    );
  }

  const { definition, page: pricePage } = state;
  const hasDraft = pricePage.items.some((pl) => pl.status === 'DRAFT');
  const lastPage = Math.max(1, Math.ceil(pricePage.total / (pricePage.pageSize || PAGE_SIZE)));

  return (
    <Shell>
      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">{definition.title}</h2>
            <p className="text-sm text-subtle">{definition.code} · v{definition.version} · {definition.status}</p>
          </div>
          <ModeBadge isDemo={definition.isDemo} />
        </div>

        <details className="mt-4">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-muted">
            <Lock size={14} /> Параметры калькулятора (read-only)
          </summary>
          <div className="mt-3 space-y-2">
            {definition.parameters.map((p) => (
              <div key={p.urlKey} className="rounded-xl border border-border bg-bg px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{p.label}</span>
                  <span className="text-xs text-subtle">{p.urlKey} · {p.type}</span>
                </div>
                {p.options.length > 0 && (
                  <p className="mt-1 text-xs text-muted">
                    {p.options.filter((o) => o.isActive).map((o) => o.value).join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-subtle">
            Структура калькулятора меняется отдельным техническим процессом, не через этот интерфейс.
          </p>
        </details>
      </section>

      <section className="mt-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-semibold">Версии прайса</h3>
          {canEdit && !hasDraft && (
            <button
              onClick={handleCreate}
              disabled={cloning}
              className="h-9 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {cloning ? 'Создаём…' : 'Создать прайс'}
            </button>
          )}
        </div>

        {pricePage.items.length === 0 && (
          <p className="mb-3 rounded-xl border border-dashed border-border bg-bg px-3 py-4 text-sm text-muted">
            Прайсов пока нет. Нажмите «Создать прайс», добавьте тарифы (цена за штуку/лист, надбавки), проверьте и опубликуйте — цена станет публичной.
          </p>
        )}

        {cloneError && (
          <p role="alert" className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
            {cloneError}
            {existingDraftId && (
              <Link href={priceListPath(existingDraftId)} className="ml-2 font-semibold underline">Открыть черновик</Link>
            )}
          </p>
        )}

        <ul className="space-y-3">
          {pricePage.items.map((pl) => (
            <li key={pl.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={priceListPath(pl.id)} className="font-semibold hover:text-primary">
                      Версия {pl.version}
                    </Link>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priceStatusBadge(pl.status)}`}>
                      {priceStatusLabel(pl.status)}
                    </span>
                    <ModeBadge isDemo={pl.isDemo} />
                  </div>
                  <p className="mt-1 text-xs text-subtle">
                    {pl.currency} · {formatValidPeriod(pl.validFrom, pl.validTo)} · rev {pl.revision} · обновлён {formatPricingDate(pl.updatedAt)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {canEdit && (pl.status === 'ACTIVE' || pl.status === 'ARCHIVED') && (
                    <button
                      onClick={() => handleClone(pl.id)}
                      disabled={cloning || hasDraft}
                      title={hasDraft ? 'Уже есть черновик' : undefined}
                      className="h-9 rounded-xl border border-primary/40 px-3 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
                    >
                      {cloning ? 'Создаём…' : 'Создать черновик'}
                    </button>
                  )}
                  <Link href={priceListPath(pl.id)} className="h-9 rounded-xl border border-border px-3 text-sm font-medium leading-9 hover:border-primary hover:text-primary">
                    Открыть
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {lastPage > 1 && (
          <nav aria-label="Страницы версий" className="mt-4 flex items-center justify-between gap-3">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="h-10 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-40">
              Назад
            </button>
            <span className="text-sm text-muted">Страница {pricePage.page} из {lastPage}</span>
            <button onClick={() => setPage((p) => Math.min(lastPage, p + 1))} disabled={page >= lastPage} className="h-10 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-40">
              Вперёд
            </button>
          </nav>
        )}
      </section>
    </Shell>
  );
}

/** DRAFT id из тела ответа 409 PRICING_DRAFT_EXISTS. */
function draftIdFromError(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  const errs = error.errors as unknown;
  if (errs && typeof errs === 'object' && 'draftId' in errs) {
    const id = (errs as { draftId?: unknown }).draftId;
    return typeof id === 'string' ? id : null;
  }
  return null;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Link href={ADMIN_PRICING_PATH} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary">
        <ArrowLeft size={15} /> К списку прайсов
      </Link>
      {children}
    </div>
  );
}

function Skeleton() {
  return <div className="h-40 animate-pulse rounded-2xl border border-border bg-surface" aria-hidden />;
}

function Notice({ tone, title, children }: { tone: 'danger' | 'warning' | 'muted'; title: string; children: React.ReactNode }) {
  const color = tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-subtle';
  const Icon = tone === 'muted' ? AlertTriangle : ShieldAlert;
  return (
    <div className="rounded-2xl border border-border bg-surface p-8 text-center">
      <Icon size={32} className={`mx-auto ${color}`} />
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{children}</p>
    </div>
  );
}
