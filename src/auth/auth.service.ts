import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { User } from '@prisma/client';
import { AppConfig } from '../config/configuration';
import { PrismaService } from '../database/prisma.service';
import { ROLE_CODES } from '../common/constants/roles.constant';
import { RolesService } from '../roles/roles.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

const REFRESH_TOKEN_BYTES = 40;

/**
 * Внутреннее представление выданной сессии. rawRefreshToken уходит ТОЛЬКО в
 * httpOnly-cookie (ставит контроллер) и никогда — в JSON-ответ приложению.
 */
export interface IssuedSession {
  accessToken: string;
  rawRefreshToken: string;
  refreshMaxAgeMs: number;
  user: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    roles: string[];
    permissions: string[];
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly rolesService: RolesService,
  ) {}

  async register(dto: RegisterDto): Promise<IssuedSession> {
    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) {
      // Tradeoff (review item #9): a fully enumeration-proof flow would send
      // an identical response/timing for "exists" and "created" (e.g. always
      // queue a verification email). We accept the email-enumeration risk
      // here for clearer UX and skip a verification-email step that isn't
      // built yet; revisit if/when email verification lands.
      throw new BadRequestException('Регистрация с указанными данными невозможна');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
    });

    await this.rolesService.assignRoleToUser(user.id, ROLE_CODES.CUSTOMER);

    return this.issueTokens(user);
  }

  async login(dto: LoginDto): Promise<IssuedSession> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    return this.issueTokens(user);
  }

  async refresh(rawRefreshToken: string | undefined): Promise<IssuedSession> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token недействителен');
    }
    const tokenHash = this.hashToken(rawRefreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !storedToken ||
      storedToken.revokedAt ||
      storedToken.expiresAt.getTime() < Date.now() ||
      !storedToken.user.isActive
    ) {
      throw new UnauthorizedException('Refresh token недействителен');
    }

    // Ротация: старый refresh становится непригоден, повторное использование
    // уже ротированного/просроченного токена → 401 (проверка выше).
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(storedToken.user);
  }

  /**
   * Отзыв ТОЛЬКО текущей refresh-сессии (не всех устройств): tokenVersion не
   * трогаем, поэтому уже выданный короткоживущий access остаётся валиден до
   * истечения — logout здесь про refresh-сессию. Повторный logout безопасен.
   */
  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;
    const tokenHash = this.hashToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(user: User): Promise<IssuedSession> {
    const roles = await this.rolesService.getUserRoleCodes(user.id);
    const permissions = await this.rolesService.getUserPermissionCodes(user.id);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles,
      tokenVersion: user.tokenVersion,
    };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.accessSecret', { infer: true }),
      expiresIn: this.configService.get('jwt.accessTtl', { infer: true }),
    });

    const refreshMaxAgeMs = this.parseTtlToMs(this.configService.get('jwt.refreshTtl', { infer: true }));
    const rawRefreshToken = await this.createRefreshToken(user.id, refreshMaxAgeMs);

    return {
      accessToken,
      rawRefreshToken,
      refreshMaxAgeMs,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles,
        permissions,
      },
    };
  }

  private async createRefreshToken(userId: string, ttlMs: number): Promise<string> {
    const rawToken = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });

    return rawToken;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseTtlToMs(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) {
      return 30 * 24 * 60 * 60 * 1000;
    }
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const unitMs: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return value * unitMs[unit];
  }
}
