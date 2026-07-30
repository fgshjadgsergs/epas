import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RolesService } from '../roles/roles.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rolesService: RolesService,
  ) {}

  async findProfileById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    // permissions отдаём для UX-гейтинга фронта (навигация/кнопки). Это НЕ
    // источник авторизации: backend PermissionsGuard всё равно проверяет права
    // из БД на каждом запросе. Коды прав не секрет.
    const permissions = await this.rolesService.getUserPermissionCodes(id);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      roles: user.userRoles.map((userRole) => userRole.role.code),
      permissions,
      createdAt: user.createdAt,
    };
  }
}
