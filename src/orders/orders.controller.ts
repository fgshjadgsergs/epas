import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersDto } from './dto/list-orders.dto';
import { OrderListResponseDto, OrderResponseDto } from './dto/order-response.dto';

/**
 * Заказы — только для авторизованных. Пользователь создаёт заказ из своей
 * корзины и видит только свои заказы; чужой заказ отдаёт 404.
 */
@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 12, ttl: 60000 } })
  @ApiOperation({ summary: 'Оформить заказ из активной корзины (состав и цены — из корзины, не от клиента)' })
  @ApiResponse({ status: 201, description: 'Заказ создан', type: OrderResponseDto })
  @ApiResponse({ status: 400, description: 'Некорректные контактные данные' })
  @ApiResponse({ status: 401, description: 'Требуется авторизация' })
  @ApiResponse({ status: 409, description: 'Несовпадение валюты позиции' })
  @ApiResponse({ status: 422, description: 'Корзина пуста / позиция недействительна / демо-заказ запрещён' })
  @ApiResponse({ status: 429, description: 'Превышен лимит оформления' })
  createOrder(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Список своих заказов (createdAt desc, пагинация)' })
  @ApiResponse({ status: 200, type: OrderListResponseDto })
  listOrders(@CurrentUser() user: AuthenticatedUser, @Query() query: ListOrdersDto) {
    return this.ordersService.listOrders(user.id, query.page ?? 1, query.pageSize ?? 20);
  }

  @Get(':orderId')
  @ApiOperation({ summary: 'Свой заказ по id (чужой — 404)' })
  @ApiResponse({ status: 200, type: OrderResponseDto })
  @ApiResponse({ status: 404, description: 'Заказ не найден' })
  getOrder(@CurrentUser() user: AuthenticatedUser, @Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.ordersService.getOrder(user.id, orderId);
  }
}
