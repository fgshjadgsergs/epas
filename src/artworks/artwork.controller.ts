import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ArtworkService } from './artwork.service';
import { AttachArtworkDto } from './dto/attach-artwork.dto';

/**
 * Клиентский workflow макетов. Доступ — только владелец заказа (ownership по
 * order.userId); чужой ресурс отдаёт 404. Только JwtAuthGuard: право доступа
 * определяется владением заказом, а не ролью.
 */
@ApiTags('artworks')
@ApiBearerAuth()
@Controller('orders/:orderId/items/:orderItemId/artworks')
// Файловые операции макетов (presign download/preview, привязка) — свой лимит
// поверх глобального throttler (F-2). Семантика — per-IP.
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@UseGuards(JwtAuthGuard)
export class ArtworkController {
  constructor(private readonly artworks: ArtworkService) {}

  @Get()
  @ApiOperation({ summary: 'Список макетов позиции + можно ли загрузить новую версию' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('orderItemId', ParseUUIDPipe) orderItemId: string,
  ) {
    return this.artworks.listForItem(user.id, orderId, orderItemId);
  }

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Привязать/заменить макет (первый — v1, замена — v+1)' })
  attach(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('orderItemId', ParseUUIDPipe) orderItemId: string,
    @Body() dto: AttachArtworkDto,
  ) {
    return this.artworks.attach(user.id, orderId, orderItemId, dto);
  }

  @Post(':artworkId/withdraw')
  @HttpCode(200)
  @ApiOperation({ summary: 'Отозвать макет (UPLOADED → WITHDRAWN)' })
  withdraw(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('orderItemId', ParseUUIDPipe) orderItemId: string,
    @Param('artworkId', ParseUUIDPipe) artworkId: string,
  ) {
    return this.artworks.withdraw(user.id, orderId, orderItemId, artworkId);
  }

  @Get(':artworkId/download')
  @ApiOperation({ summary: 'Короткоживущая ссылка на скачивание (attachment)' })
  download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('orderItemId', ParseUUIDPipe) orderItemId: string,
    @Param('artworkId', ParseUUIDPipe) artworkId: string,
  ) {
    return this.artworks.downloadUrl(user.id, orderId, orderItemId, artworkId);
  }

  @Get(':artworkId/preview')
  @ApiOperation({ summary: 'Короткоживущая inline preview-ссылка (безопасные MIME)' })
  preview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('orderItemId', ParseUUIDPipe) orderItemId: string,
    @Param('artworkId', ParseUUIDPipe) artworkId: string,
  ) {
    return this.artworks.previewUrl(user.id, orderId, orderItemId, artworkId);
  }
}
