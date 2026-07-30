import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { PERMISSION_CODES } from '../../common/constants/permissions.constant';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

/**
 * Управление категориями каталога. Доступ — по permission catalog.manage из БД
 * (PermissionsGuard), а не по роли: его имеют ADMIN и CONTENT_MANAGER (+ SUPER_ADMIN
 * через grant-all). Публичный API категорий не меняется.
 */
@ApiTags('admin/categories')
@ApiBearerAuth()
@Controller('admin/categories')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions(PERMISSION_CODES.CATALOG_MANAGE)
export class CategoriesAdminController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Список всех категорий (включая неактивные) с числом услуг' })
  findAll() {
    return this.categoriesService.findAllForAdmin();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Категория по id для редактирования' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.findByIdForAdmin(id);
  }

  @Post()
  @ApiOperation({ summary: 'Создать категорию' })
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить категорию' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить категорию (только пустую: без подкатегорий и услуг)' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.categoriesService.remove(id);
  }
}
