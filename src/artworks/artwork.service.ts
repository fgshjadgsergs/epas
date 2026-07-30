import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ArtworkStatus, FileStatus, FileVisibility, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditLogService } from '../audit/audit-log.service';
import { canAttachNew, isArtworkMimeAllowed, isArtworkPreviewable, replacementBlockedBy } from './artwork-status';
import { ARTWORK_INCLUDE, toCustomerArtworkView } from './artwork-view';
import { AttachArtworkDto } from './dto/attach-artwork.dto';

/** Короткоживущий TTL presigned-ссылок макета (5 минут). */
const ARTWORK_URL_TTL_SECONDS = 300;
/** Advisory-lock seed для версий макета одной позиции. */
const ARTWORK_ITEM_LOCK_SEED = 71;

/** Тело доменной ошибки: код едет в errors.code (frontend различает без парсинга текста). */
function domain(code: string, message: string): { message: string; errors: { code: string } } {
  return { message, errors: { code } };
}

/**
 * Клиентский workflow макетов: привязка PRIVATE-файла к позиции заказа,
 * версионирование/замена, отзыв, безопасное скачивание/preview.
 *
 * Артефакты не меняют снимки OrderItem/цены/заказ — файл лишь связан с
 * неизменяемой позицией. Физически файлы не удаляются при смене статуса.
 */
