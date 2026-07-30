import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig, AppEnv } from './configuration';

/** Режим прайса, использованного в расчёте (публичное значение для UI). */
export type PricingMode = 'DEMO' | 'LIVE';

/**
 * Правило доступности демо-прайсов в чистом виде — используется и сервисом
 * приложения, и seed-скриптом (у него нет Nest DI), чтобы условие было
 * записано ровно один раз.
 */
export function demoPricingAllowedFor(appEnv: AppEnv, allowDemoPricing: boolean): boolean {
  if (appEnv === 'production') return false;
  if (appEnv === 'development') return true;
  return allowDemoPricing; // staging
}

/**
 * Единственная точка, решающая, доступны ли демонстрационные прайсы.
 *
 * Правила:
 * - development — демо-прайсы доступны всегда (локальная разработка);
 * - staging — только при ALLOW_DEMO_PRICING=true (публичный демо-стенд);
 * - production — запрещены всегда; сочетание APP_ENV=production +
 *   ALLOW_DEMO_PRICING=true роняет приложение на старте (env.validation.ts).
 *
 * Проверки окружения нигде больше не дублируются: сервисы каталога и
 * публикации спрашивают только этот класс.
 */
@Injectable()
export class PricingEnvironmentService {
  private readonly logger = new Logger(PricingEnvironmentService.name);
  readonly appEnv: AppEnv;
  private readonly allowFlag: boolean;

  constructor(configService: ConfigService<AppConfig, true>) {
    this.appEnv = configService.get('appEnv', { infer: true });
    this.allowFlag = configService.get('allowDemoPricing', { infer: true });

    if (this.demoPricingAllowed) {
      // Заметный маркер в логах стенда: цены не боевые.
      this.logger.warn(
        `DEMO PRICING ENABLED (APP_ENV=${this.appEnv}) — расчёты используют демонстрационный прайс`,
      );
    }
  }

  /** Могут ли демо-прайсы участвовать в расчёте и публиковаться. */
  get demoPricingAllowed(): boolean {
    return demoPricingAllowedFor(this.appEnv, this.allowFlag);
  }

  /** true — боевой стенд (демо-данные скрыты полностью). */
  get isProductionEnv(): boolean {
    return this.appEnv === 'production';
  }

  /** Режим прайса для публичного DTO: определяется фактическим PriceList. */
  pricingModeOf(priceList: { isDemo: boolean }): PricingMode {
    return priceList.isDemo ? 'DEMO' : 'LIVE';
  }
}
