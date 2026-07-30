import { validateEnv } from './env.validation';
import { makePricingEnv } from './testing/pricing-environment.stub';

/** Минимально валидный набор переменных для проверки правил окружения. */
function baseEnv(overrides: Record<string, string> = {}): Record<string, unknown> {
  return {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    JWT_ACCESS_SECRET: 'a'.repeat(40),
    JWT_REFRESH_SECRET: 'b'.repeat(40),
    S3_ENDPOINT: 'http://localhost:9000',
    S3_BUCKET: 'bucket',
    S3_ACCESS_KEY_ID: 'real-access-key',
    S3_SECRET_ACCESS_KEY: 'real-secret-key',
    CORS_ORIGIN: 'https://staging.example.test',
    TRUST_PROXY: 'true',
    ...overrides,
  };
}

describe('Правила демо-прайсов по окружениям', () => {
  it('development: демо-прайсы доступны всегда', () => {
    expect(makePricingEnv('development', false).demoPricingAllowed).toBe(true);
    expect(makePricingEnv('development', true).demoPricingAllowed).toBe(true);
  });

  it('staging: только при ALLOW_DEMO_PRICING=true', () => {
    expect(makePricingEnv('staging', false).demoPricingAllowed).toBe(false);
    expect(makePricingEnv('staging', true).demoPricingAllowed).toBe(true);
  });

  it('production: демо-прайсы запрещены при любом флаге', () => {
    expect(makePricingEnv('production', false).demoPricingAllowed).toBe(false);
    expect(makePricingEnv('production', true).demoPricingAllowed).toBe(false);
  });

  it('pricingMode определяется прайсом, а не окружением', () => {
    const env = makePricingEnv('staging', true);
    expect(env.pricingModeOf({ isDemo: true })).toBe('DEMO');
    expect(env.pricingModeOf({ isDemo: false })).toBe('LIVE');
    // Даже на боевом стенде режим считается по факту прайса.
    expect(makePricingEnv('production').pricingModeOf({ isDemo: false })).toBe('LIVE');
  });
});

describe('Fail-fast конфигурации окружения', () => {
  it('APP_ENV=production + ALLOW_DEMO_PRICING=true — старт запрещён', () => {
    expect(() =>
      validateEnv(baseEnv({ NODE_ENV: 'production', APP_ENV: 'production', ALLOW_DEMO_PRICING: 'true' })),
    ).toThrow(/ALLOW_DEMO_PRICING/);
  });

  it('NODE_ENV=production без APP_ENV трактуется как production — демо запрещено', () => {
    expect(() => validateEnv(baseEnv({ NODE_ENV: 'production', ALLOW_DEMO_PRICING: 'true' }))).toThrow(
      /ALLOW_DEMO_PRICING/,
    );
  });

  it('staging обязан работать на production-сборке', () => {
    expect(() =>
      validateEnv(baseEnv({ NODE_ENV: 'development', APP_ENV: 'staging', ALLOW_DEMO_PRICING: 'true' })),
    ).toThrow(/NODE_ENV=production/);
  });

  it('корректный staging проходит валидацию', () => {
    expect(() =>
      validateEnv(baseEnv({ NODE_ENV: 'production', APP_ENV: 'staging', ALLOW_DEMO_PRICING: 'true' })),
    ).not.toThrow();
  });

  it('корректный production проходит валидацию', () => {
    expect(() =>
      validateEnv(baseEnv({ NODE_ENV: 'production', APP_ENV: 'production', ALLOW_DEMO_PRICING: 'false' })),
    ).not.toThrow();
  });

  it('development остаётся прежним и не требует новых переменных', () => {
    expect(() => validateEnv(baseEnv({ NODE_ENV: 'development' }))).not.toThrow();
  });

  it('production без TRUST_PROXY=true — старт запрещён (за reverse-proxy)', () => {
    expect(() =>
      validateEnv(baseEnv({ NODE_ENV: 'production', APP_ENV: 'production', TRUST_PROXY: 'false' })),
    ).toThrow(/TRUST_PROXY/);
  });

  it('одинаковые JWT access и refresh секреты в production — старт запрещён', () => {
    expect(() =>
      validateEnv(
        baseEnv({ NODE_ENV: 'production', APP_ENV: 'production', JWT_ACCESS_SECRET: 'x'.repeat(40), JWT_REFRESH_SECRET: 'x'.repeat(40) }),
      ),
    ).toThrow(/должны различаться/);
  });

  it('недопустимые значения APP_ENV отклоняются', () => {
    expect(() => validateEnv(baseEnv({ APP_ENV: 'prod' }))).toThrow();
  });
});
