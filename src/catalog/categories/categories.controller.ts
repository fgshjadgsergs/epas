import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OffsetPaginationQueryDto } from '../../common/dto/offset-pagination.dto';
import { CategoriesService } from './categories.service';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Список активных категорий' })
  findAll(@Query() query: OffsetPaginationQueryDto) {
    return this.categoriesService.findAllPublic(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Категория по slug' })
  findOne(@Param('slug') slug: string) {
    return this.categoriesService.findBySlugPublic(slug);
  }

  @Get(':slug/services')
  @ApiOperation({ summary: 'Услуги категории по slug категории' })
  findServices(@Param('slug') slug: string) {
    return this.categoriesService.findServicesBySlugPublic(slug);
  }
}
