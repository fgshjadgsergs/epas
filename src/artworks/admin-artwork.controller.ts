import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { PERMISSION_CODES } from '../common/constants/permissions.constant';
import { AdminArtworkService } from './admin-artwork.service';
import { ListAdminArtworksDto } from './dto/list-admin-artworks.dto';
import { ChangeArtworkStatusDto } from './dto/change-artwork-status.dto';

/**
 * Административные операции с макетами. Доступ по permissions из БД:
 * чтение/скачивание — artwork.read, проверка — artwork.review.
 */
@ApiTags('admin/artworks')
@ApiBearerAuth()
@Controller('admin/artworks')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminArtworkController {
  constructor(private readonly adminArtworks: AdminArtworkService) {}

  @Get()
  @Permissions(PERMISSION_CODES.ARTWORK_READ)
  @ApiOperation({ summary: 'Список макетов с фильтрами (createdAt desc)' })
  @ApiResponse({ status: 403, description: 'Недостаточно прав' })
  list(@Query() query: ListAdminArtworksDto) {
    return this.adminArtworks.list(query);
  }

  @Get(':artworkId')
  @Permissions(PERMISSION_CODES.ARTWORK_READ)
  @ApiOperation({ summary: 'Детали макета: история, allowedTransitions' })
  @ApiResponse({ status: 404, description: 'Макет не найден' })
  getOne(@Param('artworkId', ParseUUIDPipe) artworkId: string) {
    return this.adminArtworks.getOne(artworkId);
  }

  @Get(':artworkId/download')
  @Permissions(PERMISSION_CODES.ARTWORK_READ)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Короткоживущая ссылка на скачивание' })
  download(@Param('artworkId', ParseUUIDPipe) artworkId: string) {
    return this.adminArtworks.downloadUrl(artworkId);
  }

  @Get(':artworkId/preview')
  @Permissions(PERMISSION_CODES.ARTWORK_READ)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Короткоживущая inline preview-ссылка' })
  preview(@Param('artworkId', ParseUUIDPipe) artworkId: string) {
    return this.adminArtworks.previewUrl(artworkId);
  }

  @Patch(':artworkId/status')
  @Permissions(PERMISSION_CODES.ARTWORK_REVIEW)
  @ApiOperation({ summary: 'Проверка макета: смена статуса по карте переходов' })
  @ApiResponse({ status: 400, description: 'Нужен комментарий / неизвестный статус' })
  @ApiResponse({ status: 409, description: 'Недопустимый переход или статус не изменился' })
  changeStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('artworkId', ParseUUIDPipe) artworkId: string,
    @Body() dto: ChangeArtworkStatusDto,
  ) {
    return this.adminArtworks.changeStatus(artworkId, user.id, dto);
  }
}
