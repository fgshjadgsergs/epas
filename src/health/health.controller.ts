import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { PrismaService } from '../database/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Проверка доступности сервиса и БД (readiness)' })
  @ApiResponse({ status: 200, description: 'Сервис и БД доступны' })
  @ApiResponse({ status: 503, description: 'БД недоступна — сервис не готов принимать трафик' })
  async check(@Res({ passthrough: true }) res: Response) {
    let database: 'up' | 'down' = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      // Внутренние детали ошибки БД наружу не отдаём — только безопасный статус.
      database = 'down';
    }

    // Readiness-семантика для оркестратора/healthcheck: БД недоступна → 503,
    // чтобы контейнер считался unhealthy и не получал трафик. Тело сохраняет
    // безопасный статус, без stack/DSN/internal-деталей.
    if (database === 'down') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      timestamp: new Date().toISOString(),
    };
  }
}
