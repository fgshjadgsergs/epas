import { plainToInstance } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, Max, Min, validateSync } from 'class-validator';

const MIN_PRODUCTION_SECRET_LENGTH = 32;
const FORBIDDEN_SECRET_PATTERNS = [/change-?me/i, /^secret$/i, /^password$/i];
const FORBIDDEN_S3_DEV_DEFAULTS = ['minioadmin'];

class EnvironmentVariables {
  @IsOptional()
  @IsIn(['development', 'production', 'test'])
  NODE_ENV?: string;

  @IsOptional()
  @IsIn(['development', 'staging', 'production'])
  APP_ENV?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  ALLOW_DEMO_PRICING?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT?: number;

  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  @IsNotEmpty()
  S3_ENDPOINT!: string;

  @IsNotEmpty()
  S3_BUCKET!: string;

  @IsNotEmpty()
  S3_ACCESS_KEY_ID!: string;

  @IsNotEmpty()
  S3_SECRET_ACCESS_KEY!: string;

  @IsOptional()
  CORS_ORIGIN?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  TRUST_PROXY?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(
      `Некорректная конфигурация окружения:\n${errors
        .map((error) => Object.values(error.constraints ?? {}).join(', '))
        .join('\n')}`,
    );
  }

  // APP_ENV=production запрещает демо-прайсы при любых значениях остальных
  // переменных: приложение падает на старте, а не отдаёт демо-цену клиенту.
  const appEnv =
    validatedConfig.APP_ENV ?? (validatedConfig.NODE_ENV === 'production' ? 'production' : 'development');
  if (appEnv === 'production' && validatedConfig.ALLOW_DEMO_PRICING === 'true') {
    throw new Error(
      'ALLOW_DEMO_PRICING=true недопустим при APP_ENV=production — демонстрационные ' +
        'цены не должны показываться на боевом стенде. Используйте APP_ENV=staging.',
    );
  }

  // Публичный стенд обязан работать на production-сборке: staging на
  // NODE_ENV=development даёт dev-режим Nest/Next и небезопасные cookie.
  if (appEnv === 'staging' && validatedConfig.NODE_ENV !== 'production') {
    throw new Error('APP_ENV=staging требует NODE_ENV=production (публичный стенд на production-сборке)');
  }

  if (validatedConfig.NODE_ENV === 'production') {
    assertProductionSecret('JWT_ACCESS_SECRET', validatedConfig.JWT_ACCESS_SECRET);
    assertProductionSecret('JWT_REFRESH_SECRET', validatedConfig.JWT_REFRESH_SECRET);
    // Разные секреты для access и refresh: компрометация одного не раскрывает
    // второй контур.
    if (validatedConfig.JWT_ACCESS_SECRET === validatedConfig.JWT_REFRESH_SECRET) {
      throw new Error('JWT_ACCESS_SECRET и JWT_REFRESH_SECRET должны различаться в production');
    }
    assertProductionS3Credential('S3_ACCESS_KEY_ID', validatedConfig.S3_ACCESS_KEY_ID);
    assertProductionS3Credential('S3_SECRET_ACCESS_KEY', validatedConfig.S3_SECRET_ACCESS_KEY);
    assertProductionCorsOrigin(validatedConfig.CORS_ORIGIN);
    // За TLS-терминирующим прокси (nginx) TRUST_PROXY обязателен: иначе Secure
    // cookie/req.protocol/троттлинг по IP работают некорректно.
    if (validatedConfig.TRUST_PROXY !== 'true') {
      throw new Error('TRUST_PROXY=true обязателен в production (приложение работает за reverse-proxy с TLS)');
    }
  }

  return validatedConfig;
}

function assertProductionSecret(name: string, value: string): void {
  if (value.length < MIN_PRODUCTION_SECRET_LENGTH) {
    throw new Error(`${name} должен быть не короче ${MIN_PRODUCTION_SECRET_LENGTH} символов в production`);
  }
  if (FORBIDDEN_SECRET_PATTERNS.some((pattern) => pattern.test(value))) {
    throw new Error(`${name} использует placeholder-значение из .env.example — задайте реальный секрет`);
  }
}

function assertProductionS3Credential(name: string, value: string): void {
  if (FORBIDDEN_S3_DEV_DEFAULTS.includes(value.toLowerCase())) {
    throw new Error(`${name} использует dev-значение по умолчанию (MinIO) — задайте реальные креды в production`);
  }
}

function assertProductionCorsOrigin(value: string | undefined): void {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === '*') {
    throw new Error(
      'CORS_ORIGIN обязателен в production и не может быть "*" — укажите конкретный origin фронтенда',
    );
  }
}
