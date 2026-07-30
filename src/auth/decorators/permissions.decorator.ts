import { SetMetadata } from '@nestjs/common';
import { PermissionCode } from '../../common/constants/permissions.constant';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Требуемые permissions для маршрута. Проверяются PermissionsGuard по актуальным
 * данным из БД (роли пользователя → role_permissions), а не по JWT. Несколько
 * кодов трактуются как «И» — нужны все перечисленные.
 */
export const Permissions = (...permissions: PermissionCode[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
