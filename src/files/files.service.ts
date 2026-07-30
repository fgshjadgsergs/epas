import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { FileStatus, FileVisibility, UploadedFile } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AppConfig } from '../config/configuration';
import { FILE_MANAGE_ROLE_CODES } from '../common/constants/roles.constant';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { UploadFileDto } from './dto/upload-file.dto';
import { ARTWORK_PREVIEWABLE_MIME_TYPES } from '../artworks/artwork-status';

// file-type can't sniff these from magic bytes (no binary signature) — for
// these declared MIME types we trust the multer-reported Content-Type instead.
const TEXT_LIKE_MIME_TYPES = ['text/plain', 'text/csv', 'application/json'];

// file-type is ESM-only; TypeScript would otherwise downcompile a plain
// `import()` to `require()` under our CommonJS module target, which fails
// for ESM packages. A Function-wrapped import forces a real native import.
const loadFileType = new Function(
  'return import("file-type")',
) as () => Promise<typeof import('file-type')>;

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async uploadFile(file: Express.Multer.File, dto: UploadFileDto, currentUser: AuthenticatedUser): Promise<UploadedFile> {
    await this.validateFile(file);

    const storageKey = this.buildStorageKey(file.originalname);
    await this.storageService.uploadObject(storageKey, file.buffer, file.mimetype);

    return this.prisma.uploadedFile.create({
      data: {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        bucket: this.storageService.getBucket(),
        storageKey,
        publicUrl: this.storageService.buildPublicUrl(storageKey) ?? null,
        ownerId: currentUser.id,
        entityType: dto.entityType,
        entityId: dto.entityId,
        status: FileStatus.READY,
        visibility: FileVisibility.PRIVATE,
      },
    });
  }

  /**
   * Загрузка ПУБЛИЧНОГО изображения каталога (карточки услуг). В отличие от
   * artwork-файлов (PRIVATE), эти файлы отдаются публично по publicUrl —
   * два разных бизнес-контекста поверх общего storage. Тот же allowlist и
   * проверка сигнатуры. Владельца не выставляем: это контент сайта, не файл
   * клиента.
   */
  async uploadCatalogImage(file: Express.Multer.File, currentUser: AuthenticatedUser): Promise<UploadedFile> {
    await this.validateFile(file);

    const storageKey = this.buildStorageKey(file.originalname);
    await this.storageService.uploadObject(storageKey, file.buffer, file.mimetype);

    return this.prisma.uploadedFile.create({
      data: {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        bucket: this.storageService.getBucket(),
        storageKey,
        publicUrl: this.storageService.buildPublicUrl(storageKey) ?? null,
        ownerId: currentUser.id,
        entityType: 'service-image',
        status: FileStatus.READY,
        visibility: FileVisibility.PUBLIC,
      },
    });
  }

  async findById(id: string, currentUser: AuthenticatedUser): Promise<UploadedFile> {
    const file = await this.loadEntity(id);
    this.ensureCanRead(file, currentUser);
    return file;
  }

  /**
   * Список собственных PRIVATE finalized (READY) файлов клиента для повторного
   * использования (напр. «использовать ранее загруженный макет»). Safe DTO —
   * без bucket/storageKey/internal path.
   */
  async listMyFiles(currentUser: AuthenticatedUser, page = 1, pageSize = 20) {
    const where = {
      ownerId: currentUser.id,
      status: FileStatus.READY,
      visibility: FileVisibility.PRIVATE,
    };
    const [rows, total] = await Promise.all([
      this.prisma.uploadedFile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, originalName: true, mimeType: true, size: true, createdAt: true },
      }),
      this.prisma.uploadedFile.count({ where }),
    ]);
    return {
      items: rows.map((f) => ({
        id: f.id,
        filename: f.originalName,
        mimeType: f.mimeType,
        size: f.size,
        createdAt: f.createdAt.toISOString(),
        previewable: ARTWORK_PREVIEWABLE_MIME_TYPES.includes(f.mimeType),
      })),
      total,
      page,
      pageSize,
    };
  }

  async getPresignedUrl(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<{ url: string; expiresInSeconds: number }> {
    const file = await this.loadEntity(id);
    this.ensureCanRead(file, currentUser);

    const expiresInSeconds = 3600;
    const url = await this.storageService.getPresignedUrl(file.storageKey, expiresInSeconds);
    return { url, expiresInSeconds };
  }

  async deleteFile(id: string, currentUser: AuthenticatedUser): Promise<void> {
    const file = await this.loadEntity(id);

    const isOwner = file.ownerId === currentUser.id;
    const canManage = this.hasManageRole(currentUser);
    if (!isOwner && !canManage) {
      throw new ForbiddenException('Нет прав на удаление этого файла');
    }

    await this.storageService.deleteObject(file.storageKey);
    await this.prisma.uploadedFile.update({
      where: { id },
      data: { status: FileStatus.DELETED },
    });
  }

  private async loadEntity(id: string): Promise<UploadedFile> {
    const file = await this.prisma.uploadedFile.findUnique({ where: { id } });
    if (!file || file.status === FileStatus.DELETED) {
      throw new NotFoundException('Файл не найден');
    }
    return file;
  }

  private ensureCanRead(file: UploadedFile, currentUser: AuthenticatedUser): void {
    const isOwner = file.ownerId === currentUser.id;
    const isPublic = file.visibility === FileVisibility.PUBLIC;
    if (!isOwner && !isPublic && !this.hasManageRole(currentUser)) {
      throw new ForbiddenException('Нет прав на доступ к этому файлу');
    }
  }

  private hasManageRole(currentUser: AuthenticatedUser): boolean {
    return currentUser.roles.some((role) => FILE_MANAGE_ROLE_CODES.includes(role as never));
  }

  private async validateFile(file: Express.Multer.File): Promise<void> {
    if (!file) {
      throw new BadRequestException('Файл не передан');
    }

    const { maxSizeBytes, allowedMimeTypes } = this.configService.get('files', { infer: true });

    if (file.size > maxSizeBytes) {
      throw new BadRequestException(
        `Файл превышает максимально допустимый размер ${Math.round(maxSizeBytes / 1024 / 1024)} МБ`,
      );
    }

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Недопустимый тип файла "${file.mimetype}". Разрешены: ${allowedMimeTypes.join(', ')}`,
      );
    }

    // Defence against spoofed Content-Type/extension: sniff the actual
    // file signature and require it to match the declared (whitelisted) MIME.
    if (!TEXT_LIKE_MIME_TYPES.includes(file.mimetype)) {
      const { fileTypeFromBuffer } = await loadFileType();
      const detected = await fileTypeFromBuffer(file.buffer);
      if (!detected || detected.mime !== file.mimetype) {
        throw new BadRequestException(
          'Не удалось подтвердить тип файла по содержимому (сигнатура не совпадает с заявленным MIME-типом)',
        );
      }
    }
  }

  private buildStorageKey(originalName: string): string {
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const datePrefix = new Date().toISOString().slice(0, 10);
    return `${datePrefix}/${randomUUID()}-${safeName}`;
  }
}
