import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pickPricingEditor } from './pricing-editor-kind';
import { humanizeCondition, isRowChanged, rubToMinor, minorToRubInput, applyRuleChanges, ruleToEditable } from './pricing-rule-edit';
import { ApiError } from '@/lib/api/client';
import type { PriceRuleView, PricingDefinitionDetail } from '@/lib/api/admin-pricing';

const api = vi.hoisted(() => ({ createDraftRule: vi.fn(), updateDraftRule: vi.fn(), deleteDraftRule: vi.fn() }));
vi.mock('@/lib/api/admin-pricing', () => api);

const definition = {
  parameters: [
    { urlKey: 'paper', label: 'Бумага', type: 'SWATCH', unit: null, isRequired: false, options: [{ value: 'design', label: 'Дизайнерская', isActive: true }] },
    { urlKey: 'sides', label: 'Стороны', type: 'SEGMENTED', unit: null, isRequired: false, options: [{ value: 'double', label: 'Двусторонняя', isActive: true }] },
  ],
} as unknown as PricingDefinitionDetail;

describe('pickPricingEditor', () => {
  it('маппит эталонные калькуляторы, иначе technical', () => {
    expect(pickPricingEditor('business-cards')).toBe('tier');
    expect(pickPricingEditor('leaflets')).toBe('tier');
    expect(pickPricingEditor('banner-print')).toBe('metric');
    expect(pickPricingEditor('photo-print')).toBe('multiqty');
    expect(pickPricingEditor('something-else')).toBe('technical');
    expect(pickPricingEditor(null)).toBe('technical');
  });
});

describe('money helpers — без float-порчи', () => {
  it('рубли → целые копейки', () => {
    expect(rubToMinor('12.5')).toBe(1250);
    expect(rubToMinor('12,10')).toBe(1210);
    expect(rubToMinor('0.01')).toBe(1);
    expect(rubToMinor('1250')).toBe(125000);
    expect(rubToMinor('abc')).toBeNull();
  });
  it('12.1 * 100 не даёт 1209.9999', () => {
    expect(rubToMinor('12.1')).toBe(1210);
    expect(Number.isInteger(rubToMinor('999.99'))).toBe(true);
  });
  it('копейки → строка рублей для ввода', () => {
    expect(minorToRubInput(1250)).toBe('12.5');
    expect(minorToRubInput(null)).toBe('');
  });
});

describe('humanizeCondition', () => {
  it('переводит condition в человекочитаемую строку по metadata', () => {
    expect(humanizeCondition({ paper: 'design' }, definition)).toBe('Бумага: Дизайнерская');
    expect(humanizeCondition({ sides: 'double' }, definition)).toBe('Стороны: Двусторонняя');
    expect(humanizeCondition(null, definition)).toBe('Всегда');
  });
  it('неизвестный ключ показывается как есть (fallback)', () => {
    expect(humanizeCondition({ zzz: 'x' }, definition)).toBe('zzz: x');
  });
});

describe('isRowChanged', () => {
  const orig: PriceRuleView = { id: 'r1', kind: 'BASE_TIER', condition: null, qtyFrom: 100, qtyTo: 499, amountMinor: 90000, multiplier: null, config: null, priority: 0 };
  it('новая строка (без original) — изменена', () => {
    expect(isRowChanged({ ...ruleToEditable(orig), id: undefined }, undefined)).toBe(true);
  });
  it('одинаковая строка — не изменена', () => {
    expect(isRowChanged(ruleToEditable(orig), orig)).toBe(false);
  });
  it('другая цена — изменена', () => {
    expect(isRowChanged({ ...ruleToEditable(orig), amountMinor: 95000 }, orig)).toBe(true);
  });
});

describe('applyRuleChanges — последовательное сохранение с revision', () => {
  const original = { id: 'r-upd', kind: 'BASE_TIER', condition: null, qtyFrom: 1, qtyTo: 9, amountMinor: 100, multiplier: null, config: null, priority: 0 } as PriceRuleView;
  const originalById = new Map([['r-del', { ...original, id: 'r-del' }], ['r-upd', original]]);

  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
  });

  it('delete → update → create, revision тянется между вызовами', async () => {
    api.deleteDraftRule.mockResolvedValue({ revision: 6, result: { deleted: true } });
    api.updateDraftRule.mockResolvedValue({ revision: 7, result: {} });
    api.createDraftRule.mockResolvedValue({ revision: 8, result: {} });

    const rows = [
      { ...ruleToEditable({ ...original, id: 'r-del' }), deleted: true },
      { ...ruleToEditable(original), amountMinor: 200 }, // изменена
      { ...ruleToEditable(original), id: undefined, amountMinor: 300 }, // новая
    ];
    const out = await applyRuleChanges('pl-1', 5, rows, originalById, 'jwt');
    expect(out.applied).toBe(3);
    expect(out.revision).toBe(8);
    expect(api.deleteDraftRule).toHaveBeenCalledWith('pl-1', 'r-del', 5, 'jwt');
    expect(api.updateDraftRule.mock.calls[0][2].expectedRevision).toBe(6); // после delete
    expect(api.createDraftRule.mock.calls[0][1].expectedRevision).toBe(7); // после update
  });

  it('останавливается на первом конфликте, возвращает partial + error', async () => {
    api.deleteDraftRule.mockResolvedValue({ revision: 6, result: {} });
    api.updateDraftRule.mockRejectedValue(new ApiError(409, 'x', { code: 'PRICING_DRAFT_CONFLICT' } as never));

    const rows = [
      { ...ruleToEditable({ ...original, id: 'r-del' }), deleted: true },
      { ...ruleToEditable(original), amountMinor: 200 },
      { ...ruleToEditable(original), id: undefined },
    ];
    const out = await applyRuleChanges('pl-1', 5, rows, originalById, 'jwt');
    expect(out.applied).toBe(1); // только delete применён
    expect(out.error?.kind).toBe('draftConflict');
    expect(api.createDraftRule).not.toHaveBeenCalled(); // цепочка остановлена
  });
});
