import { describe, expect, it } from 'vitest';
import {
  backendSlugOf,
  formatPriceFrom,
  formatTerm,
  mergeCategoryItems,
  overlayNav,
  overlayService,
  serviceNodeFromBackend,
} from './remote';
import type { Category, Service } from '@/lib/api/types';
import type { CatalogNode } from '@/data/catalog';
import type { NavItem } from '@/data/navigation';

function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: 'svc-1',
    categoryId: 'cat-1',
    slug: 'vizitki',
    title: 'Визитки',
    shortDescription: null,
    description: null,
    priceFrom: '990',
    productionTimeFrom: 1,
    isActive: true,
    sortOrder: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    images: [],
    ...overrides,
  };
}

describe('backendSlugOf', () => {
  it('берёт последний сегмент пути', () => {
    expect(backendSlugOf('/vizitki/')).toBe('vizitki');
    expect(backendSlugOf('/vizitki/s-lakirovkoy/')).toBe('s-lakirovkoy');
  });
});

describe('formatPriceFrom', () => {
  it('форматирует Decimal-строку в цену «от»', () => {
    // Intl для ru-RU использует неразрывный пробел — сравниваем без учёта вида пробела.
    expect(formatPriceFrom('990')).toBe('от 990 ₽');
    expect(formatPriceFrom('12500')?.replace(/ /g, ' ')).toBe('от 12 500 ₽');
  });
  it('null и мусор → undefined (остаёмся на статике)', () => {
    expect(formatPriceFrom(null)).toBeUndefined();
    expect(formatPriceFrom('abc')).toBeUndefined();
  });
});

describe('formatTerm', () => {
  it('склоняет дни после «от»', () => {
    expect(formatTerm(1)).toBe('от 1 дня');
    expect(formatTerm(3)).toBe('от 3 дней');
    expect(formatTerm(11)).toBe('от 11 дней');
    expect(formatTerm(21)).toBe('от 21 дня');
  });
  it('null и 0 → undefined', () => {
    expect(formatTerm(null)).toBeUndefined();
    expect(formatTerm(0)).toBeUndefined();
  });
});

describe('overlayService', () => {
  const node: CatalogNode = {
    slug: '/vizitki/',
    name: 'Старое имя',
    type: 'service',
    parent: null,
    priceFrom: 'от 500 ₽',
    term: 'за 1 час',
  };

  it('данные БД перекрывают статику', () => {
    const result = overlayService(node, makeService());
    expect(result.name).toBe('Визитки');
    expect(result.priceFrom).toBe('от 990 ₽');
    expect(result.term).toBe('от 1 дня');
  });

  it('пустые поля БД не затирают статику', () => {
    const result = overlayService(node, makeService({ priceFrom: null, productionTimeFrom: null }));
    expect(result.priceFrom).toBe('от 500 ₽');
    expect(result.term).toBe('за 1 час');
  });

  it('без данных БД узел не меняется', () => {
    expect(overlayService(node, null)).toBe(node);
  });
});

describe('mergeCategoryItems', () => {
  const staticItems: CatalogNode[] = [
    { slug: '/vizitki/standartnye/', name: 'Стандартные визитки', type: 'service', parent: '/vizitki/' },
    { slug: '/vizitki/premium-hub/', name: 'Премиум', type: 'section', parent: '/vizitki/' },
  ];

  it('без данных БД возвращает статику как есть', () => {
    expect(mergeCategoryItems('/vizitki/', staticItems, null)).toBe(staticItems);
    expect(mergeCategoryItems('/vizitki/', staticItems, [])).toBe(staticItems);
  });

  it('перекрывает совпавшие по слагу услуги и добавляет новые из БД', () => {
    const services = [
      makeService({ slug: 'standartnye', title: 'Визитки стандарт (БД)', priceFrom: '890' }),
      makeService({ id: 'svc-2', slug: 'novaya-usluga', title: 'Новая услуга' }),
    ];
    const result = mergeCategoryItems('/vizitki/', staticItems, services);

    expect(result).toHaveLength(3);
    expect(result[0].name).toBe('Визитки стандарт (БД)');
    expect(result[0].slug).toBe('/vizitki/standartnye/'); // путь остаётся статическим
    expect(result[1]).toBe(staticItems[1]); // section-дети не трогаем
    expect(result[2].slug).toBe('/vizitki/novaya-usluga/');
    expect(result[2].type).toBe('service');
  });

  it('не перекрывает section-детей услугой с тем же слагом и не плодит дубли', () => {
    const services = [makeService({ slug: 'premium-hub', title: 'Услуга-тёзка' })];
    const result = mergeCategoryItems('/vizitki/', staticItems, services);
    expect(result).toHaveLength(2);
    expect(result[1].name).toBe('Премиум');
  });
});

describe('overlayNav', () => {
  const nav: NavItem[] = [
    { id: 'fotopechat', label: 'Фотопечать (статика)', href: '/fotopechat/' },
    { id: 'suveniry', label: 'Сувениры', href: '/suveniry/' },
  ];
  const category: Category = {
    id: 'cat-1',
    parentId: null,
    slug: 'fotopechat',
    title: 'Фотопечать (БД)',
    description: null,
    isActive: true,
    sortOrder: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('название пункта берётся из категории БД, остальные не трогаются', () => {
    const result = overlayNav(nav, [category]);
    expect(result[0].label).toBe('Фотопечать (БД)');
    expect(result[1]).toBe(nav[1]);
  });

  it('без данных БД навигация не меняется', () => {
    expect(overlayNav(nav, null)).toBe(nav);
    expect(overlayNav(nav, [])).toBe(nav);
  });
});

describe('serviceNodeFromBackend', () => {
  it('строит узел услуги с родителем на сегмент выше', () => {
    const node = serviceNodeFromBackend('/vizitki/novaya/', makeService({ slug: 'novaya' }));
    expect(node.parent).toBe('/vizitki/');
    expect(node.type).toBe('service');
  });
  it('у корневого пути родителя нет', () => {
    expect(serviceNodeFromBackend('/novaya/', makeService()).parent).toBeNull();
  });
});
