import { Prisma } from '@prisma/client';
import { customerActionsFor } from './artwork-status';

/** Безопасное имя сотрудника-проверяющего: имя+фамилия, иначе нейтрально. */
export function reviewerDisplayName(user: { firstName: string | null; lastName: string | null } | null): string | null {
  if (!user) return null;
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || 'Сотрудник';
}

export const ARTWORK_INCLUDE = {
  file: { select: { originalName: true, mimeType: true, size: true } },
  reviewedBy: { select: { firstName: true, lastName: true } },
} satisfies Prisma.OrderItemArtworkInclude;

export const ARTWORK_HISTORY_INCLUDE = {
  history: {
    orderBy: { createdAt: 'asc' },
    include: { changedBy: { select: { firstName: true, lastName: true } } },
  },
} satisfies Prisma.OrderItemArtworkInclude;

type ArtworkWithFile = Prisma.OrderItemArtworkGetPayload<{ include: typeof ARTWORK_INCLUDE }>;

/** Импортируем isArtworkPreviewable лениво, чтобы избежать циклов. */
import { isArtworkPreviewable } from './artwork-status';

/**
 * Безопасное представление макета для клиента. НЕ раскрывает bucket/storageKey/
 * ownerUserId/reviewer UUID/signed URL/secrets. reviewer — только displayName.
 */
export function toCustomerArtworkView(artwork: ArtworkWithFile, isLatest: boolean) {
  return {
    id: artwork.id,
    version: artwork.version,
    status: artwork.status,
    customerComment: artwork.customerComment,
    reviewComment: artwork.reviewComment,
    reviewedBy: reviewerDisplayName(artwork.reviewedBy)
      ? { displayName: reviewerDisplayName(artwork.reviewedBy)! }
      : null,
    reviewedAt: artwork.reviewedAt ? artwork.reviewedAt.toISOString() : null,
    createdAt: artwork.createdAt.toISOString(),
    file: {
      filename: artwork.file.originalName,
      mimeType: artwork.file.mimeType,
      size: artwork.file.size,
      previewable: isArtworkPreviewable(artwork.file.mimeType),
    },
    allowedActions: customerActionsFor(artwork.status, isLatest),
  };
}
