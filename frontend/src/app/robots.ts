import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';

/**
 * robots.txt (ТЗ «Общие технические требования», п.7).
 * Закрываем технические разделы и параметрические URL калькуляторов
 * (состояние калькулятора — в GET-параметрах, индексировать не нужно).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/lichnyy-kabinet/',
        '/korzina/',
        '/oformlenie-zakaza/',
        '/search/',
        '/*?', // параметры калькулятора и прочие GET — не индексируются
      ],
    },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
