/**
 * Контракт размерных калькуляторов C3 против зафиксированного ожидания из
 * ТЗ_калькуляторы.md (не против more2.ts). 5 AREA + rollup (TIER). БД не нужна.
 */
import { AREA_SPECS, ROLLUP_SPEC, areaDefinitionCreate, areaDemoPriceRulesCreate, rollupDefinitionCreate, rollupDemoPriceRulesCreate, type AreaSpec } from '../../prisma/demo/metric-calculators-demo';

const EXPECTED: Record<string, { tz: string; slug: string; unit: 'cm' | 'm'; material?: string[]; options: string[]; express: boolean }> = {
  'poster-print': { tz: '3.5', slug: 'postery-i-plakaty', unit: 'cm', material: ['poster-130', 'matte-photo', 'glossy-photo'], options: [], express: true },
  'canvas-print': { tz: '3.4', slug: 'pechat-na-holste', unit: 'cm', options: ['subframe', 'edge'], express: true },
  'foam-board': { tz: '3.6', slug: 'nakatka-na-penokarton', unit: 'cm', material: ['poster-130', 'matte-photo', 'glossy-photo'], options: ['thickness', 'loop'], express: true },
  presswall: { tz: '4.3', slug: 'press-wall', unit: 'm', material: ['banner-440', 'satin'], options: ['construction'], express: false },
  'interior-print': { tz: '4.4', slug: 'interyernaya-pechat', unit: 'cm', material: ['self-adhesive-matte', 'self-adhesive-gloss', 'self-adhesive-wall', 'canvas', 'backlit-film'], options: ['lamination'], express: true },
};

const byCode = new Map(AREA_SPECS.map((s) => [s.code, s]));

describe('C3 metric contract vs ТЗ_калькуляторы.md', () => {
  it('5 AREA услуг + rollup; коды/slug уникальны', () => {
    expect(AREA_SPECS).toHaveLength(5);
    expect(new Set(AREA_SPECS.map((s) => s.slug)).size).toBe(5);
    expect(AREA_SPECS.map((s) => s.code).sort()).toEqual(Object.keys(EXPECTED).sort());
    expect(ROLLUP_SPEC.code).toBe('rollup');
    expect(ROLLUP_SPEC.slug).toBe('roll-up');
  });

  describe.each(Object.entries(EXPECTED))('%s (AREA)', (code, exp) => {
    const spec = byCode.get(code) as AreaSpec;

    it('раздел ТЗ, slug, единица измерения, express', () => {
      expect(spec.tz).toBe(exp.tz);
      expect(spec.slug).toBe(exp.slug);
      expect(spec.unit).toBe(exp.unit);
      expect(!!spec.express).toBe(exp.express);
    });

    it('материалы и опции ТЗ присутствуют', () => {
      if (exp.material) {
        expect(spec.material).toBeDefined();
        for (const m of exp.material) expect(spec.material!.opts.map((o) => o.v)).toContain(m);
      }
      const optKeys = (spec.options ?? []).map((p) => p.key);
      for (const k of exp.options) expect(optKeys).toContain(k);
    });

    it('definition: pricingMode AREA, w/h DIMENSION с config.unit, метрика площади', () => {
      const def = areaDefinitionCreate(spec, 1) as never as { pricingMode: string; config: { area: { unit: string }; metrics: { kind: string }[] }; parameters: { create: { urlKey: string; type: string; config?: { unit: string } }[] } };
      expect(def.pricingMode).toBe('AREA');
      expect(def.config.area.unit).toBe(exp.unit);
      expect(def.config.metrics.some((m) => m.kind === 'AREA')).toBe(true);
      const w = def.parameters.create.find((p) => p.urlKey === 'w')!;
      expect(w.type).toBe('DIMENSION');
      expect(w.config?.unit).toBe(exp.unit);
    });

    it('rules: есть BASE_PER_SQM; ₽/м² по материалам различаются', () => {
      const rules = (areaDemoPriceRulesCreate(spec) as never as { create: { kind: string; condition?: Record<string, string>; amountMinor?: number; multiplier?: number }[] }).create;
      expect(rules.some((r) => r.kind === 'BASE_PER_SQM' && !r.condition)).toBe(true);
      if (spec.material) {
        const conditional = rules.filter((r) => r.kind === 'BASE_PER_SQM' && r.condition);
        expect(conditional.length).toBeGreaterThan(0);
      }
    });
  });

  it('foam-board: петля +30 ₽ → SURCHARGE_PER_UNIT 3000 копеек (ТЗ 3.6)', () => {
    const rules = (areaDemoPriceRulesCreate(byCode.get('foam-board')!) as never as { create: { kind: string; condition?: Record<string, string>; amountMinor?: number }[] }).create;
    const loop = rules.find((r) => r.kind === 'SURCHARGE_PER_UNIT' && r.condition?.loop === 'yes');
    expect(loop?.amountMinor).toBe(3000);
  });

  it('canvas-print: скидка от 3 шт → QTY_DISCOUNT 0.95 (ТЗ 3.4)', () => {
    const rules = (areaDemoPriceRulesCreate(byCode.get('canvas-print')!) as never as { create: { kind: string; qtyFrom?: number; multiplier?: number }[] }).create;
    const disc = rules.find((r) => r.kind === 'QTY_DISCOUNT');
    expect(disc?.qtyFrom).toBe(3);
    expect(disc?.multiplier).toBe(0.95);
  });

  it('interior-print: ламинация → MULTIPLIER 1.15 (ТЗ 4.4)', () => {
    const rules = (areaDemoPriceRulesCreate(byCode.get('interior-print')!) as never as { create: { kind: string; condition?: Record<string, string>; multiplier?: number }[] }).create;
    expect(rules.find((r) => r.kind === 'MULTIPLIER' && r.condition?.lamination === 'matte-lam')?.multiplier).toBe(1.15);
  });

  it('rollup: TIER (фикс-размеры SEGMENTED width/height/kit), express +40 %', () => {
    const def = rollupDefinitionCreate(1) as never as { pricingMode: string; parameters: { create: { urlKey: string; type: string }[] } };
    expect(def.pricingMode).toBe('TIER');
    const params = def.parameters.create;
    for (const k of ['width', 'height', 'kit']) expect(params.find((p) => p.urlKey === k)?.type).toBe('SEGMENTED');
    const rules = (rollupDemoPriceRulesCreate() as never as { create: { kind: string; condition?: Record<string, string>; multiplier?: number }[] }).create;
    expect(rules.some((r) => r.kind === 'BASE_TIER')).toBe(true);
    expect(rules.find((r) => r.kind === 'MULTIPLIER' && r.condition?.express === '1')?.multiplier).toBe(1.4);
  });
});
