'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Download, Eye, FileImage, RotateCcw, Upload } from 'lucide-react';
import { tokenStorage } from '@/lib/api/auth';
import {
  getArtworkDownloadUrl,
  getArtworkPreviewUrl,
  withdrawArtwork,
  type ArtworkView,
} from '@/lib/api/artworks';
import { useOrderItemArtworks } from '@/lib/artworks/use-order-item-artworks';
import { describeArtworkError } from '@/lib/artworks/errors';
import {
  artworkStatusBadge,
  artworkStatusLabel,
  formatArtworkDate,
  formatFileSize,
  humanFileType,
} from '@/lib/artworks/presentation';
import { ArtworkUploadDialog } from './artwork-upload-dialog';
import { ArtworkPreviewModal } from '@/components/artwork/artwork-preview-modal';

/**
 * Блок «Макет» для позиции заказа. Статусы/действия — из backend
 * (allowedActions); карта workflow на фронте не дублируется. Preview/download —
 * короткоживущие presigned URL, получаемые по клику и нигде не сохраняемые.
 */
export function ArtworkSection({ orderId, itemId, title }: { orderId: string; itemId: string; title: string }) {
  const { state, reload } = useOrderItemArtworks(orderId, itemId);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [preview, setPreview] = useState<ArtworkView | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState<ArtworkView | null>(null);

  const previewFns = (artworkId: string) => ({
    getPreviewUrl: async () => {
      const token = tokenStorage.getAccessToken();
      if (!token) return null;
      const res = await getArtworkPreviewUrl(orderId, itemId, artworkId, token);
      return res.previewAvailable ? res.url : null;
    },
    getDownloadUrl: async () => {
      const token = tokenStorage.getAccessToken()!;
      const res = await getArtworkDownloadUrl(orderId, itemId, artworkId, token);
      return res.url;
    },
  });

  async function download(artworkId: string) {
    setActionError(null);
    try {
      const token = tokenStorage.getAccessToken()!;
      const res = await getArtworkDownloadUrl(orderId, itemId, artworkId, token);
      window.open(res.url, '_blank', 'noopener'); // URL не сохраняем
    } catch (err) {
      setActionError(describeArtworkError(err).message);
    }
  }

  async function doWithdraw(artwork: ArtworkView) {
    setActionError(null);
    const token = tokenStorage.getAccessToken();
    if (!token) return setActionError('Сессия истекла.');
    try {
      await withdrawArtwork(orderId, itemId, artwork.id, token);
      setWithdrawing(null);
      reload();
    } catch (err) {
      const d = describeArtworkError(err);
      setActionError(d.message);
      setWithdrawing(null);
      if (d.reload) reload(); // 409 → перечитать актуальное состояние
    }
  }

  if (state.status === 'loading') {
    return <Block><p role="status" className="text-sm text-muted">Загружаем макет…</p></Block>;
  }
  if (state.status === 'unauthorized') {
    return <Block><p className="text-sm text-muted">Войдите, чтобы работать с макетом.</p></Block>;
  }
  if (state.status === 'notFound') return null;
  if (state.status === 'error') {
    return (
      <Block>
        <p className="text-sm text-muted">{state.message} <button onClick={reload} className="font-medium text-primary underline">Повторить</button></p>
      </Block>
    );
  }

  const { artworks, canAttachNew } = state.data;
  const current = artworks[artworks.length - 1] ?? null;
  const older = artworks.slice(0, -1);

  return (
    <Block>
      <div className="flex items-center justify-between gap-3">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold"><FileImage size={15} className="text-primary" /> Макет</h4>
        {current && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${artworkStatusBadge(current.status)}`}>
            v{current.version} · {artworkStatusLabel(current.status)}
          </span>
        )}
      </div>

      {actionError && <p role="alert" className="mt-2 rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">{actionError}</p>}

      {!current && (
        <div className="mt-3">
          {canAttachNew ? (
            <button onClick={() => setUploadOpen(true)} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary-hover">
              <Upload size={15} /> Загрузить макет
            </button>
          ) : (
            <p className="text-sm text-muted">Макет ещё не загружен.</p>
          )}
        </div>
      )}

      {current && (
        <div className="mt-3 rounded-xl border border-border bg-bg p-3">
          {current.status === 'APPROVED' && (
            <p className="mb-2 flex items-center gap-1.5 rounded-lg bg-success/10 px-2.5 py-1.5 text-xs font-semibold text-success">
              <CheckCircle2 size={14} /> Макет принят в работу
            </p>
          )}
          {current.status === 'REJECTED' && current.reviewComment && (
            <div className="mb-2 rounded-lg bg-danger/10 px-2.5 py-2 text-xs text-danger">
              <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle size={14} /> Макет отклонён</p>
              <p className="mt-1 text-danger/90">{current.reviewComment}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{current.file.filename}</p>
              <p className="text-xs text-subtle">
                {humanFileType(current.file.mimeType)} · {formatFileSize(current.file.size)} · {formatArtworkDate(current.createdAt)}
              </p>
              {current.customerComment && <p className="mt-1 text-xs text-muted">Ваш комментарий: {current.customerComment}</p>}
              {current.reviewedBy && current.reviewedAt && (
                <p className="mt-0.5 text-xs text-subtle">Проверил: {current.reviewedBy.displayName} · {formatArtworkDate(current.reviewedAt)}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {current.file.previewable && (
                <button onClick={() => setPreview(current)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-medium hover:border-primary hover:text-primary">
                  <Eye size={14} /> Предпросмотр
                </button>
              )}
              <button onClick={() => download(current.id)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-medium hover:border-primary hover:text-primary">
                <Download size={14} /> Скачать
              </button>
            </div>
          </div>

          {/* Действия строго из backend allowedActions. */}
          {current.allowedActions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
              {current.allowedActions.includes('REPLACE') && (
                <button onClick={() => setUploadOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-fg hover:bg-primary-hover">
                  <RotateCcw size={14} /> {current.status === 'REJECTED' ? 'Загрузить исправленный макет' : 'Заменить макет'}
                </button>
              )}
              {current.allowedActions.includes('WITHDRAW') && (
                <button onClick={() => setWithdrawing(current)} className="inline-flex h-9 items-center rounded-xl border border-border px-3 text-sm font-medium hover:border-danger hover:text-danger">
                  Отозвать макет
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {older.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setHistoryOpen((v) => !v)} className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-fg" aria-expanded={historyOpen}>
            <ChevronDown size={14} className={historyOpen ? 'rotate-180 transition-transform' : 'transition-transform'} /> История макетов ({older.length})
          </button>
          {historyOpen && (
            <ul className="mt-2 space-y-2">
              {older.slice().reverse().map((a) => (
                <li key={a.id} className="rounded-xl border border-border bg-bg px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">v{a.version} · {artworkStatusLabel(a.status)}</span>
                    <span className="text-subtle">{formatArtworkDate(a.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-muted">{a.file.filename}</p>
                  {a.reviewComment && <p className="mt-0.5 text-danger/80">Комментарий: {a.reviewComment}</p>}
                  <div className="mt-1 flex gap-2">
                    {a.file.previewable && <button onClick={() => setPreview(a)} className="text-primary hover:underline">Предпросмотр</button>}
                    <button onClick={() => download(a.id)} className="text-primary hover:underline">Скачать</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {uploadOpen && (
        <ArtworkUploadDialog
          orderId={orderId}
          itemId={itemId}
          title={title}
          onClose={() => setUploadOpen(false)}
          onDone={() => {
            setUploadOpen(false);
            reload();
          }}
        />
      )}

      {preview && (
        <ArtworkPreviewModal
          filename={preview.file.filename}
          mimeType={preview.file.mimeType}
          {...previewFns(preview.id)}
          onClose={() => setPreview(null)}
        />
      )}

      {withdrawing && (
        <ConfirmWithdraw filename={withdrawing.file.filename} onConfirm={() => doWithdraw(withdrawing)} onCancel={() => setWithdrawing(null)} />
      )}
    </Block>
  );
}

function ConfirmWithdraw({ filename, onConfirm, onCancel }: { filename: string; onConfirm: () => void; onCancel: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="presentation" onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-label="Отозвать макет" className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h4 className="font-bold">Отозвать макет?</h4>
        <p className="mt-2 text-sm text-muted">Файл «{filename}» будет помечен как отозванный. История сохранится.</p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => { setBusy(true); onConfirm(); }} disabled={busy} className="h-10 rounded-xl bg-danger px-4 text-sm font-semibold text-white hover:bg-danger/90 disabled:opacity-60">
            {busy ? 'Отзываем…' : 'Отозвать'}
          </button>
          <button onClick={onCancel} disabled={busy} className="h-10 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-60">Отмена</button>
        </div>
      </div>
    </div>
  );
}

function Block({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 rounded-xl border border-border bg-surface-2/40 p-3">{children}</div>;
}
