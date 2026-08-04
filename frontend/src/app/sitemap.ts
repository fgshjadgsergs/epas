import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';
import { getAllSlugs, getNode } from '@/data/catalog';
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

  // Приоритеты по ТЗ (общие требования, п.6): главная и каталог — 1.0,
  // инфостраницы и блог — 0.5.
  const priorityOf = (path: string): number => {
    if (path === '/') return 1;
    const node = getNode(path);
    if (node) {
      if (node.type === 'info') return 0.5;
      return node.type === 'section' || node.type === 'b2b' ? 1 : 0.9;
    }
    return 0.5; // блог, HTML-карта и прочие внекаталожные страницы
  };

  return paths
    .filter((p) => !EXCLUDE.has(p))
    .map((path) => ({
      url: new URL(path, site.url).toString(),
      lastModified,
      changeFrequency: 'weekly',
      priority: priorityOf(path),
    }));
}
