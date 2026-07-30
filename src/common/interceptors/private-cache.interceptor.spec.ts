import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { PrivateCacheInterceptor } from './private-cache.interceptor';

function ctx(url: string, res: { setHeader: jest.Mock }): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ originalUrl: url, url }), getResponse: () => res }),
  } as unknown as ExecutionContext;
}
const nextHandler = (): CallHandler => ({ handle: () => of(null) });

describe('PrivateCacheInterceptor', () => {
  const run = (url: string) => {
    const res = { setHeader: jest.fn() };
    new PrivateCacheInterceptor().intercept(ctx(url, res), nextHandler()).subscribe();
    return res.setHeader;
  };

  it.each([
    '/api/v1/auth/refresh',
    '/api/v1/users/me',
    '/api/v1/cart',
    '/api/v1/orders/123',
    '/api/v1/admin/orders',
    '/api/v1/artworks/x/preview',
    '/api/v1/files/my?page=1',
  ])('ставит no-store на приватный путь %s', (url) => {
    const setHeader = run(url);
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', expect.stringContaining('no-store'));
  });

  it.each(['/api/v1/categories', '/api/v1/services/vizitki', '/api/v1/health'])(
    'НЕ трогает публичный путь %s (кэш каталога не ломаем)',
    (url) => {
      const setHeader = run(url);
      expect(setHeader).not.toHaveBeenCalled();
    },
  );
});
