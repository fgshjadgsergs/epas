import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { PERMISSION_CODES } from '../../common/constants/permissions.constant';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

/**
 * Управление услугами каталога. Доступ — по permission catalog.manage
 * (PermissionsGuard). Цена и калькулятор здесь не редактируются: priceFrom/
 * калькулятор относятся к Pricing Engine. Публичный API услуг не меняется.
 */
@ApiTags('admin/services')
@ApiBearerAuth()
@Controller('admin/services')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions(PERMISSION_CODES.CATALOG_MANAGE)
export class ServicesAdminController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  @ApiOperation({ summary: 'Список всех услуг (включая неактивные) с категорией и индикатором калькулятора' })
  findAll() {
    return this.servicesService.findAllForAdmin();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Услуга по id для редактирования (изображения, калькулятор read-only)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.findByIdForAdmin(id);
  }

  @Post()
  @ApiOperation({ summary: 'Создать услугу' })
  create(@Body() dto: CreateServiceDto) {
    return this.servicesService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить услугу' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateServiceDto) {
    return this.servicesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить услугу' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.servicesService.remove(id);
  }
}
