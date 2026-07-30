import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';

/**
 * Подписанная анонимная сессия для серверной корзины.
 *
 * Токен = `<sessionId>.<hmac>`, где hmac = HMAC-SHA256(key, sessionId). Ключ
 * выводится из JWT_ACCESS_SECRET с доменным разделителем (HKDF-подобно), чтобы
 * не заводить отдельный обязательный env-var, но и не переиспользовать секрет
 * как есть. Подмена sessionId невозможна без ключа: verify отвергает любой
 * токен с невалидной подписью.
 *
 * Токен живёт в httpOnly-cookie (не в localStorage) — недоступен JS, а значит
 * защищён от кражи через XSS.
 */
@Injectable()
export class AnonymousSessionService {
  private readonly key: Buffer;

  constructor(configService: ConfigService<AppConfig, true>) {
    const jwtSecret = configService.get('jwt.accessSecret', { infer: true });
    // Доменное разделение: ключ корзины != ключ подписи JWT.
    this.key = createHmac('sha256', jwtSecret).update('anon-cart-session/v1').digest();
  }

  /** Новый случайный идентификатор сессии (UUIDv4). */
  createSessionId(): string {
    return randomUUID();
  }

  /** Подписанный токен для cookie. */
  sign(sessionId: string): string {
    return `${sessionId}.${this.mac(sessionId)}`;
  }

  /**
   * Проверка токена. Возвращает sessionId при валидной подписи, иначе null.
   * Сравнение подписи — константное по времени.
   */
  verify(token: string | undefined | null): string | null {
    if (!token || typeof token !== 'string') return null;
    const dot = token.lastIndexOf('.');
    if (dot <= 0) return null;
    const sessionId = token.slice(0, dot);
    const providedMac = token.slice(dot + 1);
    // Ограничение формы: sessionId — UUID, не произвольная строка.
    if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return null;
    const expected = this.mac(sessionId);
    if (providedMac.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(providedMac), Buffer.from(expected))) return null;
    return sessionId;
  }

  private mac(sessionId: string): string {
    return createHmac('sha256', this.key).update(sessionId).digest('base64url');
  }
}
