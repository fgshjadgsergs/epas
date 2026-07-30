import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrivateCacheInterceptor } from './common/interceptors/private-cache.interceptor';
import configuration, { AppConfig } from './config/configuration';
import { AppConfigModule } from './config/config.module';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { StorageModule } from './storage/storage.module';
import { FilesModule } from './files/files.module';
import { CatalogModule } from './catalog/catalog.module';
import { CalculatorModule } from './calculator/calculator.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { AdminPricingModule } from './pricing/admin-pricing.module';
import { ArtworksModule } from './artworks/artworks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => ({
        throttlers: [
          {
            ttl: configService.get('throttle.ttl', { infer: true }) * 1000,
            limit: configService.get('throttle.limit', { infer: true }),
          },
        ],
      }),
    }),
    AppConfigModule,
    DatabaseModule,
    HealthModule,
    RolesModule,
    AuthModule,
    UsersModule,
    StorageModule,
    FilesModule,
    CatalogModule,
    CalculatorModule,
    CartModule,
    OrdersModule,
    AdminPricingModule,
    ArtworksModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: PrivateCacheInterceptor,
    },
  ],
})
export class AppModule {}
