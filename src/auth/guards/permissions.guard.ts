import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';
import { RolesService } from '../../roles/roles.service';
import { PermissionCode } from '../../common/constants/permissions.constant';

/**
 * Проверка доступа по permissions из БД.
 *
 * Работает поверх JwtAuthGuard: тот через JwtStrategy уже проверил, что сессия
 * действительна (пользователь существует, isActive, tokenVersion совпадает) и
 * положил в req.user личность с DB-ролями. Этот guard догружает актуальные
 * permission-коды пользователя из БД и сверяет с @Permissions().
 *
 * Права берутся только из БД: JWT permission-коды не несёт и им не доверяют.
 * SUPER_ADMIN проходит потому, что seed выдаёт ему все permissions явно, а не
 * из-за хардкод-bypass. Отказ — 403 без раскрытия, какого именно права не
 * хватило.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rolesService: RolesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionCode[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      // JwtAuthGuard должен стоять раньше; сюда без user попасть нельзя, но
      // на всякий случай закрываемся, а не открываемся.
      throw new ForbiddenException('Недостаточно прав для выполнения операции');
    }

    const granted = await this.rolesService.getUserPermissionCodes(user.id);
    const allowed = required.every((code) => granted.includes(code));
    if (!allowed) {
      throw new ForbiddenException('Недостаточно прав для выполнения операции');
    }

    return true;
  }
}
