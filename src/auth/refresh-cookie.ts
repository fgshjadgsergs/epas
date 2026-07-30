import type { Request, Response } from 'express';

/**
 * httpOnly refresh-cookie: refresh token недоступен JS (защита от кражи через
 * XSS). Отправляется браузером только на auth-эндпоинты (узкий Path), host-only
 * (без Domain), Secure на production/staging-сборке, SameSite=Lax (web и api —
 * один site, поэтому cross-subdomain fetch cookie получает; при этом cross-site
 * POST её не несёт — базовая CSRF-защита).
 */
export const REFRESH_COOKIE_NAME = 'kp_refresh';

export interface RefreshCookieConfig {
  /** Secure-флаг: true на production-сборке (в т.ч. staging). */
  secure: boolean;
  /** Узкий путь, совместимый с refresh/logout (напр. /api/v1/auth). */
  path: string;
  /** Срок жизни cookie в мс (синхронно с server refresh expiry). */
  maxAgeMs: number;
}

export function setRefreshCookie(res: Response, token: string, cfg: RefreshCookieConfig): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: cfg.secure,
    sameSite: 'lax',
    path: cfg.path,
    maxAge: cfg.maxAgeMs,
  });
}

/** Очистка cookie теми же атрибутами (иначе браузер её не удалит). */
export function clearRefreshCookie(res: Response, cfg: Omit<RefreshCookieConfig, 'maxAgeMs'>): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: cfg.secure,
    sameSite: 'lax',
    path: cfg.path,
  });
}

/** Ручной парсинг Cookie-заголовка — без зависимости cookie-parser. */
export function readRefreshCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === REFRESH_COOKIE_NAME) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return undefined;
}
