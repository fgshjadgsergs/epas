import type { Metadata } from 'next';
import { site } from './site';

/**
 * Хелпер метатегов (ТЗ «Общие технические требования», п.9, 11).
 * Заполняет title/description, canonical, Open Graph и Twitter Cards.
 * title: 50–60 симв., description: 120–155 симв. — контролируется контентом.
 */
export function buildMetadata(params: {
  title: string;
  description: string;
  /** Путь без домена, напр. «/vizitki/». */
  path: string;
  ogImage?: string;
  noindex?: boolean;
}): Metadata {
  const { title, description, path, ogImage = '/og-default.png', noindex } = params;
  const url = new URL(path, site.url).toString();
  const fullTitle = `${title} — ${site.name}`;

  return {
    title: fullTitle,
    description,
    alternates: { canonical: url },
    robots: noindex ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: site.name,
      locale: site.locale,
      type: 'website',
      images: [{ url: ogImage }],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [ogImage],
    },
  };
}
