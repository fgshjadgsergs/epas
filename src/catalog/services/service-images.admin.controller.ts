import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { PERMISSION_CODES } from '../../common/constants/permissions.constant';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { ServicesService } from './services.service';
import { UpdateServiceImageDto } from './dto/update-service-image.dto';

const IMAGE_SIZE_LIMIT_BYTES = 20 * 1024 * 1024;

/**
 * Управление изображениями услуги (PUBLIC catalog images) поверх существующего
 * Files/S3/ServiceImage workflow. Отдельный контекст от PRIVATE artwork-файлов.
 * Ответы — safe DTO (без bucket/storageKey/визибилити). Доступ — catalog.manage.
 */
@ApiTags('admin/service-images')
@ApiBearerAuth()
@Controller('admin/services/:serviceId/images')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions(PERMISSION_CODES.CATALOG_MANAGE)
export class ServiceImagesAdminController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  // Загрузка изображения каталога (буферизация + S3): свой лимит (F-2).
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Загрузить и прикрепить изображение к услуге' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: IMAGE_SIZE_LIMIT_BYTES } }))
  upload(
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
    @Body('alt') alt?: string,
  ) {
    return this.servicesService.addImage(serviceId, file, user, alt);
  }

  @Patch(':imageId')
  @ApiOperation({ summary: 'Изменить alt / порядок / основное изображение' })
  update(
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Body() dto: UpdateServiceImageDto,
  ) {
    return this.servicesService.updateImage(serviceId, imageId, dto);
  }

  @Delete(':imageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Открепить изображение от услуги' })
  async remove(
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ): Promise<void> {
    await this.servicesService.removeImage(serviceId, imageId);
  }
}
