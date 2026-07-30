import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AppConfig } from '../config/configuration';
import { AuthService, IssuedSession } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SessionResponseDto } from './dto/auth-response.dto';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from './refresh-cookie';

/**
 * Cookie-authenticated auth-эндпоинты (refresh/logout читают refresh только из
 * httpOnly-cookie; login/register ставят её). Бизнес-мутации остаются на Bearer
 * access-токене, поэтому широкая CSRF-подсистема не нужна — защищаемся
 * SameSite=Lax + строгим CORS (точный origin, credentials). Логин/refresh
 * ужаты троттлером против brute-force.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly cookieSecure: boolean;
  private readonly cookiePath: string;

  constructor(
    private readonly authService: AuthService,
    configService: ConfigService<AppConfig, true>,
  ) {
    // Secure — на production-сборке (в т.ч. staging: NODE_ENV=production).
    this.cookieSecure = configService.get('nodeEnv', { infer: true }) === 'production';
    // Узкий путь: cookie уходит только на auth-эндпоинты.
    this.cookiePath = `/${configService.get('apiPrefix', { infer: true })}/auth`;
  }

  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Регистрация нового пользователя' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response): Promise<SessionResponseDto> {
    return this.issue(await this.authService.register(dto), res);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Вход по email и паролю' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<SessionResponseDto> {
    return this.issue(await this.authService.login(dto), res);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Обновление сессии по refresh-cookie (ротация)' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<SessionResponseDto> {
    // Refresh принимается ТОЛЬКО из httpOnly-cookie: не из body/query/header.
    return this.issue(await this.authService.refresh(readRefreshCookie(req)), res);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Отзыв текущей refresh-сессии и очистка cookie' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.authService.logout(readRefreshCookie(req));
    clearRefreshCookie(res, { secure: this.cookieSecure, path: this.cookiePath });
  }

  private issue(session: IssuedSession, res: Response): SessionResponseDto {
    setRefreshCookie(res, session.rawRefreshToken, {
      secure: this.cookieSecure,
      path: this.cookiePath,
      maxAgeMs: session.refreshMaxAgeMs,
    });
    return SessionResponseDto.fromSession(session);
  }
}
