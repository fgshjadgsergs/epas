/**
 * Контракт калькуляторов C4 (документы, постпечать, печати/штампы, фото на
 * документы) против зафиксированного ожидания из ТЗ_калькуляторы.md — не против
 * frontend-конфигов. БД не нужна: проверяем фабрику определений/правил.
 *
 * «Пломбираторы» умышленно отсутствуют (нет раздела в ТЗ → TZ_ABSENT).
 */
import { DOCUMENT_SPECS } from '../../prisma/demo/document-calculators-demo';
import { tierDefinitionCreate, tierDemoPriceRulesCreate, type TierSpec } from '../../prisma/demo/tier-calculators-demo';

const byCode = new Map(DOCUMENT_SPECS.map((s) => [s.code, s]));

type DefShape = {
  pricingMode: string;
  minQty: number;
  maxQty: number;
  config?: { quantityFrom?: { product: string[] } };
  parameters: { create: { urlKey: string; type: string; minValue?: number | null; maxValue?: number | null; options?: { create: { value: string; isDefault?: boolean }[] } }[] };
  compatibilityRules?: { create: { kind: string; when: Record<string, unknown>; target: Record<string, unknown> }[] };
};
type RuleShape = { create: { kind: string; qtyFrom?: number; qtyTo?: number | null; amountMinor?: number; multiplier?: number; condition?: Record<string, string> }[] };

const def = (s: TierSpec) => tierDefinitionCreate(s, 1) as unknown as DefShape;
const rules = (s: TierSpec) => (tierDemoPriceRulesCreate(s) as unknown as RuleShape).create;
const paramKeys = (d: DefShape) => d.parameters.create.map((p) => p.urlKey);
const findParam = (d: DefShape, key: string) => d.parameters.create.find((p) => p.urlKey === key);

const EXPECTED: Record<string, { tz: string; slug: string; category: string }> = {
  'document-print': { tz: '2.1', slug: 'pechat-a4-a3', category: 'pechat-dokumentov' },
  'document-copy': { tz: '2.2', slug: 'kopirovanie-a4-a3', category: 'pechat-dokumentov' },
  lamination: { tz: '2.5', slug: 'laminirovanie', category: 'pechat-dokumentov' },
  'binding-staple': { tz: '2.3', slug: 'broshyurovka', category: 'pechat-dokumentov' },
  'hard-cover-binding': { tz: '2.4', slug: 'tvyordyj-pereplet', category: 'pechat-dokumentov' },
  'stamp-auto': { tz: '7.1', slug: 'shtampy-avtomaticheskie', category: 'pechati-shtampy' },
  'stamp-pocket': { tz: '7.2', slug: 'pechati-karmannye', category: 'pechati-shtampy' },
  facsimile: { tz: '7.2', slug: 'faksimile', category: 'pechati-shtampy' },
  'id-photo': { tz: '3.3', slug: 'foto-na-dokumenty', category: 'foto-na-dokumenty' },
};

