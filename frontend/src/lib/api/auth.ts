import { apiFetch } from './client';
import { clearAccessToken, getAccessToken, setSession, type SessionData } from '@/lib/auth/session';

export interface RegisterInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

/**
 * Login/register: backend ставит refresh token в httpOnly-cookie (Set-Cookie),
 * а в JSON отдаёт только короткоживущий access token + профиль. credentials:
 * 'include' обязателен, чтобы браузер принял cookie. access храним лишь в памяти.
 */
export async function login(input: LoginInput): Promise<SessionData> {
  const data = await apiFetch<SessionData>('auth/login', { method: 'POST', body: input, credentials: 'include' });
  setSession(data);
  return data;
}

export async function register(input: RegisterInput): Promise<SessionData> {
  const data = await apiFetch<SessionData>('auth/register', { method: 'POST', body: input, credentials: 'include' });
  setSession(data);
  return data;
}

/** Logout: отзывает refresh-сессию на сервере и чистит cookie; затем — память. */
export async function logout(): Promise<void> {
  try {
    await apiFetch<void>('auth/logout', { method: 'POST', credentials: 'include' });
  } finally {
    clearAccessToken();
  }
}

/**
 * Совместимость с существующими вызовами по всему приложению: access token
 * теперь берётся из памяти сессии (не из localStorage). getRefreshToken удалён
 * намеренно — refresh недоступен JS.
 */
export const tokenStorage = {
  getAccessToken(): string | null {
    return getAccessToken();
  },
  clear(): void {
    clearAccessToken();
  },
};
