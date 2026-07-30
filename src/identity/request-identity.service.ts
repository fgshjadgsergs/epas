import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AppConfig } from '../config/configuration';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { AnonymousSessionService } from './anonymous-session.service';

/** Разрешённая личность запроса: авторизованный пользователь и/или аноним-сессия. */
export interface RequestIdentity {
  userId: string | null;
  anonymousSessionId: string;
}

export const ANON_CART_COOKIE = 'kp_cart_sid';
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Единая точка определения владельца запроса для корзины и confirm.
 *
 * - userId: из уже провалидированного JWT (OptionalJwtAuthGuard кладёт req.user);
 * - anonymousSessionId: из подписанного httpOnly-cookie; при отсутствии/подделке
 *   выпускается новый и ставится Set-Cookie (ротация невалидного токена).
 *
 * Cookie: httpOnly, sameSite=lax (не отправляется при cross-site POST — базовая
 * CSRF-защита), secure в production. Токен не читается JS и не хранится в
 * localStorage.
 */
@Injectable()
export class RequestIdentityService {
  private readonly isProduction: boolean;

  constructor(
    private readonly anon: AnonymousSessionService,
    configService: ConfigService<AppConfig, true>,
  ) {
    this.isProduction = configService.get('nodeEnv', { infer: true }) === 'production';
  }

  /**
   * Возвращает личность, при необходимости выпуская новую анонимную сессию и
   * записывая cookie в ответ. Всегда выдаёт валидный anonymousSessionId.
   */
  resolve(req: Request, res: Response): RequestIdentity {
    const user = (req as Request & { user?: AuthenticatedUser }).user;
    const userId = user?.id ?? null;

    const existing = this.anon.verify(this.readCookie(req, ANON_CART_COOKIE));
    if (existing) {
      return { userId, anonymousSessionId: existing };
    }

    const sessionId = this.anon.createSessionId();
    res.cookie(ANON_CART_COOKIE, this.anon.sign(sessionId), {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProduction,
      maxAge: ONE_YEAR_MS,
      path: '/',
    });
    return { userId, anonymousSessionId: sessionId };
  }

  /** Только чтение личности без выпуска cookie (для контекста без Response). */
  resolveReadOnly(req: Request): RequestIdentity | null {
    const user = (req as Request & { user?: AuthenticatedUser }).user;
    const userId = user?.id ?? null;
    const existing = this.anon.verify(this.readCookie(req, ANON_CART_COOKIE));
    if (!existing && !userId) return null;
    return { userId, anonymousSessionId: existing ?? '' };
  }

  /** Ручной парсинг cookie-заголовка — без зависимости cookie-parser. */
  private readCookie(req: Request, name: string): string | undefined {
    const header = req.headers.cookie;
    if (!header) return undefined;
    for (const part of header.split(';')) {
      const idx = part.indexOf('=');
      if (idx === -1) continue;
      if (part.slice(0, idx).trim() === name) {
        return decodeURIComponent(part.slice(idx + 1).trim());
      }
    }
    return undefined;
  }
}
