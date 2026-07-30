import { Reflector } from '@nestjs/core';
import { AdminArtworkController } from './admin-artwork.controller';
import { AdminArtworkService } from './admin-artwork.service';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions.constant';

/** Admin artwork routes: permissions + делегирование, reviewer из сессии. */
describe('AdminArtworkController', () => {
  let service: jest.Mocked<Pick<AdminArtworkService, 'list' | 'getOne' | 'downloadUrl' | 'previewUrl' | 'changeStatus'>>;
  let controller: AdminArtworkController;
  const user = { id: 'mgr-1', email: 'm@e.co', roles: ['MANAGER'] };

  beforeEach(() => {
    service = { list: jest.fn(), getOne: jest.fn(), downloadUrl: jest.fn(), previewUrl: jest.fn(), changeStatus: jest.fn() };
    controller = new AdminArtworkController(service as unknown as AdminArtworkService);
  });

  const perms = (h: (...a: never[]) => unknown) => new Reflector().get<string[]>(PERMISSIONS_KEY, h);

  it('read/download/preview требуют artwork.read', () => {
    expect(perms(controller.list)).toEqual([PERMISSION_CODES.ARTWORK_READ]);
    expect(perms(controller.getOne)).toEqual([PERMISSION_CODES.ARTWORK_READ]);
    expect(perms(controller.download)).toEqual([PERMISSION_CODES.ARTWORK_READ]);
    expect(perms(controller.preview)).toEqual([PERMISSION_CODES.ARTWORK_READ]);
  });

  it('смена статуса требует artwork.review', () => {
    expect(perms(controller.changeStatus)).toEqual([PERMISSION_CODES.ARTWORK_REVIEW]);
  });

  it('changeStatus берёт reviewerId из сессии, а не из тела', () => {
    controller.changeStatus(user, 'art-1', { status: 'APPROVED' } as never);
    expect(service.changeStatus).toHaveBeenCalledWith('art-1', 'mgr-1', { status: 'APPROVED' });
  });
});
