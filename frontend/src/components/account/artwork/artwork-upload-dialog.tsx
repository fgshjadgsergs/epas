'use client';

import { useEffect, useRef, useState } from 'react';
import { FileUp, Loader2, UploadCloud, X } from 'lucide-react';
import { tokenStorage } from '@/lib/api/auth';
import { uploadFileWithProgress } from '@/lib/api/upload';
import { attachArtwork, getMyFiles, type MyFileItem } from '@/lib/api/artworks';
import { describeArtworkError } from '@/lib/artworks/errors';
import { ARTWORK_ACCEPT_ATTR, ARTWORK_ACCEPT_LABEL, ARTWORK_MAX_SIZE_LABEL, precheckArtworkFile } from '@/lib/artworks/config';
import { formatArtworkDate, formatFileSize, humanFileType } from '@/lib/artworks/presentation';

const MY_FILES_PAGE_SIZE = 8;
const COMMENT_MAX = 1000;

/**
 * Диалог загрузки макета: новый файл (drag&drop / picker с реальным прогрессом)
 * ИЛИ выбор ранее загруженного (getMyFiles). После получения READY-файла —
 * attachArtwork(fileId). Attach выполняется только после успешной загрузки.
 */
export function ArtworkUploadDialog({
  orderId,
  itemId,
  title,
  onClose,
  onDone,
}: {
  orderId: string;
  itemId: string;
  title: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [tab, setTab] = useState<'new' | 'previous'>('new');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busyRef.current) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function attach(fileId: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const token = tokenStorage.getAccessToken();
    if (!token) {
      setError('Сессия истекла. Войдите заново.');
      busyRef.current = false;
      setBusy(false);
      return;
    }
    try {
      await attachArtwork(orderId, itemId, { fileId, ...(comment.trim() ? { customerComment: comment.trim() } : {}) }, token);
      onDone();
    } catch (err) {
      // Файл уже загружен и остаётся в «Ранее загруженных» — не теряется.
      setError(describeArtworkError(err).message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="presentation" onClick={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Загрузка макета для «${title}»`}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="font-bold">Макет: {title}</h3>
          <button onClick={() => !busy && onClose()} aria-label="Закрыть" className="grid h-9 w-9 place-items-center rounded-xl border border-border hover:text-danger">
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1 border-b border-border p-2 text-sm">
          <button ref={firstRef} onClick={() => setTab('new')} className={`h-9 rounded-lg font-medium ${tab === 'new' ? 'bg-primary text-primary-fg' : 'text-muted'}`}>
            Новый файл
          </button>
          <button onClick={() => setTab('previous')} className={`h-9 rounded-lg font-medium ${tab === 'previous' ? 'bg-primary text-primary-fg' : 'text-muted'}`}>
            Ранее загруженные
          </button>
        </div>

        <div className="min-h-[200px] flex-1 overflow-auto p-4">
          {tab === 'new' ? (
            <NewFileTab busy={busy} onUploaded={attach} onError={setError} />
          ) : (
            <PreviousFilesTab busy={busy} onPick={attach} />
          )}

          <label className="mt-4 block text-sm">
            <span className="mb-1 block text-muted">Комментарий к макету — необязательно</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={COMMENT_MAX}
              rows={2}
              placeholder="Например: печатать без изменений"
              className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-fg focus:border-primary focus:outline-none"
            />
          </label>

          {error && <p role="alert" className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        </div>
      </div>
    </div>
  );
}

/** Вкладка нового файла: drag&drop + picker + реальный прогресс. */
function NewFileTab({ busy, onUploaded, onError }: { busy: boolean; onUploaded: (fileId: string) => void; onError: (m: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [picked, setPicked] = useState<File | null>(null);

  async function handleFile(file: File) {
    const pre = precheckArtworkFile(file);
    if (pre) return onError(pre);
    onError('');
    const token = tokenStorage.getAccessToken();
    if (!token) return onError('Сессия истекла. Войдите заново.');
    setPicked(file);
    setUploading(true);
    setProgress(0);
    try {
      const uploaded = await uploadFileWithProgress(file, token, (f) => setProgress(f));
      onUploaded(uploaded.id); // attach после READY
    } catch (err) {
      onError(describeArtworkError(err).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void handleFile(f);
        }}
        className={`grid place-items-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border'}`}
      >
        <UploadCloud size={28} className="text-muted" />
        <p className="text-sm text-muted">Перетащите файл сюда</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy || uploading}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary-hover disabled:opacity-60"
        >
          <FileUp size={15} /> Выбрать файл
        </button>
        {/* Клавиатурно доступный выбор — не только dropzone. */}
        <input
          ref={inputRef}
          type="file"
          accept={ARTWORK_ACCEPT_ATTR}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = '';
          }}
        />
        <p className="text-xs text-subtle">{ARTWORK_ACCEPT_LABEL} · до {ARTWORK_MAX_SIZE_LABEL}</p>
      </div>

      {uploading && picked && (
        <div className="mt-3" aria-live="polite">
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="inline-flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> {picked.name}</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Вкладка «Ранее загруженные»: getMyFiles + пагинация. */
function PreviousFilesTab({ busy, onPick }: { busy: boolean; onPick: (fileId: string) => void }) {
  const [items, setItems] = useState<MyFileItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  useEffect(() => {
    const token = tokenStorage.getAccessToken();
    if (!token) return;
    setLoading(true);
    setErr(false);
    getMyFiles(token, { page, pageSize: MY_FILES_PAGE_SIZE })
      .then((res) => {
        setItems((prev) => (page === 1 ? res.items : [...prev, ...res.items]));
        setTotal(res.total);
      })
      .catch(() => setErr(true))
      .finally(() => setLoading(false));
  }, [page]);

  if (loading && items.length === 0) return <p role="status" className="text-sm text-muted">Загружаем ваши файлы…</p>;
  if (err && items.length === 0) return <p className="text-sm text-muted">Не удалось загрузить список файлов.</p>;
  if (items.length === 0) return <p className="text-sm text-muted">У вас пока нет загруженных файлов.</p>;

  return (
    <div>
      <ul className="space-y-2">
        {items.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{f.filename}</p>
              <p className="text-xs text-subtle">{humanFileType(f.mimeType)} · {formatFileSize(f.size)} · {formatArtworkDate(f.createdAt)}</p>
            </div>
            <button
              onClick={() => onPick(f.id)}
              disabled={busy}
              className="h-9 shrink-0 rounded-xl border border-primary/40 px-3 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-60"
            >
              Использовать
            </button>
          </li>
        ))}
      </ul>
      {items.length < total && (
        <button onClick={() => setPage((p) => p + 1)} disabled={loading} className="mt-3 h-9 w-full rounded-xl border border-border text-sm font-medium disabled:opacity-50">
          {loading ? 'Загрузка…' : 'Показать ещё'}
        </button>
      )}
    </div>
  );
}
