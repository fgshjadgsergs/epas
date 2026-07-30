import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getNode, getChildren, getAllSlugs, getSeo } from '@/data/catalog';
import {
  categoryNodeFromBackend,
  fetchCategory,
  fetchCategoryServices,
  fetchService,
  GONE,
  mergeCategoryItems,
  overlayCategory,
  overlayService,
  serviceNodeFromBackend,
} from '@/lib/catalog/remote';
import type { CatalogNode } from '@/data/catalog';
import { buildMetadata } from '@/lib/seo';
import { CategoryPage } from '@/components/templates/category-page';
import { ServicePage } from '@/components/templates/service-page';
import { InfoPage } from '@/components/templates/info-page';
import { B2BPage } from '@/components/templates/b2b-page';
import { PortfolioPage } from '@/components/templates/portfolio-page';
import { PhotobookPage } from '@/components/templates/photobook-page';
import { OrganizationJsonLd } from '@/components/seo/json-ld';

type Params = { slug: string[] };

const NOINDEX = new Set(['/korzina/', '/oformlenie-zakaza/', '/lichnyy-kabinet/']);

function toSlug(params: Params): string {
  return '/' + params.slug.join('/') + '/';
}

export function generateStaticParams(): Params[] {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const slug = toSlug(params);
  const node = getNode(slug);
  if (!node) {
    // Узел, созданный через админку (нет в статической карте) — метаданные из БД.
    const service = await fetchService(slug);
    if (service && service !== GONE) {
      return buildMetadata({
        title: service.title,
        description: service.shortDescription ?? `${service.title} — онлайн-заказ с доставкой по России.`,
        path: slug,
      });
    }
    const category = await fetchCategory(slug);
    if (!category || category === GONE) return {};
    return buildMetadata({
      title: category.title,
      description: category.description ?? `${category.title} — онлайн-заказ с доставкой по России.`,
      path: slug,
    });
  }
  const seo = getSeo(slug);
  return buildMetadata({
    title: seo?.title ?? node.name,
    description: seo?.description ?? `${node.name} — онлайн-заказ с доставкой по России.`,
    path: slug,
    noindex: NOINDEX.has(slug),
  });
}

export default async function CatalogPage({ params }: { params: Params }) {
  const slug = toSlug(params);
  let node = getNode(slug);

  // Узел только из БД (создан через админку, в статической карте нет):
  // сначала пробуем услугу, затем категорию.
  if (!node) {
    const service = await fetchService(slug);
    // F-9: деактивированная услуга (410 Gone) → 404, а не воскрешение из статики.
    if (service === GONE) notFound();
    if (service) return <ServicePage node={serviceNodeFromBackend(slug, service)} />;
    const category = await fetchCategory(slug);
    if (!category || category === GONE) notFound();
    const services = await fetchCategoryServices(slug);
    return (
      <>
        <OrganizationJsonLd />
        <CategoryPage
          node={categoryNodeFromBackend(slug, category)}
          items={mergeCategoryItems(slug, [], services)}
        />
      </>
    );
  }
  const seo = getSeo(slug);

  // Этап 3: данные из backend поверх статики. Backend недоступен или записи
  // нет в БД → остаёмся на статических данных, страница не ломается.
  let items: CatalogNode[] = [];
  if (node.type === 'section') {
    const [category, services] = await Promise.all([fetchCategory(slug), fetchCategoryServices(slug)]);
    // F-9: деактивированная категория (410) не воскрешается из статики.
    if (category === GONE) notFound();
    node = overlayCategory(node, category);
    items = mergeCategoryItems(slug, getChildren(slug), services);
  } else if (node.type === 'service') {
    const service = await fetchService(slug);
    if (service === GONE) notFound();
    node = overlayService(node, service);
  }

  // Organization — на всех страницах, кроме услуг (ТЗ SEO, п.8):
  // на страницах услуг основная сущность — Product + Offer.
  const org = node.type !== 'service' ? <OrganizationJsonLd /> : null;

  // Портфолио — отдельная динамичная галерея (вместо текстовой info-страницы).
  if (slug === '/portfolio/')
    return (
      <>
        {org}
        <PortfolioPage node={node} seo={seo} />
      </>
    );

  // Фотокниги — отдельная страница с конструктором (ТЗ «страница фотокниги»).
  if (slug === '/fotoknigi/')
    return (
      <>
        {org}
        <PhotobookPage node={node} seo={seo} />
      </>
    );

  switch (node.type) {
    case 'section':
      return (
        <>
          {org}
          <CategoryPage node={node} seo={seo} items={items} />
        </>
      );
    case 'b2b':
      return (
        <>
          {org}
          <B2BPage node={node} seo={seo} />
        </>
      );
    case 'info':
      return (
        <>
          {org}
          <InfoPage node={node} seo={seo} />
        </>
      );
    case 'service':
    default:
      return <ServicePage node={node} seo={seo} />;
  }
}
