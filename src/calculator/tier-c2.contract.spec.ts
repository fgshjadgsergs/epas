/**
 * Контракт TIER-калькуляторов партии C2 против ЗАФИКСИРОВАННОГО ожидаемого
 * набора из ТЗ_калькуляторы.md (не против more.ts). Ошибка показывает
 * конкретную услугу/параметр. БД не требуется — проверяем spec + фабрику.
 */
import { TIER_SPECS, tierDefinitionCreate, tierDemoPriceRulesCreate, type TierSpec } from '../../prisma/demo/tier-calculators-demo';

/** Ожидание из ТЗ: code → { раздел, slug, обязательные ключи параметров, дефолты, qty }. */
const EXPECTED: Record<string, { tz: string; slug: string; keys: string[]; defaults: Record<string, string>; minQty: number; maxQty: number; express: boolean }> = {
  booklets: { tz: '1.3', slug: 'buklety', keys: ['format', 'fold', 'paper', 'coating'], defaults: { format: 'a4-bifold', fold: 'bifold', paper: 'coated-150', coating: 'none' }, minQty: 100, maxQty: 50000, express: true },
  postcards: { tz: '1.4', slug: 'otkrytki', keys: ['format', 'w', 'h', 'paper', 'coating', 'foil', 'envelope'], defaults: { format: '148x105', paper: 'coated-350', coating: 'matte-lam', foil: 'no', envelope: 'none' }, minQty: 50, maxQty: 5000, express: false },
  certificates: { tz: '1.5', slug: 'sertifikaty', keys: ['format', 'paper', 'color', 'coating', 'emboss'], defaults: { format: 'A4', paper: 'design-200', color: '4+0', coating: 'none', emboss: 'none' }, minQty: 10, maxQty: 5000, express: true },
  'badges-blanks': { tz: '1.6', slug: 'birki-bejdzi-blanki', keys: ['subtype', 'tagFormat', 'badgeMaterial', 'blankFormat'], defaults: { subtype: 'badges' }, minQty: 10, maxQty: 50000, express: false },
  menu: { tz: '1.7', slug: 'menyu', keys: ['type', 'format', 'pages', 'binding', 'paper', 'coating'], defaults: { type: 'card', format: 'A4', pages: '8', binding: 'staple' }, minQty: 10, maxQty: 1000, express: true },
  stickers: { tz: '5.1', slug: 'pechat', keys: ['type', 'shape', 'size', 'sheetFormat', 'material'], defaults: { type: 'cut', material: 'paper-gloss' }, minQty: 1, maxQty: 100000, express: true },
  labels: { tz: '5.2', slug: 'etiketki', keys: ['type', 'width', 'height', 'material', 'tagMaterial', 'fix'], defaults: { type: 'label-roll', material: 'paper-white' }, minQty: 50, maxQty: 100000, express: false },
  'calendar-wall': { tz: '6.1', slug: 'nastennye', keys: ['format', 'sheets', 'binding', 'paper', 'coverCoating', 'year'], defaults: { format: 'A3', sheets: '12+1', binding: 'eurohook', year: '2027' }, minQty: 10, maxQty: 5000, express: false },
  'calendar-desk': { tz: '6.2', slug: 'nastolnye', keys: ['format', 'sheets', 'binding', 'stand', 'paper'], defaults: { format: 'A5', sheets: '12+1', binding: 'spiral-metal', stand: 'cardboard' }, minQty: 10, maxQty: 1000, express: false },
  'calendar-pocket': { tz: '6.3', slug: 'karmannye', keys: ['format', 'paper', 'coating'], defaults: { format: '70x100', paper: 'coated-300', coating: 'none' }, minQty: 100, maxQty: 50000, express: true },
};

const bySpec = new Map(TIER_SPECS.map((s) => [s.code, s]));

