import { allSeoPages, getSeo, type SeoPage } from './seo';

/** Тип страницы → определяет шаблон рендера. */
export type PageType = 'section' | 'service' | 'info' | 'b2b';

export interface CatalogNode {
  slug: string;
  name: string;
  type: PageType;
  parent: string | null;
  /** Дополнительные дочерние slug (для синтетических хабов). */
  extraChildren?: string[];
  priceFrom?: string;
  term?: string;
}

/** Разделы-категории (рендерятся страницей категории с фильтром и подтипами). */
const SECTION_SLUGS = new Set([
  '/foto-na-dokumenty/',
  '/pechat-dokumentov/',
  '/fotopechat/',
  '/fotoknigi/',
  '/kalendari/',
  '/naklejki/',
  '/shirokoformat/',
  '/pechati-shtampy/',
  '/suveniry/',
  // Хабы с подтипами — категории по макету «страница категории»
  // (калькулятор живёт на страницах подтипов, а не на хабе).
  '/vizitki/',
  '/listovki/',
  '/buklety/',
]);

const INFO_SLUGS = new Set([
  '/dostavka-i-samovyvoz/',
  '/oplata/',
  '/portfolio/',
  '/blog/',
  '/o-kompanii/',
  '/kontakty/',
  '/nashi-ofisy/',
  '/politika-konfidencialnosti/',
  '/dogovor-oferty/',
  '/karta-sayta-html/',
]);

const B2B_SLUG = '/dlya-biznesa-b2b/';

/** Синтетические страницы без записи в SEO-таблице (управляются здесь). */
const SYNTHETIC: CatalogNode[] = [
  {
    slug: '/poligrafiya/',
    name: 'Оперативная полиграфия',
    type: 'section',
    parent: null,
    extraChildren: [
      '/vizitki/',
      '/listovki/',
      '/buklety/',
      '/otkrytki/',
      '/sertifikaty/',
      '/birki-bejdzi-blanki/',
      '/menyu/',
      '/kalendari/',
    ],
  },
  // /fotoknigi/konstruktor/ обслуживается отдельным полноэкранным роутом (фаза 4).
  // Press Wall — по ТЗ «Калькуляторы цен» п.4.3 (в SEO-таблице страницы нет).
  {
    slug: '/shirokoformat/press-wall/',
    name: 'Press Wall и фотостены',
    type: 'service',
    parent: '/shirokoformat/',
  },
  { slug: '/trebovaniya-k-maketam/', name: 'Требования к макетам', type: 'info', parent: null },
  { slug: '/programma-loyalnosti/', name: 'Программа лояльности', type: 'info', parent: null },
  { slug: '/vakansii/', name: 'Вакансии', type: 'info', parent: null },
  // /korzina/, /oformlenie-zakaza/, /lichnyy-kabinet/ — отдельные роуты (фаза 5).
];

/** «От цены» и срок для карточек (заглушки; на проде — из прайс-листов CMS). */
const META: Record<string, { priceFrom?: string; term?: string }> = {
  '/foto-na-dokumenty/': { priceFrom: 'от 300 ₽', term: 'за 5 минут' },
  '/pechat-dokumentov/': { priceFrom: 'от 10 ₽/лист', term: 'за 1 час' },
  '/fotopechat/': { priceFrom: 'от 9 ₽', term: '1–2 дня' },
  '/fotoknigi/': { priceFrom: 'от 1 900 ₽', term: '3–7 дней' },
  '/vizitki/': { priceFrom: 'от 990 ₽', term: 'за 3 часа' },
  '/listovki/': { priceFrom: 'от 1 200 ₽', term: '1–2 дня' },
  '/buklety/': { priceFrom: 'от 2 500 ₽', term: '2–3 дня' },
  '/kalendari/': { priceFrom: 'от 890 ₽', term: '5–7 дней' },
  '/naklejki/': { priceFrom: 'от 700 ₽', term: '1–2 дня' },
  '/shirokoformat/': { priceFrom: 'от 700 ₽/м²', term: '1–2 дня' },
  '/pechati-shtampy/': { priceFrom: 'от 900 ₽', term: 'за 1 день' },
  '/shirokoformat/press-wall/': { priceFrom: 'от 1 400 ₽', term: '2–3 дня' },
  // Подтипы визиток/листовок/буклетов — цены «от» для карточек категории.
  '/vizitki/standartnye/': { priceFrom: 'от 890 ₽', term: 'за 1 час' },
  '/vizitki/s-lakirovkoy/': { priceFrom: 'от 1 200 ₽', term: '1–2 дня' },
  '/vizitki/s-tisneniem/': { priceFrom: 'от 2 100 ₽', term: '1–2 дня' },
  '/vizitki/plastikovye/': { priceFrom: 'от 3 400 ₽', term: '2–3 дня' },
  '/listovki/a4/': { priceFrom: 'от 1 600 ₽', term: '1–2 дня' },
  '/listovki/a5/': { priceFrom: 'от 1 200 ₽', term: '1–2 дня' },
  '/listovki/a6-flyery/': { priceFrom: 'от 900 ₽', term: 'за 1 час' },
  '/buklety/evroformat/': { priceFrom: 'от 2 500 ₽', term: '2–3 дня' },
  '/suveniry/': { priceFrom: 'от 500 ₽', term: '2–5 дней' },
  '/poligrafiya/': { priceFrom: 'от 990 ₽', term: 'от 3 часов' },
};

