'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronRight, Info, Search, ShieldAlert } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { ApiError } from '@/lib/api/client';
import { tokenStorage } from '@/lib/api/auth';
import { queryAdminOrders, type AdminOrderListDto } from '@/lib/api/admin-orders';
import {
  ADMIN_ORDERS_PAGE_SIZE,
  EMPTY_CONTACT_SEARCH,
  filtersFromParams,
  filtersToQuery,
  filtersToSearch,
  isDateRangeValid,
  type AdminOrdersFilters,
  type ContactSearch,
} from '@/lib/admin/order-filters';
import { adminOrderDetailPath, adminStatusBadge, adminStatusLabel, formatAdminDate } from '@/lib/admin/presentation';
import { rememberListSearch } from '@/lib/admin/last-list-search';
import { DEMO_PRICING_NOTICE, showDemoPricingNotice } from '@/lib/demo-pricing';

const rub = (amountMinor: number) => formatPrice(amountMinor / 100);
const SEARCH_DEBOUNCE_MS = 400;

type ListState =
  | { status: 'loading' }
  | { status: 'ready'; page: AdminOrderListDto }
  | { status: 'forbidden' }
  | { status: 'unauthorized' }
  | { status: 'error'; message: string };

/**
 * Список заказов админки.
 *
 * Безопасные фильтры (status, даты, номер заказа, страница) живут в URL —
 * ссылку можно открыть повторно. Поиск по телефону и email — персональные
 * данные клиента — хранится ТОЛЬКО в локальном состоянии формы и НЕ попадает
 * ни в URL, ни в sessionStorage, ни в access-логи. Текстовый поиск идёт с
 * debounce (не бьём по API на каждый символ). Сортировка createdAt desc — на
 * backend.
 */
