import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { OptionalJwtAuthGuard } from '../identity/optional-jwt-auth.guard';
import { RequestIdentityService } from '../identity/request-identity.service';
import { CartService } from './cart.service';
import { AddCartItemDto, CartErrorResponseDto, CartResponseDto } from './dto/cart.dto';

/**
 * API серверной корзины.
 *
 * Доступна анонимам и авторизованным: OptionalJwtAuthGuard заполняет
 * пользователя, если предъявлен Bearer-токен, иначе владельцем становится
 * подписанная анонимная сессия (httpOnly-cookie, ставится автоматически).
 *
 * Цена никогда не принимается от клиента — единственный вход добавления
 * позиции это calculationSnapshotId.
 */
@ApiTags('cart')
@Controller('cart')
@UseGuards(OptionalJwtAuthGuard)
@Throttle({ default: { limit: 120, ttl: 60000 } })
@ApiResponse({ status: 429, description: 'Превышен лимит запросов к корзине' })
export class CartController {
  constructor(
    private readonly cartService: CartService,
    private readonly identity: RequestIdentityService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Текущая корзина владельца (создаётся при первом обращении)' })
  @ApiResponse({ status: 200, type: CartResponseDto })
  getCart(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.cartService.getCart(this.identity.resolve(req, res));
  }

  @Post('items')
  @HttpCode(201)
  @ApiOperation({ summary: 'Добавить подтверждённый расчёт в корзину (принимается только snapshotId)' })
  @ApiResponse({ status: 201, description: 'Позиция добавлена', type: CartResponseDto })
  @ApiResponse({ status: 400, description: 'Некорректное тело запроса', type: CartErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Расчёт принадлежит другой сессии', type: CartErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Расчёт не найден', type: CartErrorResponseDto })
  @ApiResponse({ status: 409, description: 'Валюта расчёта не совпадает с корзиной', type: CartErrorResponseDto })
  @ApiResponse({ status: 422, description: 'Расчёт истёк или отозван', type: CartErrorResponseDto })
  addItem(@Body() dto: AddCartItemDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.cartService.addItem(this.identity.resolve(req, res), dto.calculationSnapshotId);
  }

  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Удалить позицию из своей корзины' })
  @ApiResponse({ status: 200, type: CartResponseDto })
  @ApiResponse({ status: 404, description: 'Позиция не найдена', type: CartErrorResponseDto })
  removeItem(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.cartService.removeItem(this.identity.resolve(req, res), itemId);
  }

  @Delete()
  @ApiOperation({ summary: 'Очистить корзину' })
  @ApiResponse({ status: 200, type: CartResponseDto })
  clear(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.cartService.clear(this.identity.resolve(req, res));
  }

  @Post('merge')
  @HttpCode(200)
  @ApiOperation({ summary: 'Слить анонимную корзину в пользовательскую после входа (идемпотентно)' })
  @ApiResponse({ status: 200, type: CartResponseDto })
  @ApiResponse({ status: 403, description: 'Требуется авторизация', type: CartErrorResponseDto })
  merge(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.cartService.merge(this.identity.resolve(req, res));
  }

  @Post('items/:itemId/refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Пересчитать позицию по актуальному прайсу (создаёт новый snapshot на сервере)' })
  @ApiResponse({ status: 200, type: CartResponseDto })
  @ApiResponse({ status: 404, description: 'Позиция не найдена', type: CartErrorResponseDto })
  @ApiResponse({ status: 422, description: 'Пересчёт невозможен: услуга или прайс недоступны', type: CartErrorResponseDto })
  refreshItem(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.cartService.refreshItem(this.identity.resolve(req, res), itemId);
  }
}