function parentFromUrl(url: string): string | null {
  const seg = url.split('/').filter(Boolean);
  if (seg.length <= 1) return null;
  return '/' + seg.slice(0, -1).join('/') + '/';
}

function typeOf(page: SeoPage): PageType {
  if (page.url === B2B_SLUG) return 'b2b';
  if (INFO_SLUGS.has(page.url)) return 'info';
  if (SECTION_SLUGS.has(page.url)) return 'section';
  // Подразделы B2B — информационные, а не калькуляторы.
  if (parentFromUrl(page.url) === B2B_SLUG) return 'info';
  return 'service';
}

// Сборка карты узлов: SEO-страницы + синтетические.
const map = new Map<string, CatalogNode>();

for (const page of allSeoPages) {
  if (page.url === '/') continue; // главная — отдельный роут
  map.set(page.url, {
    slug: page.url,
    name: page.name,
    type: typeOf(page),
    parent: parentFromUrl(page.url),
    ...META[page.url],
  });
}
for (const node of SYNTHETIC) {
  if (!map.has(node.slug)) map.set(node.slug, { ...META[node.slug], ...node });
}

// Эти слаги обслуживаются отдельными роутами (блог-лист/статья, HTML-карта) —
// исключаем из catch-all, чтобы не было конфликта путей.
for (const s of ['/blog/', '/karta-sayta-html/']) map.delete(s);

export function getNode(slug: string): CatalogNode | undefined {
  return map.get(slug);
}
export function getChildren(slug: string): CatalogNode[] {
  const node = map.get(slug);
  const direct = [...map.values()].filter((n) => n.parent === slug);
  const extra = (node?.extraChildren ?? []).map((s) => map.get(s)).filter(Boolean) as CatalogNode[];
  // extra может пересекаться с direct — дедуп по slug
  const seen = new Set<string>();
  return [...extra, ...direct].filter((n) => (seen.has(n.slug) ? false : seen.add(n.slug)));
}

export function getBreadcrumbs(slug: string): { name: string; item: string }[] {
  const crumbs: { name: string; item: string }[] = [{ name: 'Главная', item: '/' }];
  const chain: CatalogNode[] = [];
  let cur = map.get(slug);
  while (cur) {
    chain.unshift(cur);
    cur = cur.parent ? map.get(cur.parent) : undefined;
  }
  for (const n of chain) crumbs.push({ name: n.name, item: n.slug });
  return crumbs;
}

/**
 * Соседние услуги для блока «Смотрите также». Приоритет: тот же раздел →
 * услуги родительского уровня → любые услуги. Блок присутствует на каждой
 * странице услуги (макет «страница услуги»), даже если прямых соседей нет.
 */
export function getSiblings(slug: string, limit = 4): CatalogNode[] {
  const node = map.get(slug);
  if (!node) return [];
  const services = [...map.values()].filter((n) => n.type === 'service' && n.slug !== slug);
  // 1. Прямые соседи — тот же родитель.
  let sibs = services.filter((n) => n.parent === node.parent);
  // 2. Резерв: услуги того же верхнего раздела (по первому сегменту URL).
  if (sibs.length === 0) {
    const section = '/' + slug.split('/').filter(Boolean)[0] + '/';
    sibs = services.filter((n) => n.slug.startsWith(section));
  }
  // 3. Резерв: любые услуги (чтобы блок не пропадал).
  if (sibs.length === 0) sibs = services;
  return sibs.slice(0, limit);
}

/** Смежные разделы для блока «Смотрите также» на странице категории. */
export function getRelatedSections(slug: string, limit = 5): CatalogNode[] {
  const node = map.get(slug);
  const parent = node?.parent ?? '/poligrafiya/';
  return getChildren(parent)
    .filter((n) => n.slug !== slug)
    .slice(0, limit);
}

/** Все slug для generateStaticParams (без ведущего/замыкающего слеша → массив сегментов). */
export function getAllSlugs(): string[][] {
  return [...map.keys()].map((s) => s.split('/').filter(Boolean));
}

export { getSeo };
