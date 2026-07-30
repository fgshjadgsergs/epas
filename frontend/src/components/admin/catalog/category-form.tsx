'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { tokenStorage } from '@/lib/api/auth';
import {
  createAdminCategory,
  updateAdminCategory,
  type AdminCategory,
} from '@/lib/api/admin-catalog';
import { describeCatalogError } from '@/lib/catalog/errors';
import { revalidateCatalog } from '@/lib/catalog/revalidate';
import { isValidSlug, slugify } from '@/lib/catalog/slug';

/**
 * Drawer создания/правки категории. Реальные поля модели: title, slug,
 * description, sortOrder, isActive, parentId. Slug для новой категории
 * предлагается из названия; при правке существующего slug — предупреждение об
 * изменении публичного адреса (redirect backend не делает — не обещаем его).
 */
export function CategoryForm({
  category,
  categories,
  onClose,
  onSaved,
}: {
  category: AdminCategory | null;
  categories: AdminCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = category === null;
  const [title, setTitle] = useState(category?.title ?? '');
  const [slug, setSlug] = useState(category?.slug ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [parentId, setParentId] = useState(category?.parentId ?? '');
  const [sortOrder, setSortOrder] = useState(String(category?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // Для новой категории slug следует за названием, пока его не правили вручную.
  useEffect(() => {
    if (isNew && !slugTouched) setSlug(slugify(title));
  }, [title, isNew, slugTouched]);

  const slugChanged = !isNew && slug !== category!.slug;
  const dirty = isNew
    ? title !== '' || slug !== '' || description !== '' || sortOrder !== '0' || !isActive || parentId !== ''
    : title !== category!.title || slug !== category!.slug || (description ?? '') !== (category!.description ?? '') ||
      Number(sortOrder) !== category!.sortOrder || isActive !== category!.isActive || (parentId || null) !== (category!.parentId ?? null);

  const slugValid = slug === '' ? false : isValidSlug(slug);
  const canSave = title.trim() !== '' && slugValid && dirty && !saving;

  async function submit() {
    if (savingRef.current || !canSave) return; // защита от двойного клика
    savingRef.current = true;
    setSaving(true);
    setError(null);
    const token = tokenStorage.getAccessToken();
    if (!token) { setError('Сессия истекла.'); savingRef.current = false; setSaving(false); return; }

    const payload = {
      title: title.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      parentId: parentId || null,
      sortOrder: Number(sortOrder) || 0,
      isActive,
    };
    try {
      if (isNew) await createAdminCategory(payload, token);
      else await updateAdminCategory(category!.id, payload, token);
      await revalidateCatalog(token);
      onSaved();
    } catch (err) {
      setError(describeCatalogError(err).message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function close() {
    if (dirty && !window.confirm('Есть несохранённые изменения. Закрыть без сохранения?')) return;
    onClose();
  }

  // Возможные родители: все, кроме самой категории (циклы пресекает backend).
  const parents = categories.filter((c) => c.id !== category?.id);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="presentation" onClick={close}>
      <div role="dialog" aria-modal="true" aria-label={isNew ? 'Новая категория' : 'Правка категории'} className="flex h-full w-full max-w-md flex-col bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="font-bold">{isNew ? 'Новая категория' : 'Категория'}</h3>
          <button onClick={close} aria-label="Закрыть" className="grid h-9 w-9 place-items-center rounded-xl border border-border hover:text-danger"><X size={16} /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

          <Field label="Название">
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={inputCls} />
          </Field>

          <Field label="Slug (адрес)">
            <input
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
              maxLength={150}
              aria-invalid={slug !== '' && !slugValid}
              className={inputCls}
            />
            {slug !== '' && !slugValid && <Hint tone="danger">Только строчная латиница, цифры и дефисы.</Hint>}
            {slugChanged && slugValid && <Hint tone="warning">Изменится публичный адрес страницы. Старый URL перестанет открываться — перенаправление не настраивается.</Hint>}
          </Field>

          <Field label="Описание">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${inputCls.replace('h-10', 'min-h-[80px] py-2')}`} />
          </Field>

          <Field label="Родительская категория">
            <select value={parentId} onChange={(e) => setParentId(e.target.value)} className={inputCls}>
              <option value="">— без родителя —</option>
              {parents.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Порядок">
              <input type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Статус">
              <label className="mt-1 inline-flex h-10 items-center gap-2 text-sm">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4" />
                Активна (видна на сайте)
              </label>
            </Field>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border p-4">
          {dirty ? <span className="text-xs text-warning">Есть несохранённые изменения</span> : <span />}
          <div className="flex gap-2">
            <button onClick={close} disabled={saving} className="h-10 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-60">Отмена</button>
            <button onClick={submit} disabled={!canSave} className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary-hover disabled:opacity-50">
              {saving ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputCls = 'h-10 w-full rounded-xl border border-border bg-bg px-3 text-fg focus:border-primary focus:outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted">{label}</span>
      {children}
    </label>
  );
}
function Hint({ tone, children }: { tone: 'danger' | 'warning'; children: React.ReactNode }) {
  return (
    <span className={`mt-1 flex items-start gap-1 text-xs ${tone === 'danger' ? 'text-danger' : 'text-warning'}`}>
      <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {children}
    </span>
  );
}
