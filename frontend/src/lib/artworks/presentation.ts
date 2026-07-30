/**
 * Отображение макетов: русские подписи статусов, бейджи, действия, размеры,
 * человекочитаемые типы. Статусы/действия/переходы приходят ТОЛЬКО из backend —
 * фронт их не вычисляет, лишь переводит для показа.
 */
import type { ArtworkStatus, ArtworkCustomerAction } from '@/lib/api/artworks';
import type { AdminArtworkReviewTarget } from '@/lib/api/admin-artworks';

export const ARTWORK_STATUS_LABEL: Record<ArtworkStatus, string> = {
  UPLOADED: 'Загружен',
  IN_REVIEW: 'На проверке',
  APPROVED: 'Принят',
  REJECTED: 'Отклонён',
  SUPERSEDED: 'Заменён новой версией',
  WITHDRAWN: 'Отозван',
};

export const ARTWORK_STATUS_BADGE: Record<ArtworkStatus, string> = {
  UPLOADED: 'bg-primary/15 text-primary',
  IN_REVIEW: 'bg-warning/15 text-warning',
  APPROVED: 'bg-success/15 text-success',
  REJECTED: 'bg-danger/15 text-danger',
  SUPERSEDED: 'bg-surface-2 text-muted',
  WITHDRAWN: 'bg-surface-2 text-muted',
};

export function artworkStatusLabel(status: string): string {
  return ARTWORK_STATUS_LABEL[status as ArtworkStatus] ?? status;
}
export function artworkStatusBadge(status: string): string {
  return ARTWORK_STATUS_BADGE[status as ArtworkStatus] ?? 'bg-surface-2 text-muted';
}

/** Подписи клиентских действий (кнопки строятся из backend allowedActions). */
export const CUSTOMER_ACTION_LABEL: Record<ArtworkCustomerAction, string> = {
  WITHDRAW: 'Отозвать макет',
  REPLACE: 'Заменить макет',
};

/** Подписи целевых статусов review (кнопки — из backend allowedTransitions). */
export const REVIEW_TRANSITION_LABEL: Record<AdminArtworkReviewTarget, string> = {
  IN_REVIEW: 'Взять на проверку',
  APPROVED: 'Принять макет',
  REJECTED: 'Отклонить',
};

export function reviewTransitionLabel(status: string): string {
  return REVIEW_TRANSITION_LABEL[status as AdminArtworkReviewTarget] ?? status;
}

/** Человекочитаемый тип файла. */
export function humanFileType(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'JPEG';
    case 'image/png':
      return 'PNG';
    case 'image/webp':
      return 'WebP';
    case 'application/pdf':
      return 'PDF';
    default:
      return mime;
  }
}

export function isImageMime(mime: string): boolean {
  return mime.startsWith('image/');
}
export function isPdfMime(mime: string): boolean {
  return mime === 'application/pdf';
}

/** Байты → «1,2 МБ». */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} КБ`;
  return `${(bytes / 1024 / 1024).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} МБ`;
}

export function formatArtworkDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const adminArtworkDetailPath = (artworkId: string) => `/admin/artworks/${encodeURIComponent(artworkId)}/`;
