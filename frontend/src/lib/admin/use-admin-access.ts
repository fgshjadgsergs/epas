'use client';

import { useAuth } from '@/lib/auth/auth-context';
import { hasAnyAdminAccess } from './access';

/**
 * Состояние доступа к панели для UX-гейтинга поверх единой сессии (AuthProvider).
 *
 * - loading — сессия ещё восстанавливается (bootstrap): не мигаем ADMIN UI;
 * - anon — сессии нет, отправляем на вход;
 * - granted — permissions удовлетворяют предикату раздела;
 * - forbidden — вошёл, но нужного права нет (экран «Нет доступа»).
 *
 * Это НЕ защита: backend PermissionsGuard проверяет право из БД на каждом
 * запросе; настоящий отказ приходит как 403.
 */
export type AdminAccessState =
  | { status: 'loading' }
  | { status: 'anon' }
  | { status: 'granted'; roles: string[]; permissions: string[] }
  | { status: 'forbidden' }
  | { status: 'error' };

/**
 * @param predicate permissions → допущен ли (UX-гейт раздела). По умолчанию —
 * любой admin-доступ. Для /admin/catalog передаётся canManageCatalog.
 */
export function useAdminAccess(
  predicate: (permissions: string[]) => boolean = hasAnyAdminAccess,
): AdminAccessState {
  const { status, permissions, roles } = useAuth();

  if (status === 'loading') return { status: 'loading' };
  if (status === 'anonymous') return { status: 'anon' };
  return predicate(permissions) ? { status: 'granted', roles, permissions } : { status: 'forbidden' };
}
