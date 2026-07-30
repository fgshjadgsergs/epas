import {
  CalculationOutcome,
  EngineDefinition,
  runCalculation,
} from './pricing-engine';
import { leafletsDefinitionCreate, leafletsDemoPriceRulesCreate } from '../../prisma/demo/leaflets-demo';

/**
 * Расчёты «Листовок» на ТЕХ ЖЕ демо-данных, что сидятся в БД
 * (prisma/demo/leaflets-demo.ts) — конвертация nested-create → EngineDefinition.
 * Цены в ожиданиях — демонстрационные, из прототипа frontend.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
function leafletsEngineDefinition(): EngineDefinition {
  const def = leafletsDefinitionCreate(1) as any;
  const rules = (leafletsDemoPriceRulesCreate() as any).create;
  return {
    code: def.code,
    version: def.version,
    pricingMode: def.pricingMode,
    urlOrder: def.urlOrder,
    minQty: def.minQty,
    maxQty: def.maxQty,
    qtyStep: def.qtyStep,
    defaultQty: def.defaultQty,
    currency: 'RUB',
    priceListVersion: 1,
    parameters: def.parameters.create.map((p: any) => ({
      urlKey: p.urlKey,
      label: p.label,
      type: p.type,
      isRequired: p.isRequired ?? true,
      shareable: true,
      unit: p.unit ?? null,
      minValue: p.minValue ?? null,
      maxValue: p.maxValue ?? null,
      stepValue: p.stepValue ?? null,
      defaultValue: p.defaultValue ?? null,
      visibleIf: p.visibleIf ?? null,
      options: (p.options?.create ?? []).map((o: any) => ({
        value: o.value,
        label: o.label,
        isDefault: o.isDefault ?? false,
        isActive: true,
      })),
    })),
    compatibilityRules: def.compatibilityRules.create.map((r: any, i: number) => ({
      id: `c${i}`,
      kind: r.kind,
      when: r.when,
      target: r.target,
      message: r.message ?? null,
      sortOrder: r.sortOrder,
    })),
    priceRules: rules.map((r: any, i: number) => ({
      id: `p${i}`,
      kind: r.kind,
      condition: r.condition ?? null,
      qtyFrom: r.qtyFrom ?? null,
      qtyTo: r.qtyTo ?? null,
      amountMinor: r.amountMinor ?? null,
      multiplier: r.multiplier ?? null,
      sortOrder: r.sortOrder,
    })),
    productionRules: def.productionRules.create.map((r: any, i: number) => ({
      id: `pr${i}`,
      condition: r.condition ?? null,
      workingDays: r.workingDays,
      cutoff: r.cutoff,
      priority: r.priority,
    })),
    upsells: def.upsells.create.map((u: any) => ({
      code: u.code,
      label: u.label,
      pricing: u.pricing,
      amountMinor: u.amountMinor ?? null,
      multiplier: null,
      isActive: true,
    })),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const NOW = new Date('2026-07-20T06:00:00Z'); // понедельник, 09:00 МСК

function expectOk(outcome: CalculationOutcome) {
  if (!outcome.ok) throw new Error(`Ожидался успех: ${JSON.stringify(outcome.errors)}`);
  return outcome.result;
}

function expectErrors(outcome: CalculationOutcome) {
  if (outcome.ok) throw new Error('Ожидались ошибки, получен успех');
  return outcome.errors;
}

describe('Листовки: расчёт на демо-данных', () => {
  const def = leafletsEngineDefinition();

  it('дефолты: A5, мелованная 150, 4+4, без ламинации, 500 шт → 2 310 ₽', () => {
    const r = expectOk(runCalculation(def, { parameters: {} }, NOW));
    expect(r.normalizedParameters).toMatchObject({
      format: 'A5',
      paper: 'coated-150',
      color: '4+4',
      coating: 'none',
      express: '0',
    });
    expect(r.quantity).toBe(500);
    // 500 × 4.20 ₽ × 1.1 (мелованная 150)
    expect(r.price.amountMinor).toBe(231000);
  });

  it('стандартный формат: w/h скрыты и не попадают в normalized (не влияют на цену)', () => {
    const base = expectOk(runCalculation(def, { parameters: { format: 'A5', qty: 500 } }, NOW));
    expect(base.normalizedParameters.w).toBeUndefined();
    expect(base.normalizedParameters.h).toBeUndefined();
    // Старые значения размера из URL стандартному формату цену не меняют.
    const withStale = expectOk(runCalculation(def, { parameters: { format: 'A5', w: 200, h: 200, qty: 500 } }, NOW));
    expect(withStale.price.amountMinor).toBe(base.price.amountMinor);
    expect(withStale.normalizedParameters.w).toBeUndefined();
  });

  it('свой размер: w/h видимы, применяется множитель custom (×1.3)', () => {
    const r = expectOk(
      runCalculation(def, { parameters: { format: 'custom', w: 148, h: 210, qty: 500 } }, NOW),
    );
    expect(r.normalizedParameters).toMatchObject({ w: 148, h: 210 });
    // 210000 × 1.3 (custom, sortOrder 13) × 1.1 (coated-150, sortOrder 15)
    expect(r.price.amountMinor).toBe(300300);
  });

  it('границы размера: 74 и 297 мм допустимы, 73 и 298 — ошибка 422', () => {
    expect(
      runCalculation(def, { parameters: { format: 'custom', w: 74, h: 297, qty: 500 } }, NOW).ok,
    ).toBe(true);
    const low = expectErrors(runCalculation(def, { parameters: { format: 'custom', w: 73, h: 210, qty: 500 } }, NOW));
    expect(low.some((e) => e.param === 'w' && e.message.includes('74'))).toBe(true);
    const high = expectErrors(runCalculation(def, { parameters: { format: 'custom', w: 148, h: 298, qty: 500 } }, NOW));
    expect(high.some((e) => e.param === 'h' && e.message.includes('297'))).toBe(true);
  });

  it('шаг размера: дробное значение выравнивается с предупреждением', () => {
    const r = expectOk(
      runCalculation(def, { parameters: { format: 'custom', w: 150.4, h: 210, qty: 500 } }, NOW),
    );
    expect(r.normalizedParameters.w).toBe(150);
    expect(r.warnings.some((w) => w.includes('шага 1'))).toBe(true);
  });

  it('неверный формат и неизвестная бумага → 422', () => {
    const badFormat = expectErrors(runCalculation(def, { parameters: { format: 'A3', qty: 500 } }, NOW));
    expect(badFormat.some((e) => e.param === 'format')).toBe(true);
    const badPaper = expectErrors(runCalculation(def, { parameters: { paper: 'kraft-300', qty: 500 } }, NOW));
    expect(badPaper.some((e) => e.param === 'paper')).toBe(true);
  });

  it('несовместимость: офсет 80 г + ламинация → 422 с сообщением из правила', () => {
    const errors = expectErrors(
      runCalculation(def, { parameters: { paper: 'offset-80', coating: 'matte-lam', qty: 500 } }, NOW),
    );
    expect(errors.some((e) => e.param === 'coating' && e.message.includes('офсетной'))).toBe(true);
  });

  it('границы тиража: 99 и 100 001 → 422; 150 выравнивается к шагу 100', () => {
    expect(expectErrors(runCalculation(def, { parameters: { qty: 99 } }, NOW)).some((e) => e.param === 'qty')).toBe(true);
    expect(
      expectErrors(runCalculation(def, { parameters: { qty: 100001 } }, NOW)).some((e) => e.param === 'qty'),
    ).toBe(true);
    const snapped = expectOk(runCalculation(def, { parameters: { qty: 150 } }, NOW));
    expect(snapped.quantity).toBe(200);
    expect(snapped.warnings.some((w) => w.includes('шага 100'))).toBe(true);
  });

  it('срочность: ×1.3, срок 1 день; тираж свыше 2 000 с express → 422', () => {
    const ok = expectOk(runCalculation(def, { parameters: { express: '1', qty: 2000 } }, NOW));
    // 2000 × 2.10 = 420000 × 1.1 = 462000 × 1.3 = 600600
    expect(ok.price.amountMinor).toBe(600600);
    expect(ok.production.workingDays).toBe(1);
    const over = expectErrors(runCalculation(def, { parameters: { express: '1', qty: 2100 } }, NOW));
    expect(over.some((e) => e.message.includes('2 000'))).toBe(true);
  });

  it('пороговые цены: граничные значения диапазонов тиража', () => {
    // Последний штучный тираж диапазона и первый следующего.
    const at499 = expectOk(runCalculation(def, { parameters: { qty: 400, paper: 'coated-115' } }, NOW));
    expect(at499.price.amountMinor).toBe(400 * 900);
    const at500 = expectOk(runCalculation(def, { parameters: { qty: 500, paper: 'coated-115' } }, NOW));
    expect(at500.price.amountMinor).toBe(500 * 420);
    const at100k = expectOk(runCalculation(def, { parameters: { qty: 100000, paper: 'coated-115' } }, NOW));
    expect(at100k.price.amountMinor).toBe(100000 * 70);
  });

  it('upsells: нумерация за штуку и дизайн фиксом; в normalizedUpsells — вход', () => {
    const base = expectOk(runCalculation(def, { parameters: { qty: 500, paper: 'coated-115' } }, NOW));
    const r = expectOk(
      runCalculation(def, { parameters: { qty: 500, paper: 'coated-115' }, upsells: ['numbering', 'design'] }, NOW),
    );
    // Нумерация 5 ₽/шт × 500 + дизайн 1000 ₽.
    expect(r.price.amountMinor).toBe(base.price.amountMinor + 500 * 500 + 100000);
    expect(r.normalizedUpsells).toEqual(['numbering', 'design']);
  });
});
