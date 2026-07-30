import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';

/**
 * Приватные/авторизованные ответы не должны кэшироваться shared/browser cache
 * как публичные данные. Ставим Cache-Control: no-store на чувствительные
 * префиксы (auth/users/cart/orders/admin/artworks/files), не трогая публичный
 * catalog/pricing GET (его кэширует Next ISR по своим правилам).
 */
const PRIVATE_SEGMENTS = ['/auth/', '/auth', '/users/', '/cart', '/orders', '/admin/', '/artworks', '/files'];

@Injectable()
export class PrivateCacheInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    // path без query — решение принимаем по маршруту, не по значениям.
    const path = (req.originalUrl || req.url).split('?')[0];
    if (PRIVATE_SEGMENTS.some((seg) => path.includes(seg))) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    return next.handle();
  }
}
