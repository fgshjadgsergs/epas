import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';
import { getAllSlugs } from '@/data/catalog';
import { blogPosts } from '@/data/blog';

/**
 * sitemap.xml (ТЗ «Общие технические требования», п.6).
 * Источник — модель каталога (все страницы разделов/услуг/инфо).
 * Исключаем неиндексируемые служебные разделы.
 */
const EXCLUDE = new Set(['/korzina/', '/oformlenie-zakaza/', '/lichnyy-kabinet/', '/search/']);

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  // Блог и HTML-карта обслуживаются отдельными роутами (нет в каталоге).
  const extra = ['/blog/', '/karta-sayta-html/', ...blogPosts.map((p) => `/blog/${p.slug}/`)];
  const paths = ['/', ...extra, ...getAllSlugs().map((s) => '/' + s.join('/') + '/')];

  return paths
    .filter((p) => !EXCLUDE.has(p))
    .map((path) => ({
      url: new URL(path, site.url).toString(),
      lastModified,
      changeFrequency: 'weekly',
      priority: path === '/' ? 1 : path.split('/').filter(Boolean).length === 1 ? 0.9 : 0.8,
    }));
}
