import { apiFetch, ApiError } from './client';
import type { CurrentUser } from './types';

/**
 * GET /users/me. Если токена нет или он недействителен — возвращает null
 * вместо выброса ошибки (удобно для UI: "не авторизован" — не "сломалось").
 */
export async function getCurrentUser(token: string | null): Promise<CurrentUser | null> {
  if (!token) return null;

  try {
    return await apiFetch<CurrentUser>('users/me', { token });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return null;
    }
    throw error;
  }
}
