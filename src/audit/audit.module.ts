import { Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';

/** Общий сервис аудита (AuditLog) — переиспользуется pricing/artwork. */
@Module({
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditModule {}
