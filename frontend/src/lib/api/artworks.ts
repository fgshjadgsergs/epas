import { apiFetch } from './client';

/**
 * Клиент макетов заказа (клиентская сторона). UI строится на этапе 5 из
 * allowedActions/previewable, которые отдаёт backend — карта переходов не
 * дублируется на фронте. reviewer/current-user id клиент не передаёт.
 */

export type ArtworkStatus = 'UPLOADED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED' | 'WITHDRAWN';
export type ArtworkCustomerAction = 'WITHDRAW' | 'REPLACE';

export interface ArtworkFileMeta {
  filename: string;
  mimeType: string;
  size: number;
  previewable: boolean;
}

export interface ArtworkView {
  id: string;
  version: number;
  status: ArtworkStatus;
  customerComment: string | null;
  reviewComment: string | null;
  reviewedBy: { displayName: string } | null;
  reviewedAt: string | null;
  createdAt: string;
  file: ArtworkFileMeta;
  allowedActions: ArtworkCustomerAction[];
}

export interface OrderItemArtworksResponse {
  artworks: ArtworkView[];
  canAttachNew: boolean;
}

export interface ArtworkUrlResponse {
  url: string;
  expiresInSeconds: number;
}

export interface ArtworkPreviewResponse {
  previewAvailable: boolean;
  url: string | null;
  expiresInSeconds: number;
}

/** Мои ранее загруженные PRIVATE-файлы (для «использовать существующий макет»). */
export interface MyFileItem {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
  previewable: boolean;
}
export interface MyFilesResponse {
  items: MyFileItem[];
  total: number;
  page: number;
  pageSize: number;
}

const base = (orderId: string, itemId: string) =>
  `orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/artworks`;

export function getOrderItemArtworks(orderId: string, itemId: string, token: string): Promise<OrderItemArtworksResponse> {
  return apiFetch(base(orderId, itemId), { token, cache: 'no-store' });
}

/** Привязать/заменить макет. Тело: только fileId + комментарий. */
export function attachArtwork(
  orderId: string,
  itemId: string,
  body: { fileId: string; customerComment?: string },
  token: string,
): Promise<ArtworkView> {
  return apiFetch(base(orderId, itemId), { method: 'POST', body, token });
}

export function withdrawArtwork(orderId: string, itemId: string, artworkId: string, token: string): Promise<ArtworkView> {
  return apiFetch(`${base(orderId, itemId)}/${encodeURIComponent(artworkId)}/withdraw`, { method: 'POST', token });
}

export function getArtworkDownloadUrl(orderId: string, itemId: string, artworkId: string, token: string): Promise<ArtworkUrlResponse> {
  return apiFetch(`${base(orderId, itemId)}/${encodeURIComponent(artworkId)}/download`, { token, cache: 'no-store' });
}

export function getArtworkPreviewUrl(orderId: string, itemId: string, artworkId: string, token: string): Promise<ArtworkPreviewResponse> {
  return apiFetch(`${base(orderId, itemId)}/${encodeURIComponent(artworkId)}/preview`, { token, cache: 'no-store' });
}

/** Список своих загруженных файлов для повторного использования. */
export function getMyFiles(token: string, query: { page?: number; pageSize?: number } = {}): Promise<MyFilesResponse> {
  return apiFetch('files/my', { token, query: { page: query.page, pageSize: query.pageSize }, cache: 'no-store' });
}
