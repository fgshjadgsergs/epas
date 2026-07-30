import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { PERMISSION_CODES } from '../common/constants/permissions.constant';
import { AdminOrdersService } from './admin-orders.service';
import { ListAdminOrdersDto, SearchAdminOrdersDto } from './dto/list-admin-orders.dto';
import { ChangeOrderStatusDto } from './dto/change-order-status.dto';
import { AdminOrderListResponseDto, AdminOrderResponseDto } from './dto/admin-order-response.dto';

/**
 * Административные операции с заказами. Доступ — по permissions из БД
 * (PermissionsGuard), а не по роли: MANAGER/ADMIN/SUPER_ADMIN. Пользователь
 * видит любой заказ, а не только свой, поэтому эндпоинты вынесены под
 * отдельный префикс и guard.
 */
@ApiTags('admin/orders')
@ApiBearerAuth()
@Controller('admin/orders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminOrdersController {
  constructor(private readonly adminOrders: AdminOrdersService) {}

  @Get()
  @Permissions(PERMISSION_CODES.ORDERS_READ)
  @ApiOperation({ summary: 'Список заказов по безопасным фильтрам (createdAt desc)' })
  @ApiResponse({ status: 200, type: AdminOrderListResponseDto })
  @ApiResponse({ status: 403, description: 'Недостаточно прав' })
  listOrders(@Query() query: ListAdminOrdersDto) {
    return this.adminOrders.listOrders(query);
  }

  @Post('search')
  @HttpCode(200)
  @Permissions(PERMISSION_CODES.ORDERS_READ)
  @ApiOperation({
    summary: 'Поиск заказов по контактам клиента (телефон/email в JSON body)',
    description:
      'Персональные данные передаются только в теле запроса, а не через query string — ' +
      'чтобы не попадать в access/proxy/APM-логи. Права, пагинация, фильтрация, сортировка ' +
      'и формат ответа идентичны GET /admin/orders. Тело запроса не логируется.',
  })
  @ApiResponse({ status: 200, type: AdminOrderListResponseDto })
  @ApiResponse({ status: 403, description: 'Недостаточно прав' })
  searchOrders(@Body() dto: SearchAdminOrdersDto) {
    return this.adminOrders.listOrders(dto);
  }

  @Get(':orderId')
  @Permissions(PERMISSION_CODES.ORDERS_READ)
  @ApiOperation({ summary: 'Любой заказ по id' })
  @ApiResponse({ status: 200, type: AdminOrderResponseDto })
  @ApiResponse({ status: 403, description: 'Недостаточно прав' })
  @ApiResponse({ status: 404, description: 'Заказ не найден' })
  getOrder(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.adminOrders.getOrder(orderId);
  }

  @Patch(':orderId/status')
  @Permissions(PERMISSION_CODES.ORDERS_STATUS_CHANGE)
  @ApiOperation({ summary: 'Сменить статус заказа (переход проверяется по карте)' })
  @ApiResponse({ status: 200, type: AdminOrderResponseDto })
  @ApiResponse({ status: 400, description: 'Неизвестный статус' })
  @ApiResponse({ status: 403, description: 'Недостаточно прав' })
  @ApiResponse({ status: 404, description: 'Заказ не найден' })
  @ApiResponse({ status: 409, description: 'Недопустимый переход или статус не изменился' })
  changeStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: ChangeOrderStatusDto,
  ) {
    // actorId — только из проверенной сессии, не из тела запроса.
    return this.adminOrders.changeStatus(orderId, user.id, dto);
  }
}
