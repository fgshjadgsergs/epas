import { ConfigService } from '@nestjs/config';
import { AppConfig, AppEnv } from '../configuration';
import { PricingEnvironmentService } from '../pricing-environment.service';

/**
 * PricingEnvironmentService для тестов: настоящий сервис поверх подставного
 * ConfigService — правила «где разрешены демо-прайсы» проверяются реальные,
 * а не копия логики в тестах.
 *
 * По умолчанию — development (демо-прайсы разрешены), как при локальном
 * запуске.
 */
export function makePricingEnv(
  appEnv: AppEnv = 'development',
  allowDemoPricing = false,
): PricingEnvironmentService {
  const config = {
    get: (key: string) => (key === 'appEnv' ? appEnv : allowDemoPricing),
  } as unknown as ConfigService<AppConfig, true>;
  return new PricingEnvironmentService(config);
}
