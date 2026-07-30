import { ArtworkStatus } from '@prisma/client';

/**
 * Единый источник карт переходов макета. Frontend строит кнопки из
 * allowedActions/allowedTransitions, отдаваемых backend, а не дублирует эти
 * карты у себя.
 */

/** Действия клиента над КОНКРЕТНОЙ (последней) версией макета. */
export type ArtworkCustomerAction = 'WITHDRAW' | 'REPLACE';

/** Допустимые действия клиента для последней версии по её статусу. */
export function customerActionsFor(status: ArtworkStatus, isLatest: boolean): ArtworkCustomerAction[] {
  if (!isLatest) return [];
  switch (status) {
    case ArtworkStatus.UPLOADED:
      return ['WITHDRAW', 'REPLACE'];
    case ArtworkStatus.REJECTED:
      return ['REPLACE'];
    default:
      // IN_REVIEW / APPROVED / SUPERSEDED / WITHDRAWN — клиент бездействует.
      return [];
  }
}

/** Можно ли грузить новую версию (первую или замену) для позиции. */
export function canAttachNew(latestStatus: ArtworkStatus | null): boolean {
  // Первый макет — можно; замена — только из UPLOADED/REJECTED (ТЗ §9).
  if (latestStatus === null) return true;
  return latestStatus === ArtworkStatus.UPLOADED || latestStatus === ArtworkStatus.REJECTED;
}

/** Статусы, при которых существующая версия блокирует замену. */
export function replacementBlockedBy(status: ArtworkStatus): boolean {
  return status === ArtworkStatus.IN_REVIEW || status === ArtworkStatus.APPROVED;
}

/**
 * Карта переходов проверки (admin). SUPERSEDED/WITHDRAWN — системные/клиентские,
 * через admin status endpoint недоступны.
 */
export const ADMIN_ARTWORK_TRANSITIONS: Record<ArtworkStatus, ArtworkStatus[]> = {
  [ArtworkStatus.UPLOADED]: [ArtworkStatus.IN_REVIEW, ArtworkStatus.APPROVED, ArtworkStatus.REJECTED],
  [ArtworkStatus.IN_REVIEW]: [ArtworkStatus.APPROVED, ArtworkStatus.REJECTED],
  [ArtworkStatus.APPROVED]: [],
  [ArtworkStatus.REJECTED]: [],
  [ArtworkStatus.SUPERSEDED]: [],
  [ArtworkStatus.WITHDRAWN]: [],
};

/** Целевые статусы, которые admin вообще может выставлять. */
export const ADMIN_REVIEW_TARGETS: ArtworkStatus[] = [
  ArtworkStatus.IN_REVIEW,
  ArtworkStatus.APPROVED,
  ArtworkStatus.REJECTED,
];

export function adminAllowedTransitions(status: ArtworkStatus): ArtworkStatus[] {
  return [...(ADMIN_ARTWORK_TRANSITIONS[status] ?? [])];
}

export function adminCanTransition(from: ArtworkStatus, to: ArtworkStatus): boolean {
  return ADMIN_ARTWORK_TRANSITIONS[from]?.includes(to) ?? false;
}

/** MIME-типы, безопасные для макетов (подмножество общего allowlist, без HTML/SVG/JS). */
export const ARTWORK_SAFE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/** MIME-типы, безопасные для inline-preview (тот же безопасный набор). */
export const ARTWORK_PREVIEWABLE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export function isArtworkMimeAllowed(mimeType: string): boolean {
  return ARTWORK_SAFE_MIME_TYPES.includes(mimeType);
}

export function isArtworkPreviewable(mimeType: string): boolean {
  return ARTWORK_PREVIEWABLE_MIME_TYPES.includes(mimeType);
}