describe('C2 TIER contract vs ТЗ_калькуляторы.md', () => {
  it('ровно 10 in-ТЗ услуг; фото-календари/планинги отсутствуют (TZ_ABSENT)', () => {
    expect(TIER_SPECS).toHaveLength(10);
    const codes = TIER_SPECS.map((s) => s.code).sort();
    expect(codes).toEqual(Object.keys(EXPECTED).sort());
    expect(codes).not.toContain('photo-calendar');
    expect(codes).not.toContain('planner');
  });

  it('коды и slug уникальны', () => {
    expect(new Set(TIER_SPECS.map((s) => s.code)).size).toBe(10);
    expect(new Set(TIER_SPECS.map((s) => s.slug)).size).toBe(10);
  });

  describe.each(Object.entries(EXPECTED))('%s', (code, exp) => {
    const spec = bySpec.get(code) as TierSpec;

    it('раздел ТЗ, slug, qty-границы, express', () => {
      expect(spec).toBeDefined();
      expect(spec.tz).toBe(exp.tz);
      expect(spec.slug).toBe(exp.slug);
      expect(spec.minQty).toBe(exp.minQty);
      expect(spec.maxQty).toBe(exp.maxQty);
      expect(!!spec.express).toBe(exp.express);
    });

    it('обязательные параметры ТЗ присутствуют, ключи уникальны', () => {
      const keys = spec.params.map((p) => p.key);
      for (const k of exp.keys) expect(keys).toContain(k);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('дефолты вариантов совпадают с ТЗ', () => {
      for (const [key, val] of Object.entries(exp.defaults)) {
        const p = spec.params.find((x) => x.key === key)!;
        const def = p.opts?.find((o) => o.def)?.v;
        expect(def).toBe(val);
      }
    });

    it('тиражи монотонны, каждый — с ценой', () => {
      for (let i = 1; i < spec.tiers.length; i++) expect(spec.tiers[i][0]).toBeGreaterThan(spec.tiers[i - 1][0]);
      for (const [, price] of spec.tiers) expect(price).toBeGreaterThan(0);
    });
  });

  it('фабрика definition: express→TOGGLE-параметр + MAX_QTY, а иначе нет', () => {
    const withExpress = tierDefinitionCreate(bySpec.get('booklets')!, 1) as never as { parameters: { create: { urlKey: string }[] }; compatibilityRules?: { create: { kind: string }[] } };
    expect(withExpress.parameters.create.some((p) => p.urlKey === 'express')).toBe(true);
    expect(withExpress.compatibilityRules?.create.some((c) => c.kind === 'MAX_QTY')).toBe(true);

    const noExpress = tierDefinitionCreate(bySpec.get('postcards')!, 1) as never as { parameters: { create: { urlKey: string }[] } };
    expect(noExpress.parameters.create.some((p) => p.urlKey === 'express')).toBe(false);
  });

  it('фабрика rules: BASE_TIER = число тиражей, qtyTo=next−1, coeff→MULTIPLIER, perUnit→SURCHARGE_PER_UNIT', () => {
    const spec = bySpec.get('postcards')!;
    const rules = (tierDemoPriceRulesCreate(spec) as never as { create: { kind: string; qtyFrom?: number; qtyTo?: number | null; condition?: Record<string, string>; multiplier?: number; amountMinor?: number }[] }).create;
    const base = rules.filter((r) => r.kind === 'BASE_TIER');
    expect(base).toHaveLength(spec.tiers.length);
    expect(base[0].qtyTo).toBe(spec.tiers[1][0] - 1);
    expect(base.at(-1)!.qtyTo).toBeNull();
    // Конверт c6 = +8 ₽/шт из ТЗ → SURCHARGE_PER_UNIT 800 копеек.
    const c6 = rules.find((r) => r.kind === 'SURCHARGE_PER_UNIT' && r.condition?.envelope === 'c6');
    expect(c6?.amountMinor).toBe(800);
    // Тиснение +15 % → MULTIPLIER 1.15.
    const foil = rules.find((r) => r.kind === 'MULTIPLIER' && r.condition?.foil === 'yes');
    expect(foil?.multiplier).toBe(1.15);
  });
});
