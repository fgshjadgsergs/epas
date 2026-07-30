import { BadRequestException, ConflictException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { OffsetPaginatedResult, OffsetPaginationQueryDto } from '../../common/dto/offset-pagination.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllPublic(query: OffsetPaginationQueryDto): Promise<OffsetPaginatedResult<Prisma.CategoryGetPayload<object>>> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
        skip: offset,
        take: limit,
      }),
      this.prisma.category.count({ where: { isActive: true } }),
    ]);

    return { items, meta: { limit, offset, total } };
  }

  async findBySlugPublic(slug: string) {
    // F-9: различаем отсутствие (404) и деактивацию (410 Gone), чтобы frontend
    // не воскрешал снятую категорию из статических данных.
    const category = await this.prisma.category.findFirst({
      where: { slug },
    });
    if (!category) {
      throw new NotFoundException('Категория не найдена');
    }
    if (!category.isActive) {
      throw new GoneException('Категория снята с публикации');
    }
    return category;
  }

  async findServicesBySlugPublic(slug: string) {
    const category = await this.findBySlugPublic(slug);
    return this.prisma.service.findMany({
      where: { categoryId: category.id, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    });
  }

  async findAllForAdmin() {
    const categories = await this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      include: { _count: { select: { services: true, children: true } } },
    });
    // Плоский safe-DTO: агрегаты числом, без вложенных сущностей.
    return categories.map(({ _count, ...category }) => ({
      ...category,
      serviceCount: _count.services,
      childrenCount: _count.children,
    }));
  }

  async findByIdForAdmin(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { services: true, children: true } } },
    });
    if (!category) {
      throw new NotFoundException('Категория не найдена');
    }
    const { _count, ...rest } = category;
    return { ...rest, serviceCount: _count.services, childrenCount: _count.children };
  }

  async findByIdOrThrow(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Категория не найдена');
    }
    return category;
  }

  async create(dto: CreateCategoryDto) {
    if (dto.parentId) {
      await this.findByIdOrThrow(dto.parentId);
    }

    try {
      return await this.prisma.category.create({
        data: {
          parentId: dto.parentId,
          slug: dto.slug,
          title: dto.title,
          description: dto.description,
          isActive: dto.isActive ?? true,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
    } catch (error) {
      throw this.mapKnownError(error);
    }
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findByIdOrThrow(id);

    if (dto.parentId) {
      await this.findByIdOrThrow(dto.parentId);
      await this.ensureNoCycle(id, dto.parentId);
    }

    try {
      return await this.prisma.category.update({
        where: { id },
        data: dto,
      });
    } catch (error) {
      throw this.mapKnownError(error);
    }
  }

  async remove(id: string): Promise<void> {
    await this.findByIdOrThrow(id);

    const childrenCount = await this.prisma.category.count({ where: { parentId: id } });
    if (childrenCount > 0) {
      throw new BadRequestException('Невозможно удалить категорию с подкатегориями');
    }

    const servicesCount = await this.prisma.service.count({ where: { categoryId: id } });
    if (servicesCount > 0) {
      throw new BadRequestException('Невозможно удалить категорию, содержащую услуги');
    }

    await this.prisma.category.delete({ where: { id } });
  }

  /**
   * Walks the ancestor chain starting at `newParentId` and rejects the move
   * if `categoryId` itself shows up — that would turn the tree into a cycle
   * (a category can't become its own descendant's child).
   */
  private async ensureNoCycle(categoryId: string, newParentId: string): Promise<void> {
    let currentId: string | null = newParentId;
    const visited = new Set<string>();

    while (currentId) {
      if (currentId === categoryId) {
        throw new BadRequestException(
          'Невозможно назначить родителя: это создаст цикл в дереве категорий',
        );
      }
      if (visited.has(currentId)) {
        break;
      }
      visited.add(currentId);

      const current: { parentId: string | null } | null = await this.prisma.category.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });
      currentId = current?.parentId ?? null;
    }
  }

  private mapKnownError(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException('Категория с таким slug уже существует');
    }
    return error as Error;
  }
}
