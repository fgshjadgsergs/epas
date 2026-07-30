'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { tokenStorage } from '@/lib/api/auth';
import { createAdminService, type AdminCategory } from '@/lib/api/admin-catalog';
import { describeCatalogError } from '@/lib/catalog/errors';
import { revalidateCatalog } from '@/lib/catalog/revalidate';
import { isValidSlug, slugify } from '@/lib/catalog/slug';

/**
 * Создание услуги (базовые поля). Цена и калькулятор здесь не задаются —
 * это Pricing Engine. После создания открываем редактор услуги, где доступны
 * контент, категория/порядок и изображения.
 */
export function ServiceCreateDialog({ categories, onClose }: { categories: AdminCategory[]; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(title));
  }, [title, slugTouched]);

  const slugValid = slug !== '' && isValidSlug(slug);
  const canSave = title.trim() !== '' && slugValid && categoryId !== '' && !saving;

  async function submit() {
    if (savingRef.current || !canSave) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    const token = tokenStorage.getAccessToken();
    if (!token) { setError('Сессия истекла.'); savingRef.current = false; setSaving(false); return; }
    try {
      const created = await createAdminService({ title: title.trim(), slug: slug.trim(), categoryId }, token);
      await revalidateCatalog(token);
      router.push(`/admin/catalog/services/${encodeURIComponent(created.id)}/`);
    } catch (err) {
      setError(describeCatalogError(err).message);
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="presentation" onClick={saving ? undefined : onClose}>
      <div role="dialog" aria-modal="true" aria-label="Новая услуга" className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold">Новая услуга</h3>
          <button onClick={onClose} disabled={saving} aria-label="Закрыть" className="grid h-9 w-9 place-items-center rounded-xl border border-border hover:text-danger disabled:opacity-60"><X size={16} /></button>
        </div>

        {error && <p role="alert" className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Название</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={inputCls} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Slug (адрес)</span>
            <input value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} maxLength={150} aria-invalid={slug !== '' && !slugValid} className={inputCls} />
            {slug !== '' && !slugValid && <span className="mt-1 block text-xs text-danger">Только строчная латиница, цифры и дефисы.</span>}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Категория</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
              {categories.length === 0 && <option value="">— сначала создайте категорию —</option>}
              {categories.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} disabled={saving} className="h-10 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-60">Отмена</button>
          <button onClick={submit} disabled={!canSave} className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary-hover disabled:opacity-50">
            {saving ? 'Создаём…' : 'Создать и открыть'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = 'h-10 w-full rounded-xl border border-border bg-bg px-3 text-fg focus:border-primary focus:outline-none';
