'use client';

import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ImagePlus, Loader2, Star, Trash2, UploadCloud } from 'lucide-react';
import { tokenStorage } from '@/lib/api/auth';
import { deleteServiceImage, updateServiceImage, type AdminService } from '@/lib/api/admin-catalog';
import { uploadServiceImage } from '@/lib/api/upload';
import { describeCatalogError } from '@/lib/catalog/errors';
import { revalidateCatalog } from '@/lib/catalog/revalidate';
import type { ServiceImage } from '@/lib/api/types';

const ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX_BYTES = 20 * 1024 * 1024;

/**
 * Управление изображениями услуги поверх существующего Files/S3/ServiceImage.
 * Загрузка — публичные картинки каталога (не PRIVATE artwork). Основное
 * изображение единственно (инвариант обеспечивает backend транзакцией).
 */
export function ServiceImagesManager({ service, onChanged }: { service: AdminService; onChanged: () => void }) {
  const images = [...service.images].sort((a, b) => a.sortOrder - b.sortOrder);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function afterMutation(token: string) {
    await revalidateCatalog(token);
    onChanged();
  }

  async function upload(file: File) {
    setError(null);
    if (!ACCEPT.split(',').includes(file.type)) return setError('Разрешены JPEG, PNG или WebP.');
    if (file.size > MAX_BYTES) return setError('Файл больше 20 МБ.');
    const token = tokenStorage.getAccessToken();
    if (!token) return setError('Сессия истекла.');
    setProgress(0);
    try {
      await uploadServiceImage(service.id, file, token, { onProgress: (f) => setProgress(Math.round(f * 100)) });
      await afterMutation(token);
    } catch (err) {
      setError(describeCatalogError(err).message);
    } finally {
      setProgress(null);
    }
  }

  async function mutate(imageId: string, fn: (token: string) => Promise<unknown>) {
    const token = tokenStorage.getAccessToken();
    if (!token) return setError('Сессия истекла.');
    setError(null);
    setBusyId(imageId);
    try {
      await fn(token);
      await afterMutation(token);
    } catch (err) {
      const d = describeCatalogError(err);
      setError(d.message);
      if (d.reload) onChanged();
    } finally {
      setBusyId(null);
    }
  }

  const setMain = (img: ServiceImage) => mutate(img.id, (t) => updateServiceImage(service.id, img.id, { isMain: true }, t));
  const saveAlt = (img: ServiceImage, alt: string) => mutate(img.id, (t) => updateServiceImage(service.id, img.id, { alt }, t));
  const remove = (img: ServiceImage) => {
    if (!window.confirm('Открепить это изображение от услуги?')) return;
    mutate(img.id, (t) => deleteServiceImage(service.id, img.id, t));
  };
  // Перестановка меняет sortOrder местами с соседом.
  function move(index: number, dir: -1 | 1) {
    const other = images[index + dir];
    const current = images[index];
    if (!other) return;
    mutate(current.id, async (t) => {
      await updateServiceImage(service.id, current.id, { sortOrder: other.sortOrder }, t);
      await updateServiceImage(service.id, other.id, { sortOrder: current.sortOrder }, t);
    });
  }

  return (
    <div>
      {error && <p role="alert" className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
        className={`rounded-2xl border-2 border-dashed p-6 text-center ${dragOver ? 'border-primary bg-primary/5' : 'border-border'}`}
      >
        {progress !== null ? (
          <div className="mx-auto max-w-xs">
            <p className="flex items-center justify-center gap-2 text-sm text-muted"><Loader2 size={16} className="animate-spin" /> Загрузка… {progress}%</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
          </div>
        ) : (
          <>
            <UploadCloud size={28} className="mx-auto text-subtle" />
            <p className="mt-2 text-sm text-muted">Перетащите изображение сюда или</p>
            <button onClick={() => inputRef.current?.click()} className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary-hover">
              <ImagePlus size={15} /> Выбрать файл
            </button>
            <p className="mt-2 text-xs text-subtle">JPEG, PNG или WebP, до 20 МБ</p>
          </>
        )}
        <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
      </div>

      {images.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Изображений пока нет. Первое загруженное станет основным.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {images.map((img, i) => (
            <ImageRow
              key={img.id}
              img={img}
              busy={busyId === img.id}
              isFirst={i === 0}
              isLast={i === images.length - 1}
              onMain={() => setMain(img)}
              onAlt={(alt) => saveAlt(img, alt)}
              onUp={() => move(i, -1)}
              onDown={() => move(i, 1)}
              onDelete={() => remove(img)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ImageRow({
  img, busy, isFirst, isLast, onMain, onAlt, onUp, onDown, onDelete,
}: {
  img: ServiceImage; busy: boolean; isFirst: boolean; isLast: boolean;
  onMain: () => void; onAlt: (alt: string) => void; onUp: () => void; onDown: () => void; onDelete: () => void;
}) {
  const [alt, setAlt] = useState(img.alt ?? '');
  const altDirty = alt !== (img.alt ?? '');

  return (
    <li className="flex flex-wrap items-start gap-3 rounded-2xl border border-border bg-bg p-3">
      {img.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img.url} alt={img.alt ?? ''} className="h-20 w-20 shrink-0 rounded-lg border border-border object-cover" />
      ) : (
        <span className="grid h-20 w-20 shrink-0 place-items-center rounded-lg border border-border bg-surface-2 text-subtle text-xs">нет</span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {img.isMain ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"><Star size={12} className="fill-current" /> Основное</span>
          ) : (
            <button onClick={onMain} disabled={busy} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs font-medium hover:border-primary hover:text-primary disabled:opacity-50"><Star size={12} /> Сделать основным</button>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="min-w-[180px] flex-1 text-xs">
            <span className="mb-1 block text-muted">Alt-текст</span>
            <input value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={300} className="h-9 w-full rounded-xl border border-border bg-surface px-3 text-sm text-fg focus:border-primary focus:outline-none" />
          </label>
          <button onClick={() => onAlt(alt.trim())} disabled={busy || !altDirty} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-medium hover:border-primary hover:text-primary disabled:opacity-40">
            <Check size={13} /> Сохранить alt
          </button>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-1">
        <div className="flex gap-1">
          <button onClick={onUp} disabled={busy || isFirst} aria-label="Выше" className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:border-primary hover:text-primary disabled:opacity-30"><ArrowUp size={14} /></button>
          <button onClick={onDown} disabled={busy || isLast} aria-label="Ниже" className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:border-primary hover:text-primary disabled:opacity-30"><ArrowDown size={14} /></button>
        </div>
        <button onClick={onDelete} disabled={busy} aria-label="Открепить" className="grid h-8 w-full place-items-center rounded-lg border border-border hover:border-danger hover:text-danger disabled:opacity-40"><Trash2 size={14} /></button>
      </div>
    </li>
  );
}
