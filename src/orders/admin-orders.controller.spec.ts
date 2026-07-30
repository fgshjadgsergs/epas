import { Reflector } from '@nestjs/core';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminOrdersService } from './admin-orders.service';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions.constant';
import { ListAdminOrdersDto, SearchAdminOrdersDto } from './dto/list-admin-orders.dto';

/**
 * Контроллер admin/orders: разделение безопасных фильтров (GET query) и
 * персонального поиска (POST body). Оба пути идут через один сервис-метод.
 */
describe('AdminOrdersController', () => {
  let service: jest.Mocked<Pick<AdminOrdersService, 'listOrders' | 'getOrder' | 'changeStatus'>>;
  let controller: AdminOrdersController;

  beforeEach(() => {
    service = { listOrders: jest.fn(), getOrder: jest.fn(), changeStatus: jest.fn() };
    controller = new AdminOrdersController(service as unknown as AdminOrdersService);
  });

  it('GET listOrders делегирует сервису безопасные фильтры', () => {
    const query: ListAdminOrdersDto = { status: 'NEW', page: 2 } as ListAdminOrdersDto;
    controller.listOrders(query);
    expect(service.listOrders).toHaveBeenCalledWith(query);
  });

  it('POST searchOrders делегирует тому же методу тело с телефоном/email', () => {
    const dto: SearchAdminOrdersDto = { phone: '900', email: 'a@b.co', status: 'NEW' } as SearchAdminOrdersDto;
    controller.searchOrders(dto);
    expect(service.listOrders).toHaveBeenCalledWith(dto);
  });

  it('оба списковых маршрута требуют permission orders.read', () => {
    const reflector = new Reflector();
    const listPerms = reflector.get<string[]>(PERMISSIONS_KEY, controller.listOrders);
    const searchPerms = reflector.get<string[]>(PERMISSIONS_KEY, controller.searchOrders);
    expect(listPerms).toEqual([PERMISSION_CODES.ORDERS_READ]);
    expect(searchPerms).toEqual([PERMISSION_CODES.ORDERS_READ]);
  });

  it('смена статуса берёт actorId из сессии, а не из тела', () => {
    const user = { id: 'mgr-1', email: 'm@e.co', roles: ['MANAGER'] };
    controller.changeStatus(user, 'order-1', { status: 'CANCELLED' });
    expect(service.changeStatus).toHaveBeenCalledWith('order-1', 'mgr-1', { status: 'CANCELLED' });
  });
});
