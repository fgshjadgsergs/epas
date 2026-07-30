import { describe, expect, it } from 'vitest';
import {
  buildUrl,
  canonicalizeMultiQty,
  mergeSearch,
  parseUrlState,
  serializeUrlState,
  type UrlStateSpec,
} from './url-state';

/** Spec по мотивам визиток (urlOrder из definition backend). */
const spec: UrlStateSpec = {
  order: ['subtype', 'format', 'paper', 'coating', 'sides', 'qty', 'express'],
  params: [
    {
      key: 'subtype',
      shareable: true,
      defaultValue: 'standard',
      allowedValues: ['standard', 'lacquer', 'foil', 'plastic'],
    },
    {
      key: 'format',
      shareable: true,
      defaultValue: '90x50',
      allowedValues: ['90x50', '85x55', '90x90', '55x55', 'custom'],
    },
    {
      key: 'paper',
      shareable: true,
      defaultValue: 'coated-350',
      allowedValues: ['coated-300', 'coated-350', 'design'],
    },
    {
      key: 'coating',
      shareable: true,
      defaultValue: 'none',
      allowedValues: ['none', 'matte-lam', 'gloss-lam', 'soft-touch'],
    },
    { key: 'sides', shareable: true, defaultValue: 'double', allowedValues: ['single', 'double'] },
    { key: 'qty', shareable: true, defaultValue: '100', numeric: { min: 50, max: 10000 } },
    { key: 'express', shareable: true, defaultValue: '0', allowedValues: ['0', '1'] },
    // Запрещённые к шарингу параметры — shareable: false.
    { key: 'promoCode', shareable: false, defaultValue: '' },
    { key: 'b2bMode', shareable: false, defaultValue: '0' },
  ],
};

describe('serializeUrlState', () => {
  it('дефолты не включаются: полное дефолтное состояние → пустая строка (без «?»)', () => {
    const search = serializeUrlState(spec, {
      subtype: 'standard',
      format: '90x50',
      paper: 'coated-350',
      coating: 'none',
      sides: 'double',
      qty: 100,
      express: false,
    });
    expect(search).toBe('');
    expect(buildUrl('/vizitki/', search)).toBe('/vizitki/');
  });

  it('порядок ключей фиксирован независимо от порядка во входном объекте', () => {
    const search = serializeUrlState(spec, {
      qty: 500,
      coating: 'matte-lam',
      format: '85x55',
    });
    expect(search).toBe('format=85x55&coating=matte-lam&qty=500');
  });

  it('одинаковое состояние даёт одинаковый URL', () => {
    const a = serializeUrlState(spec, { qty: 300, paper: 'design' });
    const b = serializeUrlState(spec, { paper: 'design', qty: 300 });
    expect(a).toBe(b);
  });

  it('shareable:false параметры не сериализуются (promo/b2b)', () => {
    const search = serializeUrlState(spec, {
      qty: 200,
      promoCode: 'SECRET-10',
      b2bMode: '1',
    });
    expect(search).toBe('qty=200');
    expect(search).not.toContain('SECRET');
  });

  it('boolean сериализуется как 1/0, false-дефолт не пишется', () => {
    expect(serializeUrlState(spec, { express: true })).toBe('express=1');
    expect(serializeUrlState(spec, { express: false })).toBe('');
  });

  it('кодирует спецсимволы стандартно для query string', () => {
    const custom: UrlStateSpec = {
      order: ['color'],
      params: [{ key: 'color', shareable: true, defaultValue: '4x0', allowedValues: ['4x0', '4+4'] }],
    };
    expect(serializeUrlState(custom, { color: '4+4' })).toBe('color=4%2B4');
  });
});

