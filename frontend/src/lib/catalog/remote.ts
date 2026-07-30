/**
 * Мост между backend-каталогом (GET /categories, /services) и статической
 * картой сайта (src/data/catalog.ts).
 *
 * Стратегия «постепенной замены моков» (этап 3):
 * - слаг backend = последний сегмент URL-пути страницы
 *   (страница /vizitki/ ↔ Category/Service со slug "vizitki");
 * - если backend знает узел — его данные (название, цена, срок, описание)
 *   перекрывают статические;
 * - если backend недоступен или узла в БД нет — страница рендерится из
 *   статических данных как раньше. Сайт не ломается ни в одном сценарии
 *   (в т.ч. при `next build` без запущенного backend — тогда страницы
 *   собираются на моках и обновляются через ISR после старта).
 *
 * Только для server components: fetch выполняется на сервере с ISR-кэшем.
 */
import { getCategories, getCategoryBySlug, getCategoryServices } from '@/lib/api/categories';
import { getServiceBySlug } from '@/lib/api/services';
import { ApiError } from '@/lib/api/client';
import type { Category, Service } from '@/lib/api/types';
import type { CatalogNode } from '@/data/catalog';
import type { NavItem } from '@/data/navigation';

/** Срок ISR-кэша каталога, сек. Контент меняется редко — 5 минут достаточно. */
const CATALOG_REVALIDATE = 300;
/** Cache-тег каталога: админ-мутация точечно инвалидирует его (revalidateTag). */
export const CATALOG_TAG = 'catalog';

/** Последний сегмент пути: '/vizitki/s-lakirovkoy/' → 's-lakirovkoy'. */
export function backendSlugOf(pathSlug: string): string {
  const segments = pathSlug.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? '';
}

/**
 * Авторитетный сигнал «узел снят с публикации» (backend вернул 410 Gone).
 * Отличается от `null`: null = «backend недоступен ИЛИ узла в БД нет вовсе»
 * (штатный фолбэк на статику), GONE = «узел есть в БД, но деактивирован» —
 * статика его НЕ воскрешает, страница должна вернуть 404 (F-9).
 */
export const GONE = Symbol('catalog-node-gone');
export type MaybeGone<T> = T | null | typeof GONE;

/**
 * Глушим ожидаемые сбои каталога:
 * - 404 (узла нет в БД) и недоступность backend (status 0) → `null`:
 *   штатный фолбэк на статические данные (в т.ч. страницы-варианты, чей slug
 *   не является отдельной backend-услугой);
 * - 410 Gone (узел деактивирован) → `GONE`: авторитетный сигнал, фолбэк на
 *   статику запрещён (иначе снятая услуга «воскресает»).
 */
/**
 * Классификация ошибки каталога (чистая, тестируемая без промисов):
 * - 410 Gone → `GONE` (узел деактивирован, статика не воскрешает);
 * - 404 / недоступность backend (status 0) → `null` (штатный фолбэк на статику);
 * - прочее (5xx и т. п.) → `null` + предупреждение (не роняем страницу).
 */
export function classifyCatalogError<T = never>(error: unknown): MaybeGone<T> {
  if (error instanceof ApiError && error.status === 410) return GONE;
  if (!(error instanceof ApiError) || (error.status !== 404 && error.status !== 0)) {
    console.warn('[catalog/remote] backend request failed:', error);
  }
  return null;
}

async function swallow<T>(promise: Promise<T>): Promise<MaybeGone<T>> {
  try {
    return await promise;
  } catch (error) {
    return classifyCatalogError<T>(error);
  }
}

export function fetchCategory(pathSlug: string): Promise<MaybeGone<Category>> {
  return swallow(getCategoryBySlug(backendSlugOf(pathSlug), { revalidate: CATALOG_REVALIDATE, tags: [CATALOG_TAG] }));
}

export function fetchCategoryServices(pathSlug: string): Promise<Service[] | null> {
  // Список услуг категории: 410 здесь неактуален — трактуем как отсутствие.
  const result = swallow(getCategoryServices(backendSlugOf(pathSlug), { revalidate: CATALOG_REVALIDATE, tags: [CATALOG_TAG] }));
  return result.then((r) => (r === GONE ? null : r));
}

export function fetchService(pathSlug: string): Promise<MaybeGone<Service>> {
  return swallow(getServiceBySlug(backendSlugOf(pathSlug), { revalidate: CATALOG_REVALIDATE, tags: [CATALOG_TAG] }));
}

