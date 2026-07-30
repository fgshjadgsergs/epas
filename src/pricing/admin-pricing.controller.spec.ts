import { Reflector } from '@nestjs/core';
import { AdminPricingController } from './admin-pricing.controller';
import { AdminPricingService } from './admin-pricing.service';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions.constant';

/**
 * Контроллер admin/pricing: делегирование сервису и корректные permissions на
 * маршрутах (read/dry-run — pricing.read, правки — draft.edit, публикация —
 * publish). actorId берётся из сессии, а не из тела.
 */
describe('AdminPricingController', () => {
  let service: jest.Mocked<
    Pick<
      AdminPricingService,
      | 'listDefinitions'
      | 'getDefinition'
      | 'listPriceLists'
      | 'getPriceList'
      | 'cloneDraft'
      | 'createRule'
      | 'updateRule'
      | 'deleteRule'
      | 'validateDraft'
      | 'dryRun'
      | 'publishDraft'
      | 'listAudit'
    >
  >;
  let controller: AdminPricingController;
  const user = { id: 'admin-1', email: 'a@e.co', roles: ['ADMIN'] };

  beforeEach(() => {
    service = {
      listDefinitions: jest.fn(),
      getDefinition: jest.fn(),
      listPriceLists: jest.fn(),
      getPriceList: jest.fn(),
      cloneDraft: jest.fn(),
      createRule: jest.fn(),
      updateRule: jest.fn(),
      deleteRule: jest.fn(),
      validateDraft: jest.fn(),
      dryRun: jest.fn(),
      publishDraft: jest.fn(),
      listAudit: jest.fn(),
    };
    controller = new AdminPricingController(service as unknown as AdminPricingService);
  });

  it('clone/create/publish берут actorId из сессии, а не из тела', () => {
    controller.cloneDraft(user, 'pl-1');
    expect(service.cloneDraft).toHaveBeenCalledWith('pl-1', 'admin-1');

    controller.createRule(user, 'pl-1', { kind: 'SURCHARGE_FLAT', amountMinor: 100, expectedRevision: 0 } as never);
    expect(service.createRule).toHaveBeenCalledWith('pl-1', expect.any(Object), 'admin-1');

    controller.publish(user, 'pl-1', { expectedRevision: 3 } as never);
    expect(service.publishDraft).toHaveBeenCalledWith('pl-1', 3, 'admin-1');
  });

  it('delete передаёт expectedRevision из тела', () => {
    controller.deleteRule(user, 'pl-1', 'r-1', { expectedRevision: 5 } as never);
    expect(service.deleteRule).toHaveBeenCalledWith('pl-1', 'r-1', 5, 'admin-1');
  });

  const perms = (handler: (...args: never[]) => unknown) =>
    new Reflector().get<string[]>(PERMISSIONS_KEY, handler);

  it('read/dry-run/validate/audit требуют pricing.read', () => {
    expect(perms(controller.listDefinitions)).toEqual([PERMISSION_CODES.PRICING_READ]);
    expect(perms(controller.getPriceList)).toEqual([PERMISSION_CODES.PRICING_READ]);
    expect(perms(controller.dryRun)).toEqual([PERMISSION_CODES.PRICING_READ]);
    expect(perms(controller.validate)).toEqual([PERMISSION_CODES.PRICING_READ]);
    expect(perms(controller.listAudit)).toEqual([PERMISSION_CODES.PRICING_READ]);
  });

  it('правки требуют pricing.draft.edit', () => {
    expect(perms(controller.cloneDraft)).toEqual([PERMISSION_CODES.PRICING_DRAFT_EDIT]);
    expect(perms(controller.createRule)).toEqual([PERMISSION_CODES.PRICING_DRAFT_EDIT]);
    expect(perms(controller.updateRule)).toEqual([PERMISSION_CODES.PRICING_DRAFT_EDIT]);
    expect(perms(controller.deleteRule)).toEqual([PERMISSION_CODES.PRICING_DRAFT_EDIT]);
  });

  it('публикация требует pricing.publish', () => {
    expect(perms(controller.publish)).toEqual([PERMISSION_CODES.PRICING_PUBLISH]);
  });
});
