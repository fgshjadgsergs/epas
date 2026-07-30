'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, Eye, ShieldAlert } from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { tokenStorage } from '@/lib/api/auth';
import {
  changeArtworkStatus,
  getAdminArtwork,
  getAdminArtworkDownloadUrl,
  getAdminArtworkPreviewUrl,
  type AdminArtworkDetail as AdminArtworkDetailDto,
  type AdminArtworkReviewTarget,
} from '@/lib/api/admin-artworks';
import { describeArtworkError } from '@/lib/artworks/errors';
import {
  artworkStatusBadge,
  artworkStatusLabel,
  formatArtworkDate,
  formatFileSize,
  humanFileType,
  reviewTransitionLabel,
} from '@/lib/artworks/presentation';
import { ArtworkPreviewModal } from '@/components/artwork/artwork-preview-modal';

const REVIEW_TARGETS: AdminArtworkReviewTarget[] = ['IN_REVIEW', 'APPROVED', 'REJECTED'];
const isReviewTarget = (s: string): s is AdminArtworkReviewTarget => (REVIEW_TARGETS as string[]).includes(s);
const LIST_PATH = '/admin/artworks/';

type State =
  | { status: 'loading' }
  | { status: 'ready'; artwork: AdminArtworkDetailDto }
  | { status: 'forbidden' }
  | { status: 'unauthorized' }
  | { status: 'notFound' }
  | { status: 'error'; message: string };

/**
 * Рабочее место проверки макета. Кнопки review строятся строго из backend
 * allowedTransitions — карта переходов на фронте не дублируется. reviewer id
 * не передаётся (берётся из сессии). Presigned URL получаются по клику и нигде
 * не сохраняются. При 409/конфликте состояние перечитывается.
 */