describe('parseUrlState', () => {
  it('восстанавливает валидные значения', () => {
    const { values, invalidKeys } = parseUrlState(spec, 'format=85x55&coating=matte-lam&qty=500');
    expect(values).toEqual({ format: '85x55', coating: 'matte-lam', qty: '500' });
    expect(invalidKeys).toEqual([]);
  });

  it('игнорирует неизвестные ключи (utm и чужие параметры)', () => {
    const { values, invalidKeys } = parseUrlState(spec, 'utm_source=vk&qty=200&foo=bar');
    expect(values).toEqual({ qty: '200' });
    expect(invalidKeys).toEqual([]);
  });

  it('некорректные значения не падают: qty=abc и paper=unknown → default + invalidKeys', () => {
    const { values, invalidKeys } = parseUrlState(spec, 'qty=abc&paper=unknown&sides=single');
    expect(values).toEqual({ sides: 'single' });
    expect(invalidKeys.sort()).toEqual(['paper', 'qty']);
  });

  it('qty вне диапазона считается некорректным', () => {
    const { invalidKeys } = parseUrlState(spec, 'qty=999999');
    expect(invalidKeys).toEqual(['qty']);
  });

  it('не читает из URL запрещённые параметры, даже если их туда подставили', () => {
    const { values } = parseUrlState(spec, 'promoCode=HACK&b2bMode=1&qty=200');
    expect(values).toEqual({ qty: '200' });
  });

  it('round-trip: сериализация → парсинг возвращает те же значения', () => {
    const state = { format: 'custom', coating: 'soft-touch', qty: 250, express: true };
    const parsed = parseUrlState(spec, serializeUrlState(spec, state));
    expect(parsed.values).toEqual({
      format: 'custom',
      coating: 'soft-touch',
      qty: '250',
      express: '1',
    });
  });
});

describe('mergeSearch', () => {
  it('сохраняет чужие параметры (utm) и ставит наши в канонический порядок', () => {
    const ours = serializeUrlState(spec, { qty: 500, coating: 'matte-lam' });
    const merged = mergeSearch(spec, ours, 'utm_source=vk&coating=old&qty=1');
    expect(merged).toBe('coating=matte-lam&qty=500&utm_source=vk');
  });

  it('без наших и чужих параметров — пустая строка', () => {
    expect(mergeSearch(spec, '', '')).toBe('');
  });
});

describe('multi-qty в URL (формат key:qty,key:qty)', () => {
  const spec: UrlStateSpec = {
    order: ['formats', 'paper', 'qty'],
    params: [
      {
        key: 'formats',
        shareable: true,
        defaultValue: '10x15:10',
        multiQtyKeys: ['10x15', '13x18', '20x30'],
      },
      { key: 'paper', shareable: true, defaultValue: 'gloss', allowedValues: ['gloss', 'satin'] },
      { key: 'qty', shareable: true, defaultValue: '10', numeric: { min: 1, max: 10000 } },
    ],
  };

  it('canonicalizeMultiQty: порядок definition, дубликаты и мусор отброшены', () => {
    expect(canonicalizeMultiQty('20x30:2,10x15:100', ['10x15', '13x18', '20x30'])).toBe('10x15:100,20x30:2');
    expect(canonicalizeMultiQty('10x15:5,10x15:9', ['10x15'])).toBe('10x15:5'); // duplicate: первый выигрывает
    expect(canonicalizeMultiQty('nope:5,10x15:0,13x18:-2,20x30:1.5', ['10x15', '13x18', '20x30'])).toBeNull();
    expect(canonicalizeMultiQty('10x15:abc,13x18:3', ['10x15', '13x18'])).toBe('13x18:3');
  });

  it('сериализация: одна конфигурация — одна строка; дефолт не пишется', () => {
    expect(serializeUrlState(spec, { formats: '10x15:100,20x30:2' })).toBe(
      new URLSearchParams({ formats: '10x15:100,20x30:2' }).toString(),
    );
    // Тот же набор в другом порядке даёт побайтово ту же строку.
    expect(serializeUrlState(spec, { formats: '20x30:2,10x15:100' })).toBe(
      serializeUrlState(spec, { formats: '10x15:100,20x30:2' }),
    );
    // Значение, совпадающее с дефолтом — опускается; пустой multi не мусорит query.
    expect(serializeUrlState(spec, { formats: '10x15:10' })).toBe('');
    expect(serializeUrlState(spec, { formats: '' })).toBe('');
  });

  it('парсинг: неизвестные строки и нарушенный порядок нормализуются (replaceState)', () => {
    const ok = parseUrlState(spec, 'formats=10x15%3A100%2C20x30%3A2');
    expect(ok.values.formats).toBe('10x15:100,20x30:2');
    expect(ok.invalidKeys).toEqual([]);

    const messy = parseUrlState(spec, 'formats=20x30:2,unknown:5,10x15:100');
    expect(messy.values.formats).toBe('10x15:100,20x30:2');
    expect(messy.invalidKeys).toContain('formats'); // канонизация → нормализация URL

    const garbage = parseUrlState(spec, 'formats=zzz');
    expect(garbage.values.formats).toBeUndefined();
    expect(garbage.invalidKeys).toContain('formats');
  });
});