export function AdminOrdersList() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL — источник истины для безопасных фильтров; из него грузим данные.
  const searchString = searchParams.toString();
  const filters = useMemo(() => filtersFromParams(new URLSearchParams(searchString)), [searchString]);

  // Запоминаем только безопасные фильтры (rememberListSearch вырежет контакты).
  useEffect(() => {
    rememberListSearch(searchString ? `?${searchString}` : '');
  }, [searchString]);

  const [state, setState] = useState<ListState>({ status: 'loading' });

  // Черновик номера заказа: применяется в URL с debounce/по кнопке.
  const [orderNumberDraft, setOrderNumberDraft] = useState(filters.orderNumber);
  useEffect(() => setOrderNumberDraft(filters.orderNumber), [filters.orderNumber]);

  // Контактный поиск: черновик (ввод) и применённое значение (в запросе).
  // НИКОГДА не сериализуется в URL/sessionStorage — только в памяти формы.
  const [contactDraft, setContactDraft] = useState<ContactSearch>(EMPTY_CONTACT_SEARCH);
  const [contacts, setContacts] = useState<ContactSearch>(EMPTY_CONTACT_SEARCH);

  const dateValid = isDateRangeValid(filters.from, filters.to);

  const pushFilters = useCallback(
    (next: AdminOrdersFilters) => {
      router.replace(`/admin/orders/${filtersToSearch(next)}`, { scroll: false });
    },
    [router],
  );

  // Загрузка списка по URL-фильтрам + приватному контактному поиску.
  useEffect(() => {
    if (!dateValid) return; // некорректный диапазон — запрос не шлём
    const token = tokenStorage.getAccessToken();
    if (!token) {
      setState({ status: 'unauthorized' });
      return;
    }

    let cancelled = false;
    setState({ status: 'loading' });
    // queryAdminOrders сам выберет POST search при телефоне/email, иначе GET —
    // персональные данные не попадают в query string.
    queryAdminOrders(token, filtersToQuery(filters, contacts))
      .then((page) => {
        if (!cancelled) setState({ status: 'ready', page });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 403) return setState({ status: 'forbidden' });
        if (error instanceof ApiError && error.status === 401) return setState({ status: 'unauthorized' });
        setState({
          status: 'error',
          message: error instanceof ApiError ? error.message : 'Не удалось загрузить заказы.',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [filters, contacts, dateValid]);

  const urlDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const contactDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Номер заказа безопасен → уходит в URL с debounce (page сбрасывается).
  const scheduleOrderNumber = useCallback(
    (value: string) => {
      setOrderNumberDraft(value);
      clearTimeout(urlDebounceRef.current);
      urlDebounceRef.current = setTimeout(() => {
        pushFilters({ ...filters, orderNumber: value, page: 1 });
      }, SEARCH_DEBOUNCE_MS);
    },
    [filters, pushFilters],
  );

  // Применить контактный поиск локально (не в URL); сброс страницы на первую.
  const applyContacts = useCallback(
    (next: ContactSearch) => {
      setContacts(next);
      if (filters.page !== 1) pushFilters({ ...filters, page: 1 });
    },
    [filters, pushFilters],
  );

  // Контакты (телефон/email) обновляются только в локальном состоянии.
  const scheduleContacts = useCallback(
    (patch: Partial<ContactSearch>) => {
      setContactDraft((prev) => {
        const next = { ...prev, ...patch };
        clearTimeout(contactDebounceRef.current);
        contactDebounceRef.current = setTimeout(() => applyContacts(next), SEARCH_DEBOUNCE_MS);
        return next;
      });
    },
    [applyContacts],
  );

  // Кнопка «Искать»: номер → URL, контакты → локально, немедленно.
  const applySearchNow = useCallback(() => {
    clearTimeout(urlDebounceRef.current);
    clearTimeout(contactDebounceRef.current);
    setContacts(contactDraft);
    pushFilters({ ...filters, orderNumber: orderNumberDraft, page: 1 });
  }, [contactDraft, orderNumberDraft, filters, pushFilters]);

  return (
    <div>
      <h2 className="mb-4 text-lg font-bold">Заказы</h2>

      <Filters
        filters={filters}
        orderNumberDraft={orderNumberDraft}
        contactDraft={contactDraft}
        dateValid={dateValid}
        onStatus={(status) => pushFilters({ ...filters, status, page: 1 })}
        onDate={(field, value) => pushFilters({ ...filters, [field]: value, page: 1 })}
        onOrderNumber={scheduleOrderNumber}
        onContact={scheduleContacts}
        onSearchSubmit={applySearchNow}
      />

      {!dateValid && (
        <p role="alert" className="mb-4 rounded-xl bg-warning/10 px-3 py-2 text-sm text-warning">
          Начало периода позже конца — исправьте даты.
        </p>
      )}

      <ListBody state={state} onRetry={() => pushFilters({ ...filters })} filters={filters} onPage={(page) => pushFilters({ ...filters, page })} />
    </div>
  );
}

function Filters({
  filters,
  orderNumberDraft,
  contactDraft,
  dateValid,
  onStatus,
  onDate,
  onOrderNumber,
  onContact,
  onSearchSubmit,
}: {
  filters: AdminOrdersFilters;
  orderNumberDraft: string;
  contactDraft: ContactSearch;
  dateValid: boolean;
  onStatus: (status: AdminOrdersFilters['status']) => void;
  onDate: (field: 'from' | 'to', value: string) => void;
  onOrderNumber: (value: string) => void;
  onContact: (patch: Partial<ContactSearch>) => void;
  onSearchSubmit: () => void;
}) {
  return (
    <form
      className="mb-5 grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSearchSubmit();
      }}
      // autocomplete off: не сохраняем чужие контакты в истории браузера.
      autoComplete="off"
    >
      <label className="text-sm">
        <span className="mb-1 block text-muted">Статус</span>
        <select
          value={filters.status}
          onChange={(e) => onStatus(e.target.value as AdminOrdersFilters['status'])}
          className="h-10 w-full rounded-xl border border-border bg-bg px-3 text-fg focus:border-primary focus:outline-none"
        >
          <option value="">Все</option>
          <option value="NEW">Принят</option>
          <option value="CANCELLED">Отменён</option>
        </select>
      </label>

      <label className="text-sm">
        <span className="mb-1 block text-muted">С даты</span>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => onDate('from', e.target.value)}
          aria-invalid={!dateValid || undefined}
          className="h-10 w-full rounded-xl border border-border bg-bg px-3 text-fg focus:border-primary focus:outline-none"
        />
      </label>

      <label className="text-sm">
        <span className="mb-1 block text-muted">По дату</span>
        <input
          type="date"
          value={filters.to}
          onChange={(e) => onDate('to', e.target.value)}
          aria-invalid={!dateValid || undefined}
          className="h-10 w-full rounded-xl border border-border bg-bg px-3 text-fg focus:border-primary focus:outline-none"
        />
      </label>

      <label className="text-sm">
        <span className="mb-1 block text-muted">Номер заказа</span>
        <input
          value={orderNumberDraft}
          onChange={(e) => onOrderNumber(e.target.value)}
          placeholder="KP-…"
          className="h-10 w-full rounded-xl border border-border bg-bg px-3 text-fg focus:border-primary focus:outline-none"
        />
      </label>

      <label className="text-sm">
        {/* Телефон и email не уходят в URL — только приватный поиск в памяти формы. */}
        <span className="mb-1 block text-muted">Телефон</span>
        <input
          value={contactDraft.phone}
          onChange={(e) => onContact({ phone: e.target.value })}
          inputMode="tel"
          placeholder="900…"
          className="h-10 w-full rounded-xl border border-border bg-bg px-3 text-fg focus:border-primary focus:outline-none"
        />
      </label>

      <label className="text-sm">
        <span className="mb-1 block text-muted">E-mail</span>
        <div className="flex gap-2">
          <input
            value={contactDraft.email}
            onChange={(e) => onContact({ email: e.target.value })}
            inputMode="email"
            placeholder="mail@…"
            className="h-10 w-full rounded-xl border border-border bg-bg px-3 text-fg focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Искать"
            className="grid h-10 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-fg hover:bg-primary-hover"
          >
            <Search size={17} />
          </button>
        </div>
      </label>
    </form>
  );
}

