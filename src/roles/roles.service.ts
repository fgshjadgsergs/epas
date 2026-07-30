import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RoleCode } from '../common/constants/roles.constant';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByCode(code: RoleCode) {
    const role = await this.prisma.role.findUnique({ where: { code } });
    if (!role) {
      throw new NotFoundException(`Роль "${code}" не найдена. Запустите seed.`);
    }
    return role;
  }

  async assignRoleToUser(userId: string, roleCode: RoleCode): Promise<void> {
    const role = await this.findByCode(roleCode);
    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      update: {},
      create: { userId, roleId: role.id },
    });
  }

  async getUserRoleCodes(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
    return userRoles.map((userRole) => userRole.role.code);
  }

  /**
   * Актуальные permission-коды пользователя из БД: роли → role_permissions →
   * permissions. Источник истины для PermissionsGuard — JWT permission-кодов не
   * несёт и им не доверяют. Дубликаты (право у нескольких ролей) схлопываются.
   */
  async getUserPermissionCodes(userId: string): Promise<string[]> {
    const rows = await this.prisma.permission.findMany({
      where: { rolePermissions: { some: { role: { userRoles: { some: { userId } } } } } },
      select: { code: true },
    });
    return [...new Set(rows.map((row) => row.code))];
  }
}
