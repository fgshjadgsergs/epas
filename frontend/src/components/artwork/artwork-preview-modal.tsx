'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, X } from 'lucide-react';
import { humanFileType, isImageMime, isPdfMime } from '@/lib/artworks/presentation';

/**
 * Модальный предпросмотр макета. Presigned URL получается ТОЛЬКО по открытию и
 * нигде не сохраняется (ни localStorage/sessionStorage/URL страницы). Картинка —
 * inline <img>; PDF — <iframe> или открытие в новой вкладке; прочее — скачивание.
 *
 * Небезопасные типы (HTML/SVG/JS) сюда не попадают: backend их не принимает и
 * не помечает previewable.
 */
export function ArtworkPreviewModal({
  filename,
  mimeType,
  getPreviewUrl,
  getDownloadUrl,
  onClose,
}: {
  filename: string;
  mimeType: string;
  getPreviewUrl: () => Promise<string | null>;
  getDownloadUrl: () => Promise<string>;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    getPreviewUrl()
      .then((u) => {
        if (!cancelled) {
          setUrl(u);
          setLoading(false);
          if (!u) setError('Предпросмотр недоступен для этого файла.');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          setError('Не удалось получить предпросмотр. Файл можно скачать.');
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function download() {
    try {
      const dl = await getDownloadUrl();
      window.open(dl, '_blank', 'noopener');
    } catch {
      setError('Не удалось скачать файл.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Предпросмотр: ${filename}`}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <p className="truncate font-semibold">{filename}</p>
            <p className="text-xs text-subtle">{humanFileType(mimeType)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={download} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-medium hover:border-primary hover:text-primary">
              <Download size={15} /> Скачать
            </button>
            <button ref={closeRef} onClick={onClose} aria-label="Закрыть" className="grid h-9 w-9 place-items-center rounded-xl border border-border hover:text-danger">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="min-h-[240px] flex-1 overflow-auto bg-bg-2 p-4">
          {loading && <p role="status" className="text-center text-sm text-muted">Загружаем предпросмотр…</p>}

          {!loading && url && isImageMime(mimeType) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={filename} className="mx-auto max-h-[70vh] max-w-full rounded-lg object-contain" />
          )}

          {!loading && url && isPdfMime(mimeType) && (
            <div className="flex flex-col items-center gap-3">
              <iframe title={`PDF ${filename}`} src={url} className="h-[70vh] w-full rounded-lg border border-border" />
              <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                <ExternalLink size={14} /> Открыть в новой вкладке
              </a>
            </div>
          )}

          {!loading && error && (
            <div className="grid place-items-center gap-3 py-10 text-center">
              <p className="text-sm text-muted">{error}</p>
              <button onClick={download} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary-hover">
                <Download size={15} /> Скачать файл
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
