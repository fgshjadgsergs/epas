const isProd = process.env.NODE_ENV === 'production';
const apiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1').origin;
  } catch {
    return 'http://localhost:3000';
  }
})();
// Публичные картинки каталога и presigned preview артворков живут в S3/MinIO.
// В проде хранилище отдаётся по https (покрыто `https:`); локально — MinIO по http.
const mediaSrc = isProd ? 'https:' : 'http://localhost:9000 https:';
const optionalMediaOrigin = process.env.NEXT_PUBLIC_MEDIA_ORIGIN ?? '';
// Яндекс.Метрика (если счётчик подключён) — не ломаем аналитику калькулятора.
const ym = 'https://mc.yandex.ru https://mc.yandex.com';

/**
 * Content-Security-Policy для production-совместимого рантайма Next.js.
 *
 * script-src/style-src содержат 'unsafe-inline': Next App Router встраивает
 * inline-скрипт гидратации и inline-стили (styled-jsx) без nonce, а nonce-режим
 * потребовал бы полностью динамического рендера и сломал бы SSG/ISR каталога.
 * 'unsafe-eval' НЕ разрешён (в production-сборке Next его не требует).
 */
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline' ${ym}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${mediaSrc} ${optionalMediaOrigin} ${ym}`,
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin} ${ym} ${optionalMediaOrigin}`,
  `frame-src 'self' blob: ${mediaSrc} ${optionalMediaOrigin}`,
]
  .map((d) => d.trim().replace(/\s+/g, ' '))
  .join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone: компактный самодостаточный server.js для Docker-рантайма
  // (см. frontend/Dockerfile). На локальную разработку (npm run dev) не влияет.
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  trailingSlash: true,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    // Security-заголовки в зоне приложения. HSTS ставит и прокси/CDN, но в
    // production дублируем безопасным значением; в dev (http) его не шлём.
    const headers = [
      { key: 'Content-Security-Policy', value: csp },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
    ];
    if (isProd) {
      headers.push({ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' });
    }
    return [{ source: '/:path*', headers }];
  },
  async redirects() {
    // 301 со старых английских слагов на ЧПУ-транслитерацию (ТЗ URL, п.4/5).
    const map = {
      '/about': '/o-kompanii/',
      '/contacts': '/kontakty/',
      '/privacy': '/politika-konfidencialnosti/',
      '/oferta': '/dogovor-oferty/',
      '/offices': '/nashi-ofisy/',
      '/dostavka': '/dostavka-i-samovyvoz/',
      '/dlya-biznesa': '/dlya-biznesa-b2b/',
      '/html-map-lvl-1': '/karta-sayta-html/',
    };
    return Object.entries(map).map(([source, destination]) => ({
      source,
      destination,
      permanent: true,
    }));
  },
};

export default nextConfig;
