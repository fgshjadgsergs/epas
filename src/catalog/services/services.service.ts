import { ConflictException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { FilesService } from '../../files/files.service';
import { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { OffsetPaginatedResult, OffsetPaginationQueryDto } from '../../common/dto/offset-pagination.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { UpdateServiceImageDto } from './dto/update-service-image.dto';
import { mapServiceImage, ServiceImageResponseDto } from './dto/service-image-response.dto';

const PUBLIC_IMAGES_INCLUDE = {
  images: {
    orderBy: { sortOrder: 'asc' as const },
    include: { file: { select: { publicUrl: true } } },
  },
};

type ServiceWithRawImages = Prisma.ServiceGetPayload<{ include: typeof PUBLIC_IMAGES_INCLUDE }>;
type ServiceWithMappedImages = Omit<ServiceWithRawImages, 'images'> & { images: ServiceImageResponseDto[] };

/** Категория + калькулятор для админ-DTO (read-only индикаторы). */
const ADMIN_INCLUDE = {
  images: {
    orderBy: { sortOrder: 'asc' as const },
    include: { file: { select: { publicUrl: true } } },
  },
  category: { select: { id: true, title: true, slug: true } },
  calculator: { select: { definitionId: true, definition: { select: { code: true, title: true } } } },
};

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly files: FilesService,
  ) {}

  async findAllPublic(query: OffsetPaginationQueryDto): Promise<OffsetPaginatedResult<ServiceWithMappedImages>> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.service.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
        include: PUBLIC_IMAGES_INCLUDE,
        skip: offset,
        take: limit,
      }),
      this.prisma.service.count({ where: { isActive: true } }),
    ]);

    return {
      items: items.map((service) => this.mapService(service)),
      meta: { limit, offset, total },
    };
  }

  async findBySlugPublic(slug: string): Promise<ServiceWithMappedImages> {
    // F-9: различаем «услуги нет» и «услуга деактивирована». Ищем без фильтра
    // isActive, чтобы отдать авторитетный сигнал:
    //  - нет записи вовсе → 404 (обычная ситуация: страница-вариант/статик-only,
    //    frontend показывает статические данные);
    //  - запись есть, но isActive=false → 410 Gone (услугу сняли) — frontend
    //    НЕ воскрешает её из статики.
    const service = await this.prisma.service.findFirst({
      where: { slug },
      include: PUBLIC_IMAGES_INCLUDE,
    });
    if (!service) {
      throw new NotFoundException('Услуга не найдена');
    }
    if (!service.isActive) {
      throw new GoneException('Услуга снята с публикации');
    }
    return this.mapService(service);
  }

  async findAllForAdmin() {
    const services = await this.prisma.service.findMany({
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      include: ADMIN_INCLUDE,
    });
    return services.map((service) => this.mapAdminService(service));
  }

  async findByIdForAdmin(id: string) {
    const service = await this.prisma.service.findUnique({ where: { id }, include: ADMIN_INCLUDE });
    if (!service) {
      throw new NotFoundException('Услуга не найдена');
    }
    return this.mapAdminService(service);
  }

  async findByIdOrThrow(id: string) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) {
      throw new NotFoundException('Услуга не найдена');
    }
    return service;
  }

  // --- Изображения услуги (ServiceImage) ------------------------------------

  /**
   * Прикрепить загруженное публичное изображение к услуге. Первое изображение
   * услуги автоматически становится основным. Инвариант «максимум один isMain»
   * держится на бэкенде (транзакция), а не во фронте.
   */
  async addImage(serviceId: string, file: Express.Multer.File, user: AuthenticatedUser, alt?: string) {
    await this.findByIdOrThrow(serviceId);
    const uploaded = await this.files.uploadCatalogImage(file, user);

    const image = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.serviceImage.count({ where: { serviceId } });
      const isMain = existing === 0; // первое изображение — основное
      const maxOrder = await tx.serviceImage.aggregate({ where: { serviceId }, _max: { sortOrder: true } });
      return tx.serviceImage.create({
        data: {
          serviceId,
          fileId: uploaded.id,
          alt: alt?.trim() || null,
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
          isMain,
        },
        include: { file: { select: { publicUrl: true } } },
      });
    });
    return mapServiceImage(image);
  }

  async updateImage(serviceId: string, imageId: string, dto: UpdateServiceImageDto) {
    await this.ensureImageBelongs(serviceId, imageId);

    const image = await this.prisma.$transaction(async (tx) => {
      // Установка основного изображения снимает флаг со всех прочих в услуге —
      // так гарантируется единственный isMain без частичного индекса в БД.
      if (dto.isMain === true) {
        await tx.serviceImage.updateMany({ where: { serviceId, id: { not: imageId } }, data: { isMain: false } });
      }
      return tx.serviceImage.update({
        where: { id: imageId },
        data: {
          alt: dto.alt !== undefined ? dto.alt.trim() || null : undefined,
          sortOrder: dto.sortOrder,
          isMain: dto.isMain,
        },
        include: { file: { select: { publicUrl: true } } },
      });
    });
    return mapServiceImage(image);
  }

  async removeImage(serviceId: string, imageId: string): Promise<void> {
    const target = await this.ensureImageBelongs(serviceId, imageId);
    const file = await this.prisma.uploadedFile.findUnique({ where: { id: target.fileId }, select: { storageKey: true } });

    await this.prisma.$transaction(async (tx) => {
      await tx.serviceImage.delete({ where: { id: imageId } });
      await tx.uploadedFile.update({ where: { id: target.fileId }, data: { status: 'DELETED' } });
      // Если удалили основное — назначаем основным первое по порядку из оставшихся.
      if (target.isMain) {
        const next = await tx.serviceImage.findFirst({ where: { serviceId }, orderBy: { sortOrder: 'asc' } });
        if (next) await tx.serviceImage.update({ where: { id: next.id }, data: { isMain: true } });
      }
    });
    if (file) await this.storage.deleteObject(file.storageKey);
  }

  private async ensureImageBelongs(serviceId: string, imageId: string) {
    const image = await this.prisma.serviceImage.findUnique({ where: { id: imageId } });
    if (!image || image.serviceId !== serviceId) {
      throw new NotFoundException('Изображение не найдено');
    }
    return image;
  }

  private mapAdminService(service: Prisma.ServiceGetPayload<{ include: typeof ADMIN_INCLUDE }>) {
    const { images, category, calculator, ...rest } = service;
    return {
      ...rest,
      priceFrom: rest.priceFrom ? rest.priceFrom.toString() : null,
      category,
      // Read-only индикатор: калькулятор подключён — управление ценой в /admin/pricing.
      calculator: calculator
        ? { definitionId: calculator.definitionId, code: calculator.definition.code, title: calculator.definition.title }
        : null,
      images: images.map((image) => mapServiceImage(image)),
    };
  }

  async create(dto: CreateServiceDto) {
    await this.ensureCategoryExists(dto.categoryId);

    try {
      return await this.prisma.service.create({
        data: {
          categoryId: dto.categoryId,
          slug: dto.slug,
          title: dto.title,
          shortDescription: dto.shortDescription,
          description: dto.description,
          priceFrom: dto.priceFrom,
          productionTimeFrom: dto.productionTimeFrom,
          isActive: dto.isActive ?? true,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
    } catch (error) {
      throw this.mapKnownError(error);
    }
  }

  async update(id: string, dto: UpdateServiceDto) {
    await this.findByIdOrThrow(id);

    if (dto.categoryId) {
      await this.ensureCategoryExists(dto.categoryId);
    }

    try {
      return await this.prisma.service.update({
        where: { id },
        data: dto,
      });
    } catch (error) {
      throw this.mapKnownError(error);
    }
  }

  async remove(id: string): Promise<void> {
    await this.findByIdOrThrow(id);
    await this.prisma.service.delete({ where: { id } });
  }

  private mapService(service: ServiceWithRawImages): ServiceWithMappedImages {
    return {
      ...service,
      images: service.images.map((image) => mapServiceImage(image)),
    };
  }

  private async ensureCategoryExists(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      throw new NotFoundException('Указанная категория не найдена');
    }
  }

  private mapKnownError(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException('Услуга с таким slug уже существует');
    }
    return error as Error;
  }
}
