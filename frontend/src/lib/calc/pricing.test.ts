import { describe, it, expect } from 'vitest';
import { calculate, expressAvailability, parseCounts, serializeCounts } from './pricing';
import { buildDefaultState } from './url-sync';
import { businessCards } from './configs/business-cards';
import { banner } from './configs/banner';
import { idPhoto } from './configs/id-photo';
import { leaflets } from './configs/leaflets';
import { photoPrint, postcards, tshirt } from './configs/more';

describe('calculate — тираж (визитки)', () => {
  it('считает цену и выгоду; цена за единицу падает с тиражом', () => {
    const s100 = { ...buildDefaultState(businessCards), qty: 100 };
    const s1000 = { ...buildDefaultState(businessCards), qty: 1000 };
    const r100 = calculate(businessCards, s100);
    const r1000 = calculate(businessCards, s1000);

    expect(r100.price).toBeGreaterThan(0);
    expect(r1000.pricePerUnit).toBeLessThan(r100.pricePerUnit); // выгода от тиража
    expect(r1000.savingsPct).toBeGreaterThan(0);
  });

  it('B2B добавляет НДС 20%', () => {
    const st = buildDefaultState(businessCards);
    const r = calculate(businessCards, st);
    expect(r.priceWithVat).toBe(Math.round((r.price * 1.2) / 10) * 10);
  });

  it('срочность увеличивает цену', () => {
    const base = buildDefaultState(businessCards);
    const std = calculate(businessCards, base);
    const exp = calculate(businessCards, { ...base, express: true });
    expect(exp.price).toBeGreaterThan(std.price);
  });
});

describe('срочность — правила по услугам (ТЗ «Калькуляторы цен»)', () => {
  it('листовки: экспресс-бейдж +30% в presentation-конфиге (лимит тиража — правило backend)', () => {
    const base = { ...buildDefaultState(leaflets), qty: 1000 };
    const std = calculate(leaflets, base);
    const exp = calculate(leaflets, { ...base, express: true });
    // ×1.3 с точностью до округления к 10 ₽ — демо-фолбэк без backend.
    expect(exp.price).toBeGreaterThanOrEqual(std.price * 1.3 - 10);
    expect(exp.price).toBeLessThanOrEqual(std.price * 1.3 + 10);
    // Ограничение «до 2 000 шт.» перенесено в backend definition (MAX_QTY,
    // см. src/calculator/leaflets.spec.ts) — локальный конфиг его не хранит.
  });

  it('визитки: экспресс недоступен для пластиковых и тиража > 1 000', () => {
    const base = buildDefaultState(businessCards);
    expect(expressAvailability(businessCards, { params: base.params, qty: 100 }).ok).toBe(true);
    expect(expressAvailability(businessCards, { params: base.params, qty: 2000 }).ok).toBe(false);
    expect(
      expressAvailability(businessCards, { params: { ...base.params, subtype: 'plastic' }, qty: 100 }).ok,
    ).toBe(false);
  });

  it('открытки: только standard — экспресс не влияет на цену', () => {
    const base = buildDefaultState(postcards);
    const std = calculate(postcards, base);
    const exp = calculate(postcards, { ...base, express: true });
    expect(exp.price).toBe(std.price);
  });

  it('пластиковые визитки: минимальный тираж 100 шт.', () => {
    const base = buildDefaultState(businessCards);
    const r = calculate(businessCards, {
      ...base,
      params: { ...base.params, subtype: 'plastic' },
      qty: 50,
    });
    // Расчёт поднимает тираж до минимума → цена за 100 шт., а не за 50
    expect(r.price / r.pricePerUnit).toBeGreaterThanOrEqual(99);
  });
});

describe('calculate — площадь (баннер)', () => {
  it('цена растёт с площадью', () => {
    const small = {
      ...buildDefaultState(banner),
      params: { ...buildDefaultState(banner).params, width: 1, height: 1 },
    };
    const big = {
      ...buildDefaultState(banner),
      params: { ...buildDefaultState(banner).params, width: 3, height: 2 },
    };
    expect(calculate(banner, big).price).toBeGreaterThan(calculate(banner, small).price);
  });
});

describe('мультиколичество (ТЗ п.3.1/8.1)', () => {
  it('parseCounts/serializeCounts — обратимы, нули отбрасываются', () => {
    expect(parseCounts('10x15:24,20x30:2')).toEqual({ '10x15': 24, '20x30': 2 });
    expect(serializeCounts({ a: 3, b: 0 })).toBe('a:3');
  });

  it('фотопечать: сумма по форматам с фикс-ценами', () => {
    const base = buildDefaultState(photoPrint);
    const r = calculate(photoPrint, {
      ...base,
      params: { ...base.params, formats: '10x15:10,20x30:2' },
    });
    // 10×18 + 2×70 = 320 ₽ (округление к 10 ₽)
    expect(r.price).toBe(320);
    expect(r.price / r.pricePerUnit).toBeCloseTo(12, 0); // тираж = 12 фото
  });

  it('футболки: мультиразмер — 2XL дороже M, тираж суммируется', () => {
    const base = buildDefaultState(tshirt);
    const m = calculate(tshirt, { ...base, params: { ...base.params, sizes: 'M:10' } });
    const xxl = calculate(tshirt, { ...base, params: { ...base.params, sizes: '2XL:10' } });
    expect(xxl.price).toBeGreaterThan(m.price);
    const mixed = calculate(tshirt, { ...base, params: { ...base.params, sizes: 'M:5,L:5' } });
    expect(mixed.price).toBe(m.price); // одинаковые коэффициенты → та же цена
  });
});

describe('calculate — фикс-цена (фото на документы)', () => {
  it('берёт цену выбранного документа и даёт скидку от 5 комплектов', () => {
    const one = { ...buildDefaultState(idPhoto), qty: 1 };
    const five = { ...buildDefaultState(idPhoto), qty: 5 };
    const r1 = calculate(idPhoto, one);
    const r5 = calculate(idPhoto, five);
    expect(r1.price).toBe(300); // паспорт РФ
    expect(r5.pricePerUnit).toBeLessThan(r1.pricePerUnit); // скидка от 5 шт.
  });
});
