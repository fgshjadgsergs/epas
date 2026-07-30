import { apiFetch } from './client';
import type { ArtworkFileMeta, ArtworkStatus, ArtworkUrlResponse, ArtworkPreviewResponse } from './artworks';

/**
 * Клиент админ-макетов. Доступ на backend защищён permissions (artwork.read /
 * artwork.review). reviewer id клиент не передаёт — он из backend-сессии.
 * allowedTransitions отдаёт backend; UI этапа 5 строит кнопки из них.
 */

/** Целевые статусы review (SUPERSEDED/WITHDRAWN недоступны через admin). */
export type AdminArtworkReviewTarget = 'IN_REVIEW' | 'APPROVED' | 'REJECTED';

export interface AdminArtworkSummary {
  id: string;
  /** Технический opaque id позиции для связи в UI (не PII, не для показа). */
  orderItemId: string;
  orderNumber: string;
  itemTitle: string;
  serviceSlug: string;
  version: number;
  status: ArtworkStatus;
  file: ArtworkFileMeta;
  customerComment: string | null;
  reviewComment: string | null;
  createdAt: string;
}

export interface AdminArtworkHistoryEntry {
  fromStatus: ArtworkStatus | null;
  toStatus: ArtworkStatus;
  changedBy: { displayName: string } | null;
  comment: string | null;
  createdAt: string;
}

export interface AdminArtworkDetail extends Omit<AdminArtworkSummary, never> {
  reviewedBy: { displayName: string } | null;
  reviewedAt: string | null;
  allowedTransitions: ArtworkStatus[];
  history: AdminArtworkHistoryEntry[];
}

export interface AdminArtworkListResponse {
  items: AdminArtworkSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminArtworksQuery {
  page?: number;
  pageSize?: number;
  status?: ArtworkStatus;
  orderNumber?: string;
  from?: string;
  to?: string;
}

export function getAdminArtworks(token: string, query: AdminArtworksQuery = {}): Promise<AdminArtworkListResponse> {
  return apiFetch('admin/artworks', {
    token,
    query: { page: query.page, pageSize: query.pageSize, status: query.status, orderNumber: query.orderNumber, from: query.from, to: query.to },
    cache: 'no-store',
  });
}

export function getAdminArtwork(artworkId: string, token: string): Promise<AdminArtworkDetail> {
  return apiFetch(`admin/artworks/${encodeURIComponent(artworkId)}`, { token, cache: 'no-store' });
}

/** Смена статуса макета. Тело: только статус + комментарий (reviewer — на backend). */
export function changeArtworkStatus(
  artworkId: string,
  body: { status: AdminArtworkReviewTarget; comment?: string },
  token: string,
): Promise<AdminArtworkDetail> {
  return apiFetch(`admin/artworks/${encodeURIComponent(artworkId)}/status`, { method: 'PATCH', body, token });
}

export function getAdminArtworkDownloadUrl(artworkId: string, token: string): Promise<ArtworkUrlResponse> {
  return apiFetch(`admin/artworks/${encodeURIComponent(artworkId)}/download`, { token, cache: 'no-store' });
}

export function getAdminArtworkPreviewUrl(artworkId: string, token: string): Promise<ArtworkPreviewResponse> {
  return apiFetch(`admin/artworks/${encodeURIComponent(artworkId)}/preview`, { token, cache: 'no-store' });
}
