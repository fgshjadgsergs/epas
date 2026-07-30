import { getCalculator } from '@/lib/calc/registry';
import type { CalcConfig } from '@/lib/calc/types';
import type { CatalogNode } from '@/data/catalog';
import type { ListingItem } from '@/components/catalog/category-listing';

/** Числовая цена «от» из строки прайса («от 990 ₽» → 990). */
function priceNumber(node: CatalogNode): number {
  const m = node.priceFrom?.match(/\d[\d\s]*/);
  return m ? Number(m[0].replace(/\s/g, '')) : Number.MAX_SAFE_INTEGER;
}

/** Все подписи опций калькулятора — для сопоставления с фасетами. */
function optionLabels(config: CalcConfig): string[] {
  const out: string[] = [];
  for (const g of config.groups) for (const o of g.options ?? []) out.push(o.label);
  return out;
}

/** Диапазон тиража из порогов/диапазона калькулятора. */
function tirazhRange(config: CalcConfig): [number, number] | null {
  if (config.qtyTiers?.length) {
    const qs = config.qtyTiers.map((t) => t.qty);
    return [Math.min(...qs), Math.max(...qs)];
  }
  return null;
}

/**
 * Выводит фасеты услуги (Тираж/Бумага/Ламинация/Срок) для фильтра страницы
 * категории из её калькулятора; для услуг без калькулятора — из срока в каталоге.
 */
export function deriveFacets(node: CatalogNode): ListingItem {
  const calc = getCalculator(node.slug)?.config;
  const tirazh: string[] = [];
  const paper: string[] = [];
  const lamination: string[] = [];
  const srok: string[] = [];

  if (calc) {
    const range = tirazhRange(calc);
    if (range) {
      for (const q of [100, 200, 500, 1000, 2000]) if (q >= range[0] && q <= range[1]) tirazh.push(`${q} шт`);
    }
    const labels = optionLabels(calc).join(' · ').toLowerCase();
    if (labels.includes('мелован')) paper.push('Мелованная');
    if (labels.includes('дизайн')) paper.push('Дизайнерская');
    if (labels.includes('крафт')) paper.push('Крафт');
    if (labels.includes('пластик') || labels.includes('pvc') || labels.includes('пвх')) paper.push('Пластик');
    if (labels.includes('без покрыт') || labels.includes('без ламин') || labels.includes('без')) lamination.push('Без ламинации');
    if (labels.includes('матов')) lamination.push('Матовая');
    if (labels.includes('глянц')) lamination.push('Глянцевая');
    if (labels.includes('soft touch')) lamination.push('Soft Touch');
  }

  // Срок из калькулятора (экспресс) либо из подписи срока каталога.
  const termText = (node.term ?? '').toLowerCase();
  srok.push('Стандарт');
  if (calc?.express || /час|срочн|экспресс/.test(termText)) srok.push('Срочно');
  if ((calc?.express && calc.express.days <= 0) || /час/.test(termText)) srok.push('1 час');

  return {
    slug: node.slug,
    name: node.name,
    priceFrom: node.priceFrom,
    term: node.term,
    price: priceNumber(node),
    tirazh,
    paper,
    lamination,
    srok: [...new Set(srok)],
  };
}
