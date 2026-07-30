import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

/**
 * Запись аудита pricing-изменений. before/after должны содержать ТОЛЬКО
 * безопасные pricing-данные — вызывающий код не передаёт сюда JWT, cookies,
 * секреты, сырое тело запроса или PII клиента.
 *
 * Пишется в той же транзакции, что и изменение (принимает tx), чтобы аудит и
 * бизнес-изменение были атомарны.
 */
export interface AuditEntry {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
}

type AuditTx = Pick<PrismaService, 'auditLog'>;

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  /** Записать аудит-событие. Передайте tx для атомарности с изменением. */
  async record(entry: AuditEntry, tx: AuditTx = this.prisma): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        before: entry.before ?? Prisma.JsonNull,
        after: entry.after ?? Prisma.JsonNull,
      },
    });
  }
}