@Injectable()
export class ArtworkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditLogService,
  ) {}

  /** Список макетов позиции + признак возможности загрузить новую версию. */
  async listForItem(userId: string, orderId: string, orderItemId: string) {
    const item = await this.loadOwnedItem(userId, orderId, orderItemId);
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true } });

    const artworks = await this.prisma.orderItemArtwork.findMany({
      where: { orderItemId: item.id },
      orderBy: { version: 'asc' },
      include: ARTWORK_INCLUDE,
    });
    const latest = artworks[artworks.length - 1] ?? null;

    return {
      artworks: artworks.map((a) => toCustomerArtworkView(a, a.id === latest?.id)),
      // Загрузка новой версии доступна только для NEW-заказа.
      canAttachNew: order.status === 'NEW' && canAttachNew(latest?.status ?? null),
    };
  }

  /** Привязать/заменить макет. Первый — v1; замена — v+1, старая → SUPERSEDED. */
  async attach(userId: string, orderId: string, orderItemId: string, dto: AttachArtworkDto) {
    const item = await this.loadOwnedItem(userId, orderId, orderItemId);
    await this.assertOrderEditable(orderId);

    // Файл: существует, принадлежит клиенту, PRIVATE, finalized (READY), тип разрешён.
    const file = await this.prisma.uploadedFile.findUnique({ where: { id: dto.fileId } });
    if (!file || file.status === FileStatus.DELETED) {
      throw new NotFoundException(domain('ARTWORK_FILE_NOT_READY', 'Файл не найден'));
    }
    if (file.ownerId !== userId) {
      // Не раскрываем существование чужого файла деталями — доменный код + 403.
      throw new ForbiddenException(domain('ARTWORK_FILE_FORBIDDEN', 'Нет доступа к файлу'));
    }
    if (file.visibility !== FileVisibility.PRIVATE) {
      throw new BadRequestException(domain('ARTWORK_FILE_FORBIDDEN', 'Для макета нужен приватный файл'));
    }
    if (file.status !== FileStatus.READY) {
      throw new ConflictException(domain('ARTWORK_FILE_NOT_READY', 'Файл ещё не готов'));
    }
    if (!isArtworkMimeAllowed(file.mimeType)) {
      throw new BadRequestException(domain('ARTWORK_FILE_FORBIDDEN', 'Недопустимый тип файла для макета'));
    }

    const artworkId = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${item.id}, ${ARTWORK_ITEM_LOCK_SEED}))`;

      const latest = await tx.orderItemArtwork.findFirst({
        where: { orderItemId: item.id },
        orderBy: { version: 'desc' },
      });

      // Тот же файл уже активно привязан к этой позиции — не плодим дубликат.
      const duplicate = await tx.orderItemArtwork.findFirst({
        where: {
          orderItemId: item.id,
          fileId: dto.fileId,
          status: { in: [ArtworkStatus.UPLOADED, ArtworkStatus.IN_REVIEW, ArtworkStatus.APPROVED] },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException(domain('ARTWORK_FILE_ALREADY_ATTACHED', 'Этот файл уже прикреплён к позиции'));
      }

      let version = 1;
      if (latest) {
        if (replacementBlockedBy(latest.status)) {
          throw new ConflictException(
            domain('ARTWORK_REPLACEMENT_FORBIDDEN', 'Текущая версия на проверке или принята — замена невозможна'),
          );
        }
        if (latest.status !== ArtworkStatus.UPLOADED && latest.status !== ArtworkStatus.REJECTED) {
          // SUPERSEDED/WITHDRAWN — замена не предусмотрена в MVP.
          throw new ConflictException(
            domain('ARTWORK_REPLACEMENT_FORBIDDEN', 'Загрузка новой версии сейчас недоступна'),
          );
        }
        version = latest.version + 1;
        await tx.orderItemArtwork.update({ where: { id: latest.id }, data: { status: ArtworkStatus.SUPERSEDED } });
        await tx.artworkStatusHistory.create({
          data: { artworkId: latest.id, fromStatus: latest.status, toStatus: ArtworkStatus.SUPERSEDED, changedByUserId: userId },
        });
      }

      const created = await tx.orderItemArtwork.create({
        data: {
          orderItemId: item.id,
          fileId: dto.fileId,
          version,
          status: ArtworkStatus.UPLOADED,
          customerComment: dto.customerComment?.trim() || null,
          history: { create: [{ fromStatus: null, toStatus: ArtworkStatus.UPLOADED, changedByUserId: userId }] },
        },
      });
      return created.id;
    });

    await this.audit.record({
      actorId: userId,
      action: 'artwork.attach',
      entityType: 'OrderItemArtwork',
      entityId: artworkId,
      after: { orderItemId, version: (await this.prisma.orderItemArtwork.findUniqueOrThrow({ where: { id: artworkId }, select: { version: true } })).version },
    });

    return this.getOneView(userId, orderId, orderItemId, artworkId);
  }

  /** Отзыв макета клиентом: UPLOADED → WITHDRAWN. */
  async withdraw(userId: string, orderId: string, orderItemId: string, artworkId: string) {
    const item = await this.loadOwnedItem(userId, orderId, orderItemId);
    await this.assertOrderEditable(orderId);

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${item.id}, ${ARTWORK_ITEM_LOCK_SEED}))`;
      const artwork = await tx.orderItemArtwork.findFirst({ where: { id: artworkId, orderItemId: item.id } });
      if (!artwork) throw new NotFoundException(domain('ARTWORK_NOT_FOUND', 'Макет не найден'));
      if (artwork.status !== ArtworkStatus.UPLOADED) {
        throw new ConflictException(domain('ARTWORK_WITHDRAW_FORBIDDEN', 'Отозвать можно только загруженный, ещё не принятый макет'));
      }
      await tx.orderItemArtwork.update({ where: { id: artwork.id }, data: { status: ArtworkStatus.WITHDRAWN } });
      await tx.artworkStatusHistory.create({
        data: { artworkId: artwork.id, fromStatus: ArtworkStatus.UPLOADED, toStatus: ArtworkStatus.WITHDRAWN, changedByUserId: userId },
      });
    });

    await this.audit.record({ actorId: userId, action: 'artwork.withdraw', entityType: 'OrderItemArtwork', entityId: artworkId });
    return this.getOneView(userId, orderId, orderItemId, artworkId);
  }

  /** Короткоживущий download URL (attachment). Проверяет ownership заказа. */
  async downloadUrl(userId: string, orderId: string, orderItemId: string, artworkId: string) {
    const artwork = await this.loadOwnedArtwork(userId, orderId, orderItemId, artworkId);
    const url = await this.storage.getPresignedContentUrl(artwork.file.storageKey, {
      filename: artwork.file.originalName,
      inline: false,
      expiresInSeconds: ARTWORK_URL_TTL_SECONDS,
    });
    return { url, expiresInSeconds: ARTWORK_URL_TTL_SECONDS };
  }

  /** Короткоживущий inline preview URL (только для безопасных MIME). */
  async previewUrl(userId: string, orderId: string, orderItemId: string, artworkId: string) {
    const artwork = await this.loadOwnedArtwork(userId, orderId, orderItemId, artworkId);
    if (!isArtworkPreviewable(artwork.file.mimeType)) {
      return { previewAvailable: false as const, url: null, expiresInSeconds: 0 };
    }
    const url = await this.storage.getPresignedContentUrl(artwork.file.storageKey, {
      filename: artwork.file.originalName,
      inline: true,
      expiresInSeconds: ARTWORK_URL_TTL_SECONDS,
    });
    return { previewAvailable: true as const, url, expiresInSeconds: ARTWORK_URL_TTL_SECONDS };
  }

  // --- helpers --------------------------------------------------------------

  /** OrderItem, принадлежащий заказу текущего клиента; иначе 404 (не раскрываем чужое). */
  private async loadOwnedItem(userId: string, orderId: string, orderItemId: string) {
    const item = await this.prisma.orderItem.findFirst({
      where: { id: orderItemId, order: { id: orderId, userId } },
      select: { id: true },
    });
    if (!item) throw new NotFoundException(domain('ARTWORK_NOT_FOUND', 'Позиция заказа не найдена'));
    return item;
  }

  private async assertOrderEditable(orderId: string) {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true } });
    if (order.status !== 'NEW') {
      throw new ConflictException(domain('ARTWORK_ORDER_NOT_EDITABLE', 'Заказ нельзя изменять на текущем этапе'));
    }
  }

  private async loadOwnedArtwork(userId: string, orderId: string, orderItemId: string, artworkId: string) {
    const artwork = await this.prisma.orderItemArtwork.findFirst({
      where: { id: artworkId, orderItem: { id: orderItemId, order: { id: orderId, userId } } },
      include: { file: { select: { storageKey: true, originalName: true, mimeType: true } } },
    });
    if (!artwork) throw new NotFoundException(domain('ARTWORK_NOT_FOUND', 'Макет не найден'));
    return artwork;
  }

  private async getOneView(userId: string, orderId: string, orderItemId: string, artworkId: string) {
    const item = await this.loadOwnedItem(userId, orderId, orderItemId);
    const artworks = await this.prisma.orderItemArtwork.findMany({
      where: { orderItemId: item.id },
      orderBy: { version: 'asc' },
      include: ARTWORK_INCLUDE,
    });
    const latest = artworks[artworks.length - 1] ?? null;
    const target = artworks.find((a) => a.id === artworkId);
    if (!target) throw new NotFoundException(domain('ARTWORK_NOT_FOUND', 'Макет не найден'));
    return toCustomerArtworkView(target, target.id === latest?.id);
  }
}
