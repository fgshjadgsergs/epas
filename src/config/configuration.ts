/**
 * Прикладное окружение стенда — не то же самое, что NODE_ENV.
 * Публичный staging обязан работать на production-сборке (NODE_ENV=production),
 * поэтому «боевой» он или «демо-стенд» определяется отдельным APP_ENV.
 */
export type AppEnv = 'development' | 'staging' | 'production';

export interface AppConfig {
  nodeEnv: string;
  /** development | staging | production (по умолчанию выводится из nodeEnv). */
  appEnv: AppEnv;
  /**
   * Разрешены ли демонстрационные прайсы. Единственный источник истины —
   * PricingEnvironmentService; напрямую этот флаг нигде не читается.
   */
  allowDemoPricing: boolean;
  port: number;
  apiPrefix: string;
  corsOrigin: string;
  database: {
    url: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  jwt: {
    accessSecret: string;
    accessTtl: string;
    refreshSecret: string;
    refreshTtl: string;
  };
  s3: {
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    forcePathStyle: boolean;
    publicUrl?: string;
  };
  files: {
    maxSizeBytes: number;
    allowedMimeTypes: string[];
  };
  throttle: {
    ttl: number;
    limit: number;
  };
  /** За доверенным reverse-proxy (nginx) — иначе throttler считает по IP proxy, не клиента. */
  trustProxy: boolean;
}

/** APP_ENV задаётся явно; без него окружение выводится из NODE_ENV. */
export function resolveAppEnv(): AppEnv {
  const explicit = process.env.APP_ENV?.trim().toLowerCase();
  if (explicit === 'development' || explicit === 'staging' || explicit === 'production') {
    return explicit;
  }
  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  appEnv: resolveAppEnv(),
  // В development демо-прайсы доступны всегда (локальная разработка), в
  // staging — только по явному флагу, в production — никогда (см. fail-fast
  // в env.validation.ts и PricingEnvironmentService).
  allowDemoPricing: (process.env.ALLOW_DEMO_PRICING ?? 'false') === 'true',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  // '*' никогда не используется как дефолт — в dev падаем на адрес локального
  // frontend, в production CORS_ORIGIN обязателен и проверяется в env.validation.ts
  // (validateEnv() уронит старт приложения раньше, чем мы сюда дойдём).
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3001',
  database: {
    url: process.env.DATABASE_URL ?? '',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    region: process.env.S3_REGION ?? 'us-east-1',
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
    bucket: process.env.S3_BUCKET ?? 'photo-print',
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',
    publicUrl: process.env.S3_PUBLIC_URL || undefined,
  },
  files: {
    maxSizeBytes: parseInt(process.env.FILES_MAX_SIZE_BYTES ?? '15728640', 10),
    allowedMimeTypes: (
      process.env.FILES_ALLOWED_MIME_TYPES ?? 'image/jpeg,image/png,image/webp,application/pdf'
    )
      .split(',')
      .map((type) => type.trim())
      .filter(Boolean),
  },
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10),
    // Общий (каталожный) лимит: намеренно высокий — GET /categories, /services
    // читаются на КАЖДОЙ странице при `next build` (115 страниц × несколько
    // fetch на страницу). Узкий лимит для /calculate задаётся отдельно,
    // декоратором @Throttle прямо на контроллере (ТЗ §15.3: 60/мин/IP).
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '1200', 10),
  },
  trustProxy: (process.env.TRUST_PROXY ?? 'false') === 'true',
});