/** Все активные категории (для навигации). */
export async function fetchCategories(): Promise<Category[] | null> {
  const page = await swallow(getCategories({ limit: 100 }, { revalidate: CATALOG_REVALIDATE, tags: [CATALOG_TAG] }));
  // Список категорий: 410 неактуален (это коллекция) — трактуем как отсутствие.
  return page && page !== GONE ? page.items : null;
}

/**
 * Названия пунктов каталожной навигации из БД: пункт, чей href совпадает
 * с категорией по слагу, получает её название. Состав пунктов, мегаменю
 * и промо-блоки остаются статическими — в backend-модели категории этих
 * данных нет (см. «ТЗ навигация», п.3.2).
 */
export function overlayNav(nav: NavItem[], categories: Category[] | null): NavItem[] {
  if (!categories || categories.length === 0) return nav;
  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  return nav.map((item) => {
    const category = bySlug.get(backendSlugOf(item.href));
    return category ? { ...item, label: category.title } : item;
  });
}

/** '990' (Decimal-строка backend) → 'от 990 ₽' для карточек и шапки услуги. */
export function formatPriceFrom(priceFrom: string | null): string | undefined {
  if (priceFrom === null) return undefined;
  const value = Number(priceFrom);
  if (!Number.isFinite(value)) return undefined;
  return `от ${new Intl.NumberFormat('ru-RU').format(value)} ₽`;
}

/** productionTimeFrom (дней) → 'от 1 дня' / 'от 3 дней'. */
export function formatTerm(days: number | null): string | undefined {
  if (days === null || days <= 0) return undefined;
  const mod10 = days % 10;
  const mod100 = days % 100;
  // Родительный падеж после «от»: от 1 дня, от 2 дней, от 21 дня.
  const word = mod10 === 1 && mod100 !== 11 ? 'дня' : 'дней';
  return `от ${days} ${word}`;
}

/** Данные категории из БД поверх статического узла. */
export function overlayCategory(node: CatalogNode, category: Category | null): CatalogNode {
  if (!category) return node;
  return { ...node, name: category.title };
}

/** Данные услуги из БД поверх статического узла. */
export function overlayService(node: CatalogNode, service: Service | null): CatalogNode {
  if (!service) return node;
  return {
    ...node,
    name: service.title,
    priceFrom: formatPriceFrom(service.priceFrom) ?? node.priceFrom,
    term: formatTerm(service.productionTimeFrom) ?? node.term,
  };
}

/**
 * Узел каталога для услуги, которой нет в статической карте (создана через
 * админку). Родитель — путь на сегмент выше ('/vizitki/premium/' → '/vizitki/').
 */
export function serviceNodeFromBackend(pathSlug: string, service: Service): CatalogNode {
  const segments = pathSlug.split('/').filter(Boolean);
  const parent = segments.length > 1 ? '/' + segments.slice(0, -1).join('/') + '/' : null;
  return {
    slug: pathSlug,
    name: service.title,
    type: 'service',
    parent,
    priceFrom: formatPriceFrom(service.priceFrom),
    term: formatTerm(service.productionTimeFrom),
  };
}

/** Узел для категории, которой нет в статической карте (создана через админку). */
export function categoryNodeFromBackend(pathSlug: string, category: Category): CatalogNode {
  return { slug: pathSlug, name: category.title, type: 'section', parent: null };
}

/**
 * Карточки страницы категории: услуги из БД поверх статических детей.
 * Совпадение — по backend-слагу (последнему сегменту пути карточки).
 * Услуги, которых в статике нет, добавляются в конец детьми категории.
 */
export function mergeCategoryItems(
  categoryPathSlug: string,
  staticItems: CatalogNode[],
  services: Service[] | null,
): CatalogNode[] {
  if (!services || services.length === 0) return staticItems;
  const bySlug = new Map(services.map((s) => [s.slug, s]));
  const merged = staticItems.map((item) => {
    if (item.type !== 'service') return item;
    const service = bySlug.get(backendSlugOf(item.slug));
    if (!service) return item;
    bySlug.delete(service.slug);
    return overlayService(item, service);
  });
  // Занятые пути (в т.ч. section-детьми) — чтобы не плодить карточки-дубли.
  const takenSlugs = new Set(staticItems.map((item) => backendSlugOf(item.slug)));
  for (const service of bySlug.values()) {
    if (takenSlugs.has(service.slug)) continue;
    merged.push(serviceNodeFromBackend(`${categoryPathSlug}${service.slug}/`, service));
  }
  return merged;
}