export function AdminArtworkDetail({ artworkId }: { artworkId: string }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [preview, setPreview] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState<AdminArtworkReviewTarget | null>(null);

  const load = useCallback(() => {
    const token = tokenStorage.getAccessToken();
    if (!token) return setState({ status: 'unauthorized' });
    setState({ status: 'loading' });
    getAdminArtwork(artworkId, token)
      .then((artwork) => setState({ status: 'ready', artwork }))
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 403) return setState({ status: 'forbidden' });
        if (error instanceof ApiError && error.status === 401) return setState({ status: 'unauthorized' });
        if (error instanceof ApiError && error.status === 404) return setState({ status: 'notFound' });
        setState({ status: 'error', message: error instanceof ApiError ? error.message : 'Не удалось загрузить макет.' });
      });
  }, [artworkId]);

  useEffect(() => load(), [load]);

  const submitReview = useCallback(
    async (target: AdminArtworkReviewTarget, comment?: string) => {
      const token = tokenStorage.getAccessToken();
      if (!token) return setState({ status: 'unauthorized' });
      setActionError(null);
      setPending(target);
      try {
        const artwork = await changeArtworkStatus(artworkId, { status: target, comment: comment || undefined }, token);
        setState({ status: 'ready', artwork });
      } catch (err) {
        const d = describeArtworkError(err);
        setActionError(d.message);
        if (d.reload) load(); // 409/конфликт → актуальное состояние
      } finally {
        setPending(null);
      }
    },
    [artworkId, load],
  );

  if (state.status === 'loading') return <Shell><p role="status" className="text-muted">Загружаем макет…</p></Shell>;
  if (state.status === 'unauthorized') return <Shell><Notice icon={ShieldAlert} tone="warning" title="Сессия истекла" text="Войдите заново, чтобы продолжить." /></Shell>;
  if (state.status === 'forbidden') return <Shell><Notice icon={ShieldAlert} tone="danger" title="Нет доступа" text="У вашей учётной записи нет прав на проверку макетов." /></Shell>;
  if (state.status === 'notFound') return <Shell><Notice icon={AlertTriangle} tone="warning" title="Макет не найден" text="Возможно, он был заменён новой версией или отозван." /></Shell>;
  if (state.status === 'error') {
    return (
      <Shell>
        <div className="rounded-2xl border border-danger/40 bg-surface p-6 text-center">
          <AlertTriangle size={32} className="mx-auto text-danger" />
          <p className="mt-3 font-semibold">Не удалось загрузить макет</p>
          <p className="mt-1 text-sm text-muted">{state.message}</p>
          <button onClick={load} className="mt-4 h-10 rounded-xl border border-border px-4 text-sm font-medium hover:border-primary hover:text-primary">Повторить</button>
        </div>
      </Shell>
    );
  }

  const { artwork } = state;
  const transitions = artwork.allowedTransitions.filter(isReviewTarget);

  async function download() {
    setActionError(null);
    try {
      const token = tokenStorage.getAccessToken()!;
      const res = await getAdminArtworkDownloadUrl(artworkId, token);
      window.open(res.url, '_blank', 'noopener'); // URL не сохраняем
    } catch (err) {
      setActionError(describeArtworkError(err).message);
    }
  }

  return (
    <Shell>
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">Заказ {artwork.orderNumber}</h2>
            <p className="text-sm text-subtle">{artwork.itemTitle}</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${artworkStatusBadge(artwork.status)}`}>
            v{artwork.version} · {artworkStatusLabel(artwork.status)}
          </span>
        </div>

        {artwork.status === 'APPROVED' && (
          <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-2 text-sm font-semibold text-success">
            <CheckCircle2 size={16} /> Макет принят в работу
          </p>
        )}
        {artwork.status === 'REJECTED' && artwork.reviewComment && (
          <div className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle size={15} /> Отклонён с комментарием</p>
            <p className="mt-1">{artwork.reviewComment}</p>
          </div>
        )}
      </div>

      {actionError && <p role="alert" className="mt-4 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{actionError}</p>}

      <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Центральный блок: предпросмотр. */}
        <div className="rounded-2xl border border-border bg-surface p-5">
          <h3 className="font-semibold">Файл макета</h3>
          <div className="mt-3 rounded-xl border border-border bg-bg p-4">
            <p className="truncate font-medium">{artwork.file.filename}</p>
            <p className="mt-0.5 text-xs text-subtle">{humanFileType(artwork.file.mimeType)} · {formatFileSize(artwork.file.size)} · загружен {formatArtworkDate(artwork.createdAt)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {artwork.file.previewable && (
                <button onClick={() => setPreview(true)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-medium hover:border-primary hover:text-primary">
                  <Eye size={15} /> Предпросмотр
                </button>
              )}
              <button onClick={download} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-medium hover:border-primary hover:text-primary">
                <Download size={15} /> Скачать
              </button>
            </div>
            {!artwork.file.previewable && <p className="mt-2 text-xs text-muted">Предпросмотр для этого типа недоступен — скачайте файл для проверки.</p>}
          </div>

          {artwork.customerComment && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold">Комментарий клиента</h4>
              <p className="mt-1 whitespace-pre-line rounded-xl border border-border bg-bg px-3 py-2 text-sm text-muted">{artwork.customerComment}</p>
            </div>
          )}

          {artwork.reviewedBy && artwork.reviewedAt && (
            <p className="mt-4 text-xs text-subtle">Проверил: {artwork.reviewedBy.displayName} · {formatArtworkDate(artwork.reviewedAt)}</p>
          )}
        </div>

        {/* Действия проверки — строго из backend allowedTransitions. */}
        <div className="rounded-2xl border border-border bg-surface p-5">
          <h3 className="font-semibold">Проверка</h3>
          {transitions.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Для текущего статуса действий нет.</p>
          ) : (
            <ReviewActions transitions={transitions} pending={pending} onSubmit={submitReview} />
          )}
        </div>
      </section>

      {artwork.history.length > 0 && (
        <section className="mt-4 rounded-2xl border border-border bg-surface p-5">
          <h3 className="font-semibold">История</h3>
          <ol className="mt-3 space-y-3">
            {artwork.history.map((h, i) => (
              <li key={`${h.createdAt}-${i}`} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                <span className="min-w-0">
                  <span className="font-medium">{artworkStatusLabel(h.toStatus)}</span>
                  <span className="ml-2 text-xs text-subtle">{formatArtworkDate(h.createdAt)}</span>
                  {h.changedBy && <span className="ml-2 text-xs text-muted">· {h.changedBy.displayName}</span>}
                  {h.comment && <span className="mt-0.5 block text-xs text-muted">{h.comment}</span>}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {preview && (
        <ArtworkPreviewModal
          filename={artwork.file.filename}
          mimeType={artwork.file.mimeType}
          getPreviewUrl={async () => {
            const token = tokenStorage.getAccessToken();
            if (!token) return null;
            const res = await getAdminArtworkPreviewUrl(artworkId, token);
            return res.previewAvailable ? res.url : null;
          }}
          getDownloadUrl={async () => {
            const token = tokenStorage.getAccessToken()!;
            const res = await getAdminArtworkDownloadUrl(artworkId, token);
            return res.url;
          }}
          onClose={() => setPreview(false)}
        />
      )}
    </Shell>
  );
}

function ReviewActions({
  transitions,
  pending,
  onSubmit,
}: {
  transitions: AdminArtworkReviewTarget[];
  pending: AdminArtworkReviewTarget | null;
  onSubmit: (target: AdminArtworkReviewTarget, comment?: string) => void | Promise<void>;
}) {
  const [confirm, setConfirm] = useState<AdminArtworkReviewTarget | null>(null);
  const busy = pending !== null;

  return (
    <>
      <div className="mt-3 flex flex-col gap-2">
        {transitions.includes('IN_REVIEW') && (
          <button onClick={() => setConfirm('IN_REVIEW')} disabled={busy} className="h-10 rounded-xl border border-border px-4 text-sm font-semibold hover:border-primary hover:text-primary disabled:opacity-60">
            {reviewTransitionLabel('IN_REVIEW')}
          </button>
        )}
        {transitions.includes('APPROVED') && (
          <button onClick={() => setConfirm('APPROVED')} disabled={busy} className="h-10 rounded-xl bg-success px-4 text-sm font-semibold text-white hover:bg-success/90 disabled:opacity-60">
            {reviewTransitionLabel('APPROVED')}
          </button>
        )}
        {transitions.includes('REJECTED') && (
          <button onClick={() => setConfirm('REJECTED')} disabled={busy} className="h-10 rounded-xl bg-danger px-4 text-sm font-semibold text-white hover:bg-danger/90 disabled:opacity-60">
            {reviewTransitionLabel('REJECTED')}
          </button>
        )}
      </div>

      {confirm && (
        <ReviewDialog
          target={confirm}
          busy={pending === confirm}
          onCancel={() => setConfirm(null)}
          onConfirm={async (comment) => {
            await onSubmit(confirm, comment);
            setConfirm(null);
          }}
        />
      )}
    </>
  );
}

function ReviewDialog({
  target,
  busy,
  onConfirm,
  onCancel,
}: {
  target: AdminArtworkReviewTarget;
  busy: boolean;
  onConfirm: (comment?: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const requiresComment = target === 'REJECTED';
  const allowsComment = target !== 'IN_REVIEW';
  const trimmed = comment.trim();
  const invalid = requiresComment && trimmed.length === 0;

  const title =
    target === 'IN_REVIEW' ? 'Взять макет на проверку?' : target === 'APPROVED' ? 'Принять макет?' : 'Отклонить макет?';
  const hint =
    target === 'IN_REVIEW'
      ? 'Клиент увидит, что макет проверяется, и не сможет его заменить.'
      : target === 'APPROVED'
        ? 'Комментарий необязателен — клиент увидит его как решение по макету.'
        : 'Комментарий обязателен — клиент увидит причину отклонения.';

  async function submit() {
    if (invalid || busy || submitted) return; // защита от повторного клика
    setSubmitted(true);
    try {
      await onConfirm(allowsComment ? trimmed : undefined);
    } finally {
      setSubmitted(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="presentation" onClick={busy ? undefined : onCancel}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h4 className="font-bold">{title}</h4>
        <p className="mt-2 text-sm text-muted">{hint}</p>

        {allowsComment && (
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-muted">Комментарий{requiresComment ? '' : ' (необязательно)'}</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={1000}
              rows={3}
              aria-invalid={invalid || undefined}
              className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-fg focus:border-primary focus:outline-none"
              placeholder={requiresComment ? 'Что нужно исправить в макете' : 'Комментарий для клиента'}
            />
            {invalid && <span className="mt-1 block text-xs text-danger">Укажите причину отклонения.</span>}
          </label>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={submit}
            disabled={invalid || busy || submitted}
            className={`h-10 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60 ${target === 'REJECTED' ? 'bg-danger hover:bg-danger/90' : target === 'APPROVED' ? 'bg-success hover:bg-success/90' : 'bg-primary hover:bg-primary-hover'}`}
          >
            {busy || submitted ? 'Сохраняем…' : reviewTransitionLabel(target)}
          </button>
          <button onClick={onCancel} disabled={busy || submitted} className="h-10 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-60">Отмена</button>
        </div>
      </div>
    </div>
  );
}

function Notice({ icon: Icon, tone, title, text }: { icon: typeof AlertTriangle; tone: 'danger' | 'warning'; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-8 text-center">
      <Icon size={32} className={`mx-auto ${tone === 'danger' ? 'text-danger' : 'text-warning'}`} />
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{text}</p>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Link href={LIST_PATH} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary">
        <ArrowLeft size={15} /> Все макеты
      </Link>
      {children}
    </div>
  );
}
