/**
 * Контракт калькуляторов C5 (сувениры/текстиль + фотокниги) против
 * зафиксированного ожидания из ТЗ_калькуляторы.md — не против frontend-конфигов.
 * БД не нужна: проверяется фабрика определений/правил.
 *
 * «Ланьярды/бейджи» умышленно отсутствуют (нет раздела в ТЗ → TZ_ABSENT).
 */
import { SOUVENIR_SPECS } from '../../prisma/demo/souvenir-calculators-demo';
import { tierDefinitionCreate, tierDemoPriceRulesCreate, type TierSpec } from '../../prisma/demo/tier-calculators-demo';

const byCode = new Map(SOUVENIR_SPECS.map((s) => [s.code, s]));

type ParamShape = { urlKey: string; type: string; config?: { multiQty?: Record<string, number> }; visibleIf?: Record<string, unknown>; options?: { create: { value: string; isDefault?: boolean }[] } };
type DefShape = { pricingMode: string; minQty: number; parameters: { create: ParamShape[] }; compatibilityRules?: { create: { kind: string; when: Record<string, unknown>; target: Record<string, unknown> }[] } };
type RuleShape = { create: { kind: string; qtyFrom?: number; qtyTo?: number | null; amountMinor?: number; multiplier?: number; condition?: Record<string, string> }[] };

const def = (s: TierSpec) => tierDefinitionCreate(s, 1) as unknown as DefShape;
const rules = (s: TierSpec) => (tierDemoPriceRulesCreate(s) as unknown as RuleShape).create;
const param = (d: DefShape, key: string) => d.parameters.create.find((p) => p.urlKey === key)!;
const compat = (d: DefShape) => d.compatibilityRules?.create ?? [];

describe('C5 souvenir/photobook contract vs ТЗ_калькуляторы.md', () => {
  it('ровно 4 услуги; коды/slug уникальны; ланьярдов нет (TZ_ABSENT)', () => {
    expect(SOUVENIR_SPECS).toHaveLength(4);
    expect(SOUVENIR_SPECS.map((s) => s.code).sort()).toEqual(['mug-print', 'photobook', 'shopper-print', 'tshirt-print']);
    expect(SOUVENIR_SPECS.some((s) => /lanyard|ланьярд|bejdzi/i.test(s.code) || /lanyard|bejdzi/i.test(s.slug))).toBe(false);
  });

  // 8.1 Футболки: мультиразмер (MULTI_QTY), тираж = сумма строк, тариф по общему
  //     тиражу (BASE_TIER); шелкография от 50, срочность от 5 (MIN_QTY).
  it('tshirt: MULTI_QTY размеры + BASE_TIER по общему тиражу + минимумы (ТЗ 8.1)', () => {
    const spec = byCode.get('tshirt-print')!;
    const d = def(spec);
    expect(d.pricingMode).toBe('TIER');
    const sizes = param(d, 'sizes');
    expect(sizes.type).toBe('MULTI_QTY');
    expect(sizes.config?.multiQty?.totalMin).toBe(1);
    expect(sizes.options!.create.map((o) => o.value)).toEqual(['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']);
    // Цена — общий BASE_TIER (не построчный), покрывает minQty=1.
    const base = rules(spec).filter((r) => r.kind === 'BASE_TIER').sort((a, b) => (a.qtyFrom ?? 0) - (b.qtyFrom ?? 0));
    expect(base[0].qtyFrom).toBe(1);
    expect(rules(spec).some((r) => r.kind === 'BASE_PER_MULTI_QTY_LINE')).toBe(false);
    // inkColors — только для шелкографии.
    expect(param(d, 'inkColors').visibleIf).toEqual({ method: 'screenprint' });
    // MIN_QTY: шелкография → 50, срочность → 5.
    const mins = compat(d).filter((r) => r.kind === 'MIN_QTY');
    expect(mins.find((r) => r.when.method === 'screenprint')?.target.minQty).toBe(50);
    expect(mins.find((r) => r.when.express === '1')?.target.minQty).toBe(5);
  });

  // 8.2 Кружки: SKU-тип + зона + upsells коробка/ложка.
  it('mug: типы-SKU и upsells коробка/ложка (ТЗ 8.2)', () => {
    const spec = byCode.get('mug-print')!;
    const types = param(def(spec), 'type').options!.create.map((o) => o.value);
    expect(types).toEqual(['standard-white', 'color-inside', 'travel-mug', 'magic']);
    expect(spec.upsells?.map((u) => u.code).sort()).toEqual(['gift-box', 'spoon']);
    expect(rules(spec).find((r) => r.kind === 'MULTIPLIER' && r.condition?.type === 'travel-mug')?.multiplier).toBe(1.6);
  });

  // 8.3 Шопперы: мин. 10 шт., фикс-размеры (OPTION), цвета только шелкография.
  it('shopper: минимум 10, размеры-OPTION, цвета для шелкографии (ТЗ 8.3)', () => {
    const spec = byCode.get('shopper-print')!;
    expect(spec.minQty).toBe(10);
    const base = rules(spec).filter((r) => r.kind === 'BASE_TIER').sort((a, b) => (a.qtyFrom ?? 0) - (b.qtyFrom ?? 0));
    expect(base[0].qtyFrom).toBe(10);
    expect(param(def(spec), 'inkColors').visibleIf).toEqual({ method: 'screenprint' });
  });

  // 3.2 Фотокниги: подтип → доступность форматов/страниц (DISABLE_OPTIONS),
  //     скидка от 2/5 шт. (диапазоны), обложка только hardcover, gift-wrap +150.
  it('photobook: доступность, скидки 2/5 шт., обложка hardcover-only (ТЗ 3.2)', () => {
    const spec = byCode.get('photobook')!;
    const d = def(spec);
    const disables = compat(d).filter((r) => r.kind === 'DISABLE_OPTIONS');
    // Softcover: 30×30 и 40×20 недоступны.
    expect(disables.find((r) => r.when.subtype === 'softcover' && r.target.param === 'format')?.target.options)
      .toEqual(['30x30', '40x20']);
    // LayFlat-разворот только для LayFlat (запрещён для hardcover/softcover).
    expect(disables.some((r) => r.target.param === 'pagesType' && (r.target.options as string[] | undefined)?.includes('layflat-pages'))).toBe(true);
    // Обложка видна только для hardcover; кожзам +300 ₽/экз.
    expect(param(d, 'cover').visibleIf).toEqual({ subtype: 'hardcover' });
    expect(rules(spec).find((r) => r.kind === 'SURCHARGE_PER_UNIT' && r.condition?.cover === 'leatherette')?.amountMinor).toBe(30000);
    // Скидка двумя диапазонами: [2..4] −5 %, [5..∞) −10 %.
    const disc = rules(spec).filter((r) => r.kind === 'QTY_DISCOUNT').sort((a, b) => (a.qtyFrom ?? 0) - (b.qtyFrom ?? 0));
    expect(disc.map((r) => [r.qtyFrom, r.qtyTo, r.multiplier])).toEqual([[2, 4, 0.95], [5, null, 0.9]]);
    // Подарочная упаковка +150 ₽.
    expect(spec.upsells?.find((u) => u.code === 'gift-wrap')).toMatchObject({ kind: 'FLAT', amount: 150 });
  });
});
