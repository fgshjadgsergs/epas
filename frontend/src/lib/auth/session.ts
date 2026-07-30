/**
 * Клиентская сессия.
 *
 * access token хранится ТОЛЬКО в памяти этого модуля — не в localStorage/
 * sessionStorage/IndexedDB/JS-cookie. refresh token браузер держит в httpOnly-
 * cookie и присылает автоматически (credentials: 'include') — JS его не видит.
 *
 * После полной перезагрузки страницы память пуста: приложение восстанавливает
 * сессию одним refresh-запросом (bootstrap). refreshSession — single-flight:
 * параллельные 401 инициируют ровно одну ротацию.
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export interface SessionUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  roles: string[];
  permissions: string[];
}

export interface SessionData {
  accessToken: string;
  user: SessionUser;
}

let accessToken: string | null = null;
let inflight: Promise<SessionData | null> | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

/** Применить сессию после успешного login/register. */
export function setSession(data: SessionData): void {
  accessToken = data.accessToken;
}

/** Забыть access token в памяти (logout / провал refresh). */
export function clearAccessToken(): void {
  accessToken = null;
}

/**
 * Ротация сессии по refresh-cookie. Single-flight: пока запрос в полёте, все
 * вызовы получают тот же Promise, поэтому пачка одновременных 401 не рождает
 * несколько ротаций. Возвращает новую сессию или null (аноним/протухший refresh).
 */
export function refreshSession(): Promise<SessionData | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (inflight) return inflight;
  inflight = doRefresh().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function doRefresh(): Promise<SessionData | null> {
  try {
    const res = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      accessToken = null;
      return null;
    }
    const data = (await res.json()) as SessionData;
    accessToken = data.accessToken ?? null;
    return accessToken ? data : null;
  } catch {
    accessToken = null;
    return null;
  }
}

const LEGACY_KEYS = ['pp_access_token', 'pp_refresh_token'];

/**
 * Одноразовая чистка старых demo-ключей из localStorage: раньше здесь лежали
 * access/refresh токены. Их больше не читаем для авторизации — только удаляем,
 * чтобы не оставались на диске после production-rollout.
 */
export function clearLegacyAuthStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    for (const key of LEGACY_KEYS) window.localStorage.removeItem(key);
  } catch {
    // приватный режим / недоступный storage — не критично
  }
}
