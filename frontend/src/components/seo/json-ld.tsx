import { site } from '@/lib/site';
import { serializeJsonLd } from '@/lib/seo/json-ld';

/** Вставляет Schema.org-разметку через script[type=application/ld+json]. */
function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // Контент может включать редактируемые в админке поля — экранируем,
      // чтобы `</script>` из данных не закрыл тег (XSS).
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}

/** WebSite — на всех страницах (ТЗ SEO, п.8). */
export function SiteJsonLd() {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: site.name,
        url: site.url,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${site.url}/search/?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      }}
    />
  );
}

/**
 * Organization — на всех страницах, КРОМЕ страниц услуг (ТЗ SEO, п.8):
 * на услугах основная сущность — Product + Offer.
 */
export function OrganizationJsonLd() {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: site.name,
        url: site.url,
        logo: `${site.url}/img/logo.svg`,
        contactPoint: {
          '@type': 'ContactPoint',
          telephone: site.phone.display,
          contactType: 'customer service',
        },
        sameAs: [site.socials.vk, site.socials.telegram],
      }}
    />
  );
}

/** LocalBusiness — только на главной (ТЗ SEO, п.8). */
export function LocalBusinessJsonLd() {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: site.name,
        url: site.url,
        telephone: site.phone.display,
        address: {
          '@type': 'PostalAddress',
          addressLocality: site.city,
          addressCountry: 'RU',
        },
        openingHoursSpecification: [
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            opens: '09:00',
            closes: '21:00',
          },
        ],
      }}
    />
  );
}

/** ItemList — на страницах категорий: список услуг раздела (ТЗ SEO, п.8). */
export function ItemListJsonLd({
  name,
  items,
}: {
  name: string;
  items: { name: string; url: string; price?: string }[];
}) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name,
        itemListElement: items.map((it) => ({
          '@type': 'Product',
          name: it.name,
          url: new URL(it.url, site.url).toString(),
          ...(it.price
            ? { offers: { '@type': 'Offer', price: it.price, priceCurrency: 'RUB' } }
            : {}),
        })),
      }}
    />
  );
}

/** ContactPage — страница контактов (ТЗ SEO, п.8). */
export function ContactPageJsonLd() {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'ContactPage',
        contactPoint: {
          '@type': 'ContactPoint',
          telephone: site.phone.display,
          email: site.email,
          hoursAvailable: {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            opens: '09:00',
            closes: '21:00',
          },
        },
      }}
    />
  );
}

/** AboutPage — страница «О компании» (ТЗ SEO, п.8). */
export function AboutPageJsonLd() {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'AboutPage',
        about: {
          '@type': 'Organization',
          name: site.name,
          url: site.url,
          logo: `${site.url}/img/logo.svg`,
          contactPoint: { '@type': 'ContactPoint', telephone: site.phone.display },
        },
      }}
    />
  );
}

export interface Crumb {
  name: string;
  item: string;
}

/** BreadcrumbList — на всех страницах кроме главной (ТЗ SEO, п.8). */
export function BreadcrumbJsonLd({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: crumbs.map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: c.name,
          item: new URL(c.item, site.url).toString(),
        })),
      }}
    />
  );
}

export interface FaqItem {
  question: string;
  answer: string;
}

/** FAQPage — на всех страницах с блоком FAQ (ТЗ SEO, п.8). */
export function FaqJsonLd({ items }: { items: FaqItem[] }) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items.map((it) => ({
          '@type': 'Question',
          name: it.question,
          acceptedAnswer: { '@type': 'Answer', text: it.answer },
        })),
      }}
    />
  );
}
