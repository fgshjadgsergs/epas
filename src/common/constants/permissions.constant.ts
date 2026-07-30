/**
 * Baseline permission codes. Как и роли, permissions живут в БД
 * (`permissions` + `role_permissions`, см. prisma/seed.ts). Этот список только
 * типизирует и документирует коды, которые проверяет PermissionsGuard.
 *
 * SUPER_ADMIN получает все permissions явными grant'ами в seed (цикл «выдать
 * супер-админу все права»), поэтому отдельного bypass в guard нет — доступ
 * держится на данных, а не на хардкоде роли.
 */
export const PERMISSION_CODES = {
  CATALOG_MANAGE: 'catalog.manage',
  FILES_MANAGE: 'files.manage',
  USERS_MANAGE: 'users.manage',
  /** Чтение любого заказа в админке (не только своего). */
  ORDERS_READ: 'orders.read',
  /** Смена статуса заказа по карте допустимых переходов. */
  ORDERS_STATUS_CHANGE: 'orders.status.change',
  /** Чтение прайсов/версий и dry-run (без изменений). */
  PRICING_READ: 'pricing.read',
  /** Редактирование правил DRAFT-прайса (не ACTIVE/ARCHIVED). */
  PRICING_DRAFT_EDIT: 'pricing.draft.edit',
  /** Публикация DRAFT-прайса (перевод в ACTIVE, архивация предыдущего). */
  PRICING_PUBLISH: 'pricing.publish',
  /** Чтение макетов заказов в админке (список/детали/скачивание). */
  ARTWORK_READ: 'artwork.read',
  /** Проверка макетов: смена статуса (в работе/принят/отклонён). */
  ARTWORK_REVIEW: 'artwork.review',
} as const;

export type PermissionCode = (typeof PERMISSION_CODES)[keyof typeof PERMISSION_CODES];
