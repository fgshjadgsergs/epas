import { HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { HealthController } from './health.controller';
import type { PrismaService } from '../database/prisma.service';

/** Мок express-ответа: фиксируем выставленный статус. */
function makeRes(): Response & { statusCode: number } {
  const res = {
    statusCode: HttpStatus.OK,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
  };
  return res as unknown as Response & { statusCode: number };
}

describe('HealthController (readiness)', () => {
  it('БД доступна → 200 ok, database=up', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const controller = new HealthController(prisma as unknown as PrismaService);
    const res = makeRes();

    const body = await controller.check(res);

    expect(res.statusCode).toBe(HttpStatus.OK);
    expect(body.status).toBe('ok');
    expect(body.database).toBe('up');
  });

  it('БД недоступна → 503, database=down, без internal-деталей', async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error('ECONNREFUSED 5432')) };
    const controller = new HealthController(prisma as unknown as PrismaService);
    const res = makeRes();

    const body = await controller.check(res);

    expect(res.statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(body.status).toBe('degraded');
    expect(body.database).toBe('down');
    // Тело не раскрывает текст ошибки/DSN.
    expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
  });
});
