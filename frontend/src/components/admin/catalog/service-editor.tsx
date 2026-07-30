'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Calculator, ExternalLink, ShieldAlert } from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { tokenStorage } from '@/lib/api/auth';
import {
  getAdminCategories,
  getAdminService,
  updateAdminService,
  type AdminCategory,
  type AdminService,
} from '@/lib/api/admin-catalog';
import { describeCatalogError } from '@/lib/catalog/errors';
import { revalidateCatalog } from '@/lib/catalog/revalidate';
import { isValidSlug } from '@/lib/catalog/slug';
import { ServiceImagesManager } from './service-images-manager';

const LIST_PATH = '/admin/catalog/?tab=services';

type State =
  | { status: 'loading' }
  | { status: 'ready'; service: AdminService; categories: AdminCategory[] }
  | { status: 'forbidden' }
  | { status: 'unauthorized' }
  | { status: 'notFound' }
  | { status: 'error'; message: string };

interface Form {
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  categoryId: string;
  sortOrder: string;
  isActive: boolean;
}

function toForm(s: AdminService): Form {
  return {
    title: s.title,
    slug: s.slug,
    shortDescription: s.shortDescription ?? '',
    description: s.description ?? '',
    categoryId: s.categoryId,
    sortOrder: String(s.sortOrder),
    isActive: s.isActive,
  };
}

/**
 * Редактор услуги: разделённые секции (Основное, Контент, Категория/порядок,
 * Изображения, Калькулятор read-only). Цена/калькулятор здесь не редактируются.
 * Правка контента не трогает CalculatorDefinition/PriceList/снимки заказов.
 */
