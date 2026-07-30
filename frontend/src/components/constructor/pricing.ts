import type { BookParams } from './store';

/**
 * Демо-расчёт стоимости фотокниги (ТЗ конструктора, п.3).
 * На проде — POST /api/v1/photobook/calculate (форма ответа совпадает).
 */
export function pricePhotobook(params: BookParams, spreadsCount: number) {
  const bind = { layflat: 1.3, hardcover: 1, softcover: 0.8 }[params.binding];
  const size = { '20x20': 1, '25x25': 1.3, '30x30': 1.8 }[params.size];
  const cover = { standard: 1, leatherette: 1.15, design: 1.1 }[params.cover];
  const paper = { 'coated-170': 1, 'coated-200': 1.08, 'layflat-170': 1.2 }[params.paper];
  const base = (1200 + spreadsCount * 55) * bind * size * cover * paper;
  let total = base * params.copies;
  if (params.copies >= 5) total *= 0.9;
  else if (params.copies >= 2) total *= 0.95;
  return {
    price: Math.round(total / 10) * 10,
    perUnit: Math.round(base),
    days: 5 + (params.binding === 'layflat' ? 2 : 0),
  };
}
