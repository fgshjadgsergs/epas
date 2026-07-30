import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ArtworkStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditLogService } from '../audit/audit-log.service';
import { adminAllowedTransitions, adminCanTransition, isArtworkPreviewable } from './artwork-status';
import { reviewerDisplayName } from './artwork-view';
import { ChangeArtworkStatusDto } from './dto/change-artwork-status.dto';
import { ListAdminArtworksDto } from './dto/list-admin-artworks.dto';

const ARTWORK_URL_TTL_SECONDS = 300;
/** Advisory-lock seed для конкурентной проверки одного макета. */
const ARTWORK_REVIEW_LOCK_SEED = 72;

function domain(code: string, message: string): { message: string; errors: { code: string } } {
  return { message, errors: { code } };
}

/**
 * Административный workflow макетов: чтение любого макета (artwork.read) и
 * проверка/смена статуса (artwork.review). Ответы не раскрывают storage-
 * идентификаторы и лишний PII; проверяющий — только displayName.
 */
@Injectable()
export class AdminArtworkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditLogService,
  ) {}

  async list(query: ListAdminArtworksDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.OrderItemArtworkWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.orderNumber) where.orderItem = { order: { orderNumber: query.orderNumber } };
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
      if (where.createdAt.gte && where.createdAt.lte && where.createdAt.gte > where.createdAt.lte) {
        throw new BadRequestException('Начало периода позже конца');
      }
    }

    const [rows, total] = await Promise.all([
      this.prisma.orderItemArtwork.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          file: { select: { originalName: true, mimeType: true, size: true } },
          orderItem: { select: { titleSnapshot: true, serviceSlug: true, order: { select: { orderNumber: true } } } },
        },
      }),
      this.prisma.orderItemArtwork.count({ where }),
    ]);

    return {
      items: rows.map((a) => ({
        id: a.id,
        // Технический opaque id для связи макета с позицией в UI (не PII, не
        // показывается пользователю). Название берётся из immutable snapshot.
        orderItemId: a.orderItemId,
        orderNumber: a.orderItem.order.orderNumber,
        itemTitle: a.orderItem.titleSnapshot,
        serviceSlug: a.orderItem.serviceSlug,
        version: a.version,
        status: a.status,
        file: {
          filename: a.file.originalName,
          mimeType: a.file.mimeType,
          size: a.file.size,
          previewable: isArtworkPreviewable(a.file.mimeType),
        },
        customerComment: a.customerComment,
        reviewComment: a.reviewComment,
        createdAt: a.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  async getOne(artworkId: string) {
    const a = await this.prisma.orderItemArtwork.findUnique({
      where: { id: artworkId },
      include: {
        file: { select: { originalName: true, mimeType: true, size: true } },
        reviewedBy: { select: { firstName: true, lastName: true } },
        orderItem: { select: { titleSnapshot: true, serviceSlug: true, order: { select: { orderNumber: true } } } },
        history: { orderBy: { createdAt: 'asc' }, include: { changedBy: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!a) throw new NotFoundException(domain('ARTWORK_NOT_FOUND', 'Макет не найден'));

    return {
      id: a.id,
      orderNumber: a.orderItem.order.orderNumber,
      itemTitle: a.orderItem.titleSnapshot,
      serviceSlug: a.orderItem.serviceSlug,
      version: a.version,
      status: a.status,
      customerComment: a.customerComment,
      reviewComment: a.reviewComment,
      reviewedBy: reviewerDisplayName(a.reviewedBy) ? { displayName: reviewerDisplayName(a.reviewedBy)! } : null,
      reviewedAt: a.reviewedAt ? a.reviewedAt.toISOString() : null,
      createdAt: a.createdAt.toISOString(),
      file: {
        filename: a.file.originalName,
        mimeType: a.file.mimeType,
        size: a.file.size,
        previewable: isArtworkPreviewable(a.file.mimeType),
      },
      allowedTransitions: adminAllowedTransitions(a.status),
      history: a.history.map((h) => ({
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        changedBy: reviewerDisplayName(h.changedBy) ? { displayName: reviewerDisplayName(h.changedBy)! } : null,
        comment: h.comment,
        createdAt: h.createdAt.toISOString(),
      })),
    };
  }

  async changeStatus(artworkId: string, reviewerId: string, dto: ChangeArtworkStatusDto) {
    const target = dto.status;
    const comment = dto.comment?.trim() || null;

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${artworkId}, ${ARTWORK_REVIEW_LOCK_SEED}))`;
      const artwork = await tx.orderItemArtwork.findUnique({ where: { id: artworkId }, select: { status: true } });
      if (!artwork) throw new NotFoundException(domain('ARTWORK_NOT_FOUND', 'Макет не найден'));

      const current = artwork.status;
      if (current === target) {
        throw new ConflictException(domain('ARTWORK_STATUS_UNCHANGED', 'Макет уже в этом статусе'));
      }
      if (!adminCanTransition(current, target)) {
        throw new ConflictException(domain('ARTWORK_TRANSITION_FORBIDDEN', `Недопустимый переход: ${current} → ${target}`));
      }
      if (target === ArtworkStatus.REJECTED && !comment) {
        throw new BadRequestException(domain('ARTWORK_REVIEW_COMMENT_REQUIRED', 'При отклонении обязателен комментарий'));
      }

      // reviewedBy/reviewedAt фиксируем на итоговом решении (APPROVED/REJECTED).
      const finalDecision = target === ArtworkStatus.APPROVED || target === ArtworkStatus.REJECTED;
      await tx.orderItemArtwork.update({
        where: { id: artworkId },
        data: {
          status: target,
          reviewComment: target === ArtworkStatus.REJECTED ? comment : target === ArtworkStatus.APPROVED ? comment : undefined,
          reviewedByUserId: finalDecision ? reviewerId : undefined,
          reviewedAt: finalDecision ? new Date() : undefined,
        },
      });
      await tx.artworkStatusHistory.create({
        data: { artworkId, fromStatus: current, toStatus: target, changedByUserId: reviewerId, comment },
      });
    });

    await this.audit.record({
      actorId: reviewerId,
      action: 'artwork.review',
      entityType: 'OrderItemArtwork',
      entityId: artworkId,
      after: { status: target },
    });

    return this.getOne(artworkId);
  }

  async downloadUrl(artworkId: string) {
    const a = await this.loadWithKey(artworkId);
    const url = await this.storage.getPresignedContentUrl(a.file.storageKey, {
      filename: a.file.originalName,
      inline: false,
      expiresInSeconds: ARTWORK_URL_TTL_SECONDS,
    });
    return { url, expiresInSeconds: ARTWORK_URL_TTL_SECONDS };
  }

  async previewUrl(artworkId: string) {
    const a = await this.loadWithKey(artworkId);
    if (!isArtworkPreviewable(a.file.mimeType)) {
      return { previewAvailable: false as const, url: null, expiresInSeconds: 0 };
    }
    const url = await this.storage.getPresignedContentUrl(a.file.storageKey, {
      filename: a.file.originalName,
      inline: true,
      expiresInSeconds: ARTWORK_URL_TTL_SECONDS,
    });
    return { previewAvailable: true as const, url, expiresInSeconds: ARTWORK_URL_TTL_SECONDS };
  }

  private async loadWithKey(artworkId: string) {
    const a = await this.prisma.orderItemArtwork.findUnique({
      where: { id: artworkId },
      include: { file: { select: { storageKey: true, originalName: true, mimeType: true } } },
    });
    if (!a) throw new NotFoundException(domain('ARTWORK_NOT_FOUND', 'Макет не найден'));
    return a;
  }
}