function ListBody({
  state,
  filters,
  onRetry,
  onPage,
}: {
  state: ListState;
  filters: AdminOrdersFilters;
  onRetry: () => void;
  onPage: (page: number) => void;
}) {
  if (state.status === 'loading') {
    return <ListSkeleton />;
  }

  if (state.status === 'forbidden') {
    return (
      <Notice icon={ShieldAlert} tone="danger" title="Нет доступа">
        У вашей учётной записи нет прав на просмотр заказов.
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
        <p className="mt-3 font-semibold">Не удалось загрузить заказы</p>
        <p className="mt-1 text-sm text-muted">{state.message}</p>
        <button
          onClick={onRetry}
          className="mt-4 inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm font-medium hover:border-primary hover:text-primary"
        >
          Повторить
        </button>
      </div>
    );
  }

  const { items, total, pageSize } = state.page;
  if (items.length === 0) {
    return (
      <Notice icon={Search} tone="muted" title="Заказы не найдены">
        Измените фильтры или очистите поиск.
      </Notice>
    );
  }

  const lastPage = Math.max(1, Math.ceil(total / (pageSize || ADMIN_ORDERS_PAGE_SIZE)));

  return (
    <>
      {/* Десктоп — таблица; мобильный — карточки (та же разметка данных). */}
      <div className="hidden overflow-x-auto rounded-2xl border border-border md:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-subtle">
            <tr>
              <th className="px-4 py-3 font-semibold">Заказ</th>
              <th className="px-4 py-3 font-semibold">Клиент</th>
              <th className="px-4 py-3 font-semibold">Статус</th>
              <th className="px-4 py-3 font-semibold">Позиций</th>
              <th className="px-4 py-3 text-right font-semibold">Сумма</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((o) => (
              <tr key={o.id} className="border-t border-border hover:bg-surface-2/40">
                <td className="px-4 py-3">
                  <Link href={adminOrderDetailPath(o.id)} className="font-semibold hover:text-primary">
                    {o.orderNumber}
                  </Link>
                  <div className="text-xs text-subtle">{formatAdminDate(o.createdAt)}</div>
                </td>
                <td className="px-4 py-3">{o.contactName}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={o.status} />
                  {showDemoPricingNotice(o.pricingMode) && <DemoTag />}
                </td>
                <td className="px-4 py-3">{o.itemCount}</td>
                <td className="px-4 py-3 text-right font-semibold">
                  {rub(o.total.amountMinor)}
                  <span className="ml-1 text-xs font-normal text-subtle">{o.total.currency}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={adminOrderDetailPath(o.id)} className="inline-flex text-primary" aria-label="Открыть заказ">
                    <ChevronRight size={18} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {items.map((o) => (
          <li key={o.id}>
            <Link href={adminOrderDetailPath(o.id)} className="block rounded-2xl border border-border bg-surface p-4 hover:border-primary">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{o.orderNumber}</p>
                  <p className="text-xs text-subtle">{formatAdminDate(o.createdAt)}</p>
                </div>
                <StatusBadge status={o.status} />
              </div>
              <p className="mt-2 text-sm text-muted">{o.contactName}</p>
              {showDemoPricingNotice(o.pricingMode) && <DemoTag />}
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <span className="text-xs text-subtle">{o.itemCount} поз.</span>
                <span className="font-bold">
                  {rub(o.total.amountMinor)} <span className="text-xs font-normal text-subtle">{o.total.currency}</span>
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {lastPage > 1 && (
        <nav aria-label="Страницы" className="mt-5 flex items-center justify-between gap-3">
          <button
            onClick={() => onPage(Math.max(1, filters.page - 1))}
            disabled={filters.page <= 1}
            className="h-10 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-40"
          >
            Назад
          </button>
          <span className="text-sm text-muted">
            Страница {state.page.page} из {lastPage}
          </span>
          <button
            onClick={() => onPage(Math.min(lastPage, filters.page + 1))}
            disabled={filters.page >= lastPage}
            className="h-10 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-40"
          >
            Вперёд
          </button>
        </nav>
      )}
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${adminStatusBadge(status)}`}>
      {adminStatusLabel(status)}
    </span>
  );
}

function DemoTag() {
  return (
    <span className="mt-1 flex items-center gap-1 text-[11px] text-warning" title={DEMO_PRICING_NOTICE}>
      <Info size={11} /> демо-прайс
    </span>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl border border-border bg-surface" />
      ))}
    </div>
  );
}

function Notice({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: typeof Search;
  tone: 'danger' | 'warning' | 'muted';
  title: string;
  children: React.ReactNode;
}) {
  const color = tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-subtle';
  return (
    <div className="rounded-2xl border border-border bg-surface p-8 text-center">
      <Icon size={32} className={`mx-auto ${color}`} />
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{children}</p>
    </div>
  );
}
