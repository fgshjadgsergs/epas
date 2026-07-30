import { Module } from '@nestjs/common';
import { RolesModule } from '../roles/roles.module';
import { CalculatorModule } from '../calculator/calculator.module';
import { AuditModule } from '../audit/audit.module';
import { AdminPricingController } from './admin-pricing.controller';
import { AdminPricingService } from './admin-pricing.service';

/**
 * Admin Pricing API. RolesModule — для PermissionsGuard; CalculatorModule
 * даёт PublishService и CalculatorService (движок расчёта переиспользуется,
 * не дублируется); AuditModule — общий AuditLogService.
 */
@Module({
  imports: [RolesModule, CalculatorModule, AuditModule],
  controllers: [AdminPricingController],
  providers: [AdminPricingService],
  exports: [AdminPricingService],
})
export class AdminPricingModule {}