export function ServiceEditor({ serviceId }: { serviceId: string }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const load = useCallback(() => {
    const token = tokenStorage.getAccessToken();
    if (!token) return setState({ status: 'unauthorized' });
    setState({ status: 'loading' });
    Promise.all([getAdminService(serviceId, token), getAdminCategories(token)])
      .then(([service, categories]) => {
        setState({ status: 'ready', service, categories });
        setForm(toForm(service));
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) return setState({ status: 'forbidden' });
        if (err instanceof ApiError && err.status === 401) return setState({ status: 'unauthorized' });
        if (err instanceof ApiError && err.status === 404) return setState({ status: 'notFound' });
        setState({ status: 'error', message: err instanceof ApiError ? err.message : 'Не удалось загрузить услугу.' });
      });
  }, [serviceId]);
  useEffect(() => load(), [load]);

  if (state.status === 'loading') return <Shell><p role="status" className="text-muted">Загружаем услугу…</p></Shell>;
  if (state.status === 'unauthorized') return <Shell><Notice icon={ShieldAlert} title="Сессия истекла" text="Войдите заново, чтобы продолжить." /></Shell>;
  if (state.status === 'forbidden') return <Shell><Notice icon={ShieldAlert} title="Нет доступа" text="Нужно право управления каталогом." /></Shell>;
  if (state.status === 'notFound') return <Shell><Notice icon={AlertTriangle} title="Услуга не найдена" text="Возможно, она была удалена." /></Shell>;
  if (state.status === 'error') {
    return <Shell><div className="rounded-2xl border border-danger/40 bg-surface p-6 text-center"><AlertTriangle size={30} className="mx-auto text-danger" /><p className="mt-2 text-sm text-muted">{state.message}</p><button onClick={load} className="mt-3 h-10 rounded-xl border border-border px-4 text-sm font-medium hover:border-primary hover:text-primary">Повторить</button></div></Shell>;
  }
  if (!form) return null;

  const { service, categories } = state;
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));

  const slugValid = form.slug !== '' && isValidSlug(form.slug);
  const slugChanged = form.slug !== service.slug;
  const dirty =
    form.title !== service.title || form.slug !== service.slug || form.shortDescription !== (service.shortDescription ?? '') ||
    form.description !== (service.description ?? '') || form.categoryId !== service.categoryId ||
    Number(form.sortOrder) !== service.sortOrder || form.isActive !== service.isActive;
  const canSave = form.title.trim() !== '' && slugValid && dirty && !saving;

  async function save() {
    if (savingRef.current || !canSave || !form) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    const token = tokenStorage.getAccessToken();
    if (!token) { setError('Сессия истекла.'); savingRef.current = false; setSaving(false); return; }
    try {
      await updateAdminService(serviceId, {
        title: form.title.trim(),
        slug: form.slug.trim(),
        shortDescription: form.shortDescription.trim() || null,
        description: form.description.trim() || null,
        categoryId: form.categoryId,
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
      }, token);
      await revalidateCatalog(token);
      load();
    } catch (err) {
      const d = describeCatalogError(err);
      setError(d.message);
      if (d.reload) load();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <Shell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{service.title}</h2>
          <p className="text-sm text-subtle">{service.category.title} · /{service.slug}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${service.isActive ? 'bg-success/15 text-success' : 'bg-surface-2 text-muted'}`}>
          {service.isActive ? 'Активна' : 'Скрыта'}
        </span>
      </div>

      {error && <p role="alert" className="mt-4 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="mt-4 space-y-4">
        <Section title="Основное">
          <Field label="Название"><input value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={200} className={inputCls} /></Field>
          <Field label="Slug (адрес)">
            <input value={form.slug} onChange={(e) => set('slug', e.target.value)} maxLength={150} aria-invalid={form.slug !== '' && !slugValid} className={inputCls} />
            {form.slug !== '' && !slugValid && <Hint tone="danger">Только строчная латиница, цифры и дефисы.</Hint>}
            {slugChanged && slugValid && <Hint tone="warning">Изменится публичный адрес страницы. Старый URL перестанет открываться — перенаправление не настраивается.</Hint>}
          </Field>
        </Section>

        <Section title="Контент">
          <Field label="Краткое описание"><textarea value={form.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} rows={2} className={areaCls} /></Field>
          <Field label="Описание"><textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={5} className={areaCls} /></Field>
        </Section>

        <Section title="Категория и порядок">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Категория">
              <select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} className={inputCls}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </Field>
            <Field label="Порядок"><input type="number" min={0} value={form.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} className={inputCls} /></Field>
          </div>
          <label className="mt-1 inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="h-4 w-4" />
            Активна (видна на сайте)
          </label>
        </Section>

        <div className="sticky bottom-0 flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
          {dirty ? <span className="text-xs text-warning">Есть несохранённые изменения</span> : <span className="text-xs text-muted">Все изменения сохранены</span>}
          <div className="flex gap-2">
            <button onClick={() => setForm(toForm(service))} disabled={!dirty || saving} className="h-10 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-50">Сбросить</button>
            <button onClick={save} disabled={!canSave} className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary-hover disabled:opacity-50">
              {saving ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        </div>

        <Section title="Изображения">
          <ServiceImagesManager service={service} onChanged={load} />
        </Section>

        <Section title="Калькулятор">
          {service.calculator ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-bg p-3">
              <p className="flex items-center gap-2 text-sm"><Calculator size={16} className="text-primary" /> Калькулятор подключён: <span className="font-medium">{service.calculator.title}</span></p>
              <Link href={`/admin/pricing/${encodeURIComponent(service.calculator.definitionId)}/`} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-medium hover:border-primary hover:text-primary">
                <ExternalLink size={14} /> Управление прайсом
              </Link>
            </div>
          ) : (
            <p className="rounded-xl border border-border bg-bg p-3 text-sm text-muted">Калькулятор не подключён.</p>
          )}
          <p className="mt-2 text-xs text-subtle">Цена и параметры калькулятора настраиваются в разделе «Прайсы», не здесь.</p>
        </Section>
      </div>
    </Shell>
  );
}

const inputCls = 'h-10 w-full rounded-xl border border-border bg-bg px-3 text-fg focus:border-primary focus:outline-none';
const areaCls = 'w-full rounded-xl border border-border bg-bg px-3 py-2 text-fg focus:border-primary focus:outline-none';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h3 className="mb-3 font-semibold">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm"><span className="mb-1 block text-muted">{label}</span>{children}</label>;
}
function Hint({ tone, children }: { tone: 'danger' | 'warning'; children: React.ReactNode }) {
  return <span className={`mt-1 flex items-start gap-1 text-xs ${tone === 'danger' ? 'text-danger' : 'text-warning'}`}><AlertTriangle size={12} className="mt-0.5 shrink-0" /> {children}</span>;
}
function Notice({ icon: Icon, title, text }: { icon: typeof AlertTriangle; title: string; text: string }) {
  return <div className="rounded-2xl border border-border bg-surface p-8 text-center"><Icon size={30} className="mx-auto text-subtle" /><p className="mt-2 font-semibold">{title}</p><p className="mt-1 text-sm text-muted">{text}</p></div>;
}
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Link href={LIST_PATH} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary"><ArrowLeft size={15} /> К списку услуг</Link>
      {children}
    </div>
  );
}
