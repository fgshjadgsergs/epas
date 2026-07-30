/**
 * UX-гейтинг админ-панели по PERMISSIONS (коды прав из БД, приходят в
 * /users/me и session DTO).
 *
 * ВАЖНО: это только навигация/кнопки. Единственный источник безопасности —
 * backend PermissionsGuard, который проверяет право из БД на КАЖДОМ запросе:
 * отзыв права в БД лишает доступа немедленно, без нового JWT. Скрытая ссылка не
 * заменяет обработку 403 от API.
 */

const has = (permissions: string[] | null | undefined, code: string): boolean =>
  !!permissions && permissions.includes(code);

/** Разделы панели по конкретным правам. */
export const canAccessOrders = (permissions?: string[] | null): boolean => has(permissions, 'orders.read');
export const canAccessPricing = (permissions?: string[] | null): boolean => has(permissions, 'pricing.read');
export const canAccessArtworks = (permissions?: string[] | null): boolean => has(permissions, 'artwork.read');
export const canManageCatalog = (permissions?: string[] | null): boolean => has(permissions, 'catalog.manage');

/** Права на правку/публикацию прайсов. */
export const canEditPricing = (permissions?: string[] | null): boolean => has(permissions, 'pricing.draft.edit');
export const canPublishPricing = (permissions?: string[] | null): boolean => has(permissions, 'pricing.publish');

/** Любой admin-раздел доступен — показываем панель вообще. */
export function hasAnyAdminAccess(permissions?: string[] | null): boolean {
  return (
    canAccessOrders(permissions) ||
    canAccessPricing(permissions) ||
    canAccessArtworks(permissions) ||
    canManageCatalog(permissions)
  );
}

export const ADMIN_ORDERS_PATH = '/admin/orders/';
export const ADMIN_PRICING_PATH = '/admin/pricing/';
