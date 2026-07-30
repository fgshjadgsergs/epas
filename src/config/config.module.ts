import { Global, Module } from '@nestjs/common';
import { PricingEnvironmentService } from './pricing-environment.service';

/**
 * Глобальный доступ к решению «можно ли демо-прайсы» — чтобы правило жило в
 * одном месте, а не копировалось проверками process.env по сервисам.
 */
@Global()
@Module({
  providers: [PricingEnvironmentService],
  exports: [PricingEnvironmentService],
})
export class AppConfigModule {}
