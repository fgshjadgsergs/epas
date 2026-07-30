import { Module } from '@nestjs/common';
import { RolesModule } from '../roles/roles.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminOrdersService } from './admin-orders.service';

/**
 * Заказы: клиентское оформление (Cart → Order) и административные операции
 * (чтение любого заказа, смена статуса). RolesModule — для PermissionsGuard,
 * который сверяет permissions admin-эндпоинтов с БД.
 */
@Module({
  imports: [RolesModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService, AdminOrdersService],
  exports: [OrdersService, AdminOrdersService],
})
export class OrdersModule {}
