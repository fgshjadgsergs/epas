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
 * 'unsafe-eval' НЕ разрешён в production (сборка Next его не требует), но
 * dev-рантайм (react-refresh, source maps) без него не гидратируется — вся
 * интерактивность в `npm run dev` умирает. Поэтому в dev добавляем его.
 */
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  // 'self': превью конструктора/макетов могут открываться во фрейме самого сайта.
  "frame-ancestors 'self'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"} ${ym}`,
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
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
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
    const map = {
      // 301 со старых английских слагов на ЧПУ-транслитерацию (ТЗ URL, п.4/5).
      '/about': '/o-kompanii/',
      '/contacts': '/kontakty/',
      '/privacy': '/politika-konfidencialnosti/',
      '/oferta': '/dogovor-oferty/',
      '/offices': '/nashi-ofisy/',
      '/dostavka': '/dostavka-i-samovyvoz/',
      '/dlya-biznesa': '/dlya-biznesa-b2b/',
      '/html-map-lvl-1': '/karta-sayta-html/',

      // 301 с канонических URL из ТЗ «Структура сайта» на реализованную
      // плоскую/укороченную ЧПУ-схему (правила редиректов — общие требования, п.5).
      // Копирование и печать документов.
      '/kopirovanie-i-pechat-dokumentov': '/pechat-dokumentov/',
      '/kopirovanie-i-pechat-dokumentov/pechat-dokumentov-a4-a3': '/pechat-dokumentov/pechat-a4-a3/',
      '/kopirovanie-i-pechat-dokumentov/kopirovanie-dokumentov-a4-a3': '/pechat-dokumentov/kopirovanie-a4-a3/',
      '/kopirovanie-i-pechat-dokumentov/pechat-prezentaciy': '/pechat-dokumentov/prezentacii/',
      '/kopirovanie-i-pechat-dokumentov/pechat-chertezhey': '/pechat-dokumentov/chertezhi/',
      '/kopirovanie-i-pechat-dokumentov/broshyurovka-dokumentov': '/pechat-dokumentov/broshyurovka/',
      '/kopirovanie-i-pechat-dokumentov/tvyordyy-pereplyot': '/pechat-dokumentov/tvyordyj-pereplet/',
      '/kopirovanie-i-pechat-dokumentov/pechat-i-pereplyot-diplomnyh-rabot': '/pechat-dokumentov/diplomnye-raboty/',
      '/kopirovanie-i-pechat-dokumentov/pechat-avtoreferatov': '/pechat-dokumentov/avtoreferaty/',
      '/kopirovanie-i-pechat-dokumentov/laminirovanie': '/pechat-dokumentov/laminirovanie/',
      // Фото на документы.
      '/foto-na-dokumenty/foto-na-pasport-rf': '/foto-na-dokumenty/pasport-rf/',
      '/foto-na-dokumenty/foto-na-zagranpasport': '/foto-na-dokumenty/zagranpasport/',
      '/foto-na-dokumenty/foto-na-vizu': '/foto-na-dokumenty/viza/',
      '/foto-na-dokumenty/foto-na-voditelskie-prava': '/foto-na-dokumenty/voditelskoe-udostoverenie/',
      '/foto-na-dokumenty/foto-na-snils': '/foto-na-dokumenty/snils/',
      '/foto-na-dokumenty/foto-na-medicinskuyu-knizhku': '/foto-na-dokumenty/medicinskaya-knizhka/',
      '/foto-na-dokumenty/foto-dlya-detskih-dokumentov': '/foto-na-dokumenty/detskie-dokumenty/',
      '/foto-na-dokumenty/foto-na-pensionnoe-udostoverenie': '/foto-na-dokumenty/pensionnoe-udostoverenie/',
      // Фотопечать.
      '/fotopechat/pechat-fotografiy': '/fotopechat/pechat-fotografij/',
      '/fotopechat/pechat-posterov-i-plakatov': '/fotopechat/postery-i-plakaty/',
      // Фотокниги.
      '/fotoknigi/fotoknigi-layflat': '/fotoknigi/layflat/',
      '/fotoknigi/fotoknigi-hardcover': '/fotoknigi/hardcover/',
      '/fotoknigi/fotoknigi-softcover': '/fotoknigi/softcover/',
      '/fotoknigi/svadebnye-fotoknigi': '/fotoknigi/svadebnye/',
      '/fotoknigi/detskie-fotoknigi': '/fotoknigi/detskie/',
      '/fotoknigi/konstruktor-fotoknig-onlayn': '/fotoknigi/konstruktor/',
      // Оперативная полиграфия.
      '/operativnaya-poligrafiya': '/poligrafiya/',
      '/operativnaya-poligrafiya/vizitki': '/vizitki/',
      '/operativnaya-poligrafiya/listovki-i-flaery': '/listovki/',
      '/operativnaya-poligrafiya/buklety': '/buklety/',
      '/operativnaya-poligrafiya/otkrytki-i-priglasheniya': '/otkrytki/',
      '/operativnaya-poligrafiya/sertifikaty-i-diplomy': '/sertifikaty/',
      '/operativnaya-poligrafiya/birki-beydzhi-blanki': '/birki-bejdzi-blanki/',
      '/operativnaya-poligrafiya/menyu-dlya-restoranov-i-kafe': '/menyu/',
      // Наклейки и этикетки.
      '/nakleyki-i-etiketki': '/naklejki/',
      '/nakleyki-i-etiketki/pechat-nakleek': '/naklejki/pechat/',
      '/nakleyki-i-etiketki/stikerpaki': '/naklejki/stikerpaki/',
      '/nakleyki-i-etiketki/etiketki': '/naklejki/etiketki/',
      '/nakleyki-i-etiketki/birki-i-yarlyki-dlya-odezhdy': '/naklejki/birki-dlya-odezhdy/',
      // Широкоформатная и наружная печать.
      '/shirokoformatnaya-i-naruzhnaya-pechat': '/shirokoformat/',
      '/shirokoformatnaya-i-naruzhnaya-pechat/pechat-bannerov': '/shirokoformat/bannery/',
      '/shirokoformatnaya-i-naruzhnaya-pechat/pechat-afish-i-posterov': '/shirokoformat/afishi-postery/',
      '/shirokoformatnaya-i-naruzhnaya-pechat/interernaya-pechat': '/shirokoformat/interyernaya-pechat/',
      '/shirokoformatnaya-i-naruzhnaya-pechat/stendy-roll-up': '/shirokoformat/roll-up/',
      '/shirokoformatnaya-i-naruzhnaya-pechat/press-wall-fotostena': '/shirokoformat/press-wall/',
      // Печати и штампы.
      '/pechati-i-shtampy': '/pechati-shtampy/',
      '/pechati-i-shtampy/avtomaticheskie-shtampy': '/pechati-shtampy/avtomaticheskie/',
      '/pechati-i-shtampy/karmannye-pechati': '/pechati-shtampy/karmannye/',
      '/pechati-i-shtampy/faksimile': '/pechati-shtampy/faksimile/',
      '/pechati-i-shtampy/plombiratory': '/pechati-shtampy/plombiratory/',
      // Сувениры и текстиль.
      '/suveniry-i-tekstil': '/suveniry/',
      '/suveniry-i-tekstil/pechat-na-futbolkah': '/suveniry/futbolki/',
      '/suveniry-i-tekstil/pechat-na-kruzhkah': '/suveniry/kruzhki/',
      '/suveniry-i-tekstil/shoppery-s-logotipom': '/suveniry/shoppery/',
      '/suveniry-i-tekstil/lanyardy-i-beydzhi': '/suveniry/lanyardy-bejdzi/',
      // Календари.
      '/kalendari/karmannye-kalendari': '/kalendari/karmannye/',
      '/kalendari/nastennye-perekidnye-kalendari': '/kalendari/nastennye/',
      '/kalendari/nastolnye-kalendari-domik': '/kalendari/nastolnye/',
      '/kalendari/kalendari-planingi': '/kalendari/planingi/',
      '/kalendari/fotokalendari': '/kalendari/foto/',
      // B2B.
      '/korporativnym-klientam': '/dlya-biznesa-b2b/',
      '/dlya-biznesa-b2b/rabota-s-nds-i-dokumentami': '/dlya-biznesa-b2b/nds-i-dokumenty/',
      '/dlya-biznesa-b2b/poligrafiya-dlya-vystavok-i-meropriyatiy': '/dlya-biznesa-b2b/dlya-vystavok/',
      '/dlya-biznesa-b2b/pos-materialy-i-brendirovanie': '/dlya-biznesa-b2b/pos-materialy/',
      '/dlya-biznesa-b2b/optovye-zakazy': '/dlya-biznesa-b2b/partnership/',
      '/dlya-biznesa-b2b/stat-partnyorom': '/dlya-biznesa-b2b/partnership/',
      // Личный кабинет: программа лояльности вынесена на верхний уровень.
      '/lichnyy-kabinet/programma-loyalnosti': '/programma-loyalnosti/',
    };
    // trailingSlash: true — Next сам приводит /foo → /foo/; матчим оба варианта
    // источника, чтобы 301 был одношаговым. statusCode 301 (а не permanent/308) —
    // по ТЗ «Общие технические требования», п.5.
    return Object.entries(map).map(([source, destination]) => ({
      source: `${source}{/}?`,
      destination,
      statusCode: 301,
    }));
  },
};

export default nextConfig;