describe('C4 document/stamp/id-photo contract vs ТЗ_калькуляторы.md', () => {
  it('ровно 9 услуг; коды/slug уникальны; пломбираторов нет (TZ_ABSENT)', () => {
    expect(DOCUMENT_SPECS).toHaveLength(9);
    expect(new Set(DOCUMENT_SPECS.map((s) => s.code)).size).toBe(9);
    expect(new Set(DOCUMENT_SPECS.map((s) => s.slug)).size).toBe(9);
    expect(DOCUMENT_SPECS.map((s) => s.code).sort()).toEqual(Object.keys(EXPECTED).sort());
    expect(DOCUMENT_SPECS.some((s) => /plombir|плом/i.test(s.code) || /plombir/i.test(s.slug))).toBe(false);
  });

  describe.each(Object.entries(EXPECTED))('%s', (code, exp) => {
    const spec = byCode.get(code)!;
    it('раздел ТЗ, slug, категория, режим TIER, BASE_TIER покрывает minQty', () => {
      expect(spec.tz).toBe(exp.tz);
      expect(spec.slug).toBe(exp.slug);
      expect(spec.category).toBe(exp.category);
      const d = def(spec);
      expect(d.pricingMode).toBe('TIER');
      const baseTiers = rules(spec).filter((r) => r.kind === 'BASE_TIER').sort((a, b) => (a.qtyFrom ?? 0) - (b.qtyFrom ?? 0));
      expect(baseTiers.length).toBeGreaterThan(0);
      expect(baseTiers[0].qtyFrom).toBeLessThanOrEqual(spec.minQty);
      expect(baseTiers[baseTiers.length - 1].qtyTo).toBeNull();
    });
  });

  // 2.1 Печать документов: формат A4/A3, цветность, стороны, бумага, срочность,
  //     4 порога цены за лист (1–9 / 10–49 / 50–199 / 200+).
  it('document-print: параметры и пороги ТЗ 2.1', () => {
    const spec = byCode.get('document-print')!;
    const d = def(spec);
    expect(paramKeys(d)).toEqual(expect.arrayContaining(['format', 'color', 'sides', 'paper', 'urgency']));
    const fmt = findParam(d, 'format')!.options!.create.map((o) => o.value);
    expect(fmt).toEqual(['A4', 'A3']);
    const urg = findParam(d, 'urgency')!.options!.create.map((o) => o.value);
    expect(urg).toEqual(['standard', 'express-4h', 'express-1h']);
    const tiers = rules(spec).filter((r) => r.kind === 'BASE_TIER').map((r) => r.qtyFrom);
    expect(tiers).toEqual([1, 10, 50, 200]);
    expect(rules(spec).find((r) => r.kind === 'MULTIPLIER' && r.condition?.urgency === 'express-1h')?.multiplier).toBe(1.6);
  });

  // 2.2 Копирование: qty = оригиналы × копии (config.quantityFrom); оба —
  //     DIMENSION с границами; пользователь тираж не вводит.
  it('document-copy: производный тираж оригиналы × копии (ТЗ 2.2)', () => {
    const spec = byCode.get('document-copy')!;
    const d = def(spec);
    expect(d.config?.quantityFrom?.product).toEqual(['originals', 'copies']);
    expect(findParam(d, 'originals')!.type).toBe('DIMENSION');
    expect(findParam(d, 'copies')!.type).toBe('DIMENSION');
    // Тираж не вводится вручную — параметра qty среди urlOrder нет.
    expect(spec.urlOrder).not.toContain('qty');
  });

  // 2.3 Брошюровка: тип переплёта ограничивает страницы (backend 422 через
  //     DISABLE_OPTIONS): staple 4–48 / spiral 8–400 / thermo 40–800.
  it('binding: совместимость тип × страницы (ТЗ 2.3)', () => {
    const spec = byCode.get('binding-staple')!;
    const d = def(spec);
    const disables = (d.compatibilityRules?.create ?? []).filter((r) => r.kind === 'DISABLE_OPTIONS');
    expect(disables.length).toBeGreaterThanOrEqual(3);
    const staple = disables.find((r) => r.when.type === 'staple');
    expect(staple?.target.options).toEqual(expect.arrayContaining(['p-150', 'p-400', 'p-800']));
    const thermo = disables.find((r) => r.when.type === 'thermo');
    expect(thermo?.target.options).toEqual(['p-48']);
  });

  // 2.4 Твёрдый переплёт: один Definition, тип-пресет; печать блока раскрывает
  //     цветность/бумагу (visibleIf); обложка +200/+300 ₽ (SURCHARGE_PER_UNIT).
  it('hardcover: тип-пресет, зависимые поля блока, надбавки обложки (ТЗ 2.4)', () => {
    const spec = byCode.get('hard-cover-binding')!;
    const d = def(spec);
    const types = findParam(d, 'type')!.options!.create.map((o) => o.value);
    expect(types).toEqual(['diploma', 'thesis', 'report', 'book']);
    const blockColor = d.parameters.create.find((p) => p.urlKey === 'blockColor') as unknown as { visibleIf?: Record<string, string> };
    expect(blockColor.visibleIf).toEqual({ printBlock: 'yes' });
    const surcharges = rules(spec).filter((r) => r.kind === 'SURCHARGE_PER_UNIT');
    expect(surcharges.find((r) => r.condition?.cover === 'printed')?.amountMinor).toBe(20000);
    expect(surcharges.find((r) => r.condition?.cover === 'leatherette')?.amountMinor).toBe(30000);
  });

  // 7.1 Автоматические штампы: модели-оснастки (SKU) + подушка +150 ₽/шт.
  it('stamp-auto: модели-оснастки и запасная подушка (ТЗ 7.1)', () => {
    const spec = byCode.get('stamp-auto')!;
    const d = def(spec);
    const models = findParam(d, 'model')!.options!.create.map((o) => o.value);
    expect(models).toEqual(expect.arrayContaining(['trodat-4912', 'colop-e40']));
    expect(spec.upsells?.find((u) => u.code === 'spare-pad')).toMatchObject({ kind: 'PER_UNIT', amount: 150 });
  });

  // 7.2 Факсимиле: произвольный размер в границах 20×10–80×40 мм (DIMENSION).
  it('facsimile: границы размера 20×10–80×40 мм (ТЗ 7.2)', () => {
    const spec = byCode.get('facsimile')!;
    const d = def(spec);
    const w = findParam(d, 'width')!;
    const h = findParam(d, 'height')!;
    expect([w.minValue, w.maxValue]).toEqual([20, 80]);
    expect([h.minValue, h.maxValue]).toEqual([10, 40]);
  });

  // 3.3 Фото на документы: тип документа (OPTION), скидка от 5 шт. −10 %
  //     (QTY_DISCOUNT), доставка «оба» +100 ₽, базовая цена комплекта.
  it('id-photo: типы документов, скидка от 5 шт., доставка (ТЗ 3.3)', () => {
    const spec = byCode.get('id-photo')!;
    const d = def(spec);
    const docs = findParam(d, 'document')!.options!.create;
    expect(docs.length).toBeGreaterThanOrEqual(30);
    expect(docs.find((o) => o.isDefault)?.value).toBe('passport-rf');
    const r = rules(spec);
    const disc = r.find((x) => x.kind === 'QTY_DISCOUNT');
    expect(disc?.qtyFrom).toBe(5);
    expect(disc?.multiplier).toBe(0.9);
    // Виза США 600 ₽ / база 300 ₽ = ×2.0.
    expect(r.find((x) => x.kind === 'MULTIPLIER' && x.condition?.document === 'visa-usa')?.multiplier).toBe(2);
    expect(r.find((x) => x.kind === 'SURCHARGE_PER_UNIT' && x.condition?.delivery === 'both')?.amountMinor).toBe(10000);
    expect(r.find((x) => x.kind === 'BASE_TIER')?.amountMinor).toBe(30000);
  });
});
