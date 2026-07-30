import { Module } from '@nestjs/common';
import { AnonymousSessionService } from './anonymous-session.service';
import { RequestIdentityService } from './request-identity.service';

/**
 * Разрешение личности запроса (анонимная сессия + optional-JWT). Используется
 * корзиной и calculator/confirm — оба стемпят/проверяют владельца snapshot.
 */
@Module({
  providers: [AnonymousSessionService, RequestIdentityService],
  exports: [AnonymousSessionService, RequestIdentityService],
})
export class IdentityModule {}
