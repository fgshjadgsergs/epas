/**
 * F-9: публичный lookup услуги/категории по slug различает
 * «нет записи» (404) и «деактивирована» (410 Gone), чтобы frontend не
 * воскрешал снятую сущность из статических данных.
 */
import { GoneException, NotFoundException } from '@nestjs/common';
import { ServicesService } from './services.service';
import { CategoriesService } from '../categories/categories.service';
import type { PrismaService } from '../../database/prisma.service';

describe('F-9: public slug lookup (404 vs 410)', () => {
  describe('ServicesService.findBySlugPublic', () => {
    function make(findFirst: jest.Mock) {
      // findBySlugPublic использует только prisma; storage/files не нужны.
      return new ServicesService(
        { service: { findFirst } } as unknown as PrismaService,
        {} as never,
        {} as never,
      );
    }

    it('активная услуга → возвращается', async () => {
      const svc = make(jest.fn().mockResolvedValue({ id: 's1', slug: 'vizitki', isActive: true, images: [] }));
      await expect(svc.findBySlugPublic('vizitki')).resolves.toMatchObject({ slug: 'vizitki' });
    });

    it('услуги нет вовсе → 404 (страница живёт на статике)', async () => {
      const svc = make(jest.fn().mockResolvedValue(null));
      await expect(svc.findBySlugPublic('nope')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('услуга деактивирована → 410 Gone (не воскрешать из статики)', async () => {
      const svc = make(jest.fn().mockResolvedValue({ id: 's1', slug: 'vizitki', isActive: false, images: [] }));
      await expect(svc.findBySlugPublic('vizitki')).rejects.toBeInstanceOf(GoneException);
    });

    it('lookup идёт без фильтра isActive (чтобы увидеть деактивированную)', async () => {
      const findFirst = jest.fn().mockResolvedValue({ id: 's1', slug: 'vizitki', isActive: true, images: [] });
      await make(findFirst).findBySlugPublic('vizitki');
      expect(findFirst.mock.calls[0][0].where).toEqual({ slug: 'vizitki' });
    });
  });

  describe('CategoriesService.findBySlugPublic', () => {
    function make(findFirst: jest.Mock) {
      return new CategoriesService({ category: { findFirst } } as unknown as PrismaService);
    }

    it('активная категория → возвращается', async () => {
      const cat = make(jest.fn().mockResolvedValue({ id: 'c1', slug: 'kalendari', isActive: true }));
      await expect(cat.findBySlugPublic('kalendari')).resolves.toMatchObject({ slug: 'kalendari' });
    });

    it('категории нет → 404', async () => {
      const cat = make(jest.fn().mockResolvedValue(null));
      await expect(cat.findBySlugPublic('nope')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('категория деактивирована → 410 Gone', async () => {
      const cat = make(jest.fn().mockResolvedValue({ id: 'c1', slug: 'kalendari', isActive: false }));
      await expect(cat.findBySlugPublic('kalendari')).rejects.toBeInstanceOf(GoneException);
    });
  });
});
