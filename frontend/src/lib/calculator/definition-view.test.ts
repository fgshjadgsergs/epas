import { describe, expect, it } from 'vitest';
import {
  availableUpsellsFromDefinition,
  buildGroupsFromDefinition,
  defaultsFromDefinition,
  disabledOptionsFromDefinition,
  expressAvailabilityFromDefinition,
  hiddenParamsFromDefinition,
  normalizeSelectionWithDefinition,
  qtyBoundsFromDefinition,
  type DefinitionDto,
} from './definition-view';
import type { CalcConfig } from '@/lib/calc/types';

function makeDefinition(overrides: Partial<DefinitionDto> = {}): DefinitionDto {
  return {
    serviceSlug: 'vizitki',
    code: 'business-cards',
    title: 'Визитки',
    version: 3,
    pricingMode: 'TIER',
    urlOrder: ['subtype', 'paper', 'qty', 'express'],
    qty: { min: 50, max: 10000, step: 50, default: 100 },
    preset: null,
    parameters: [
      {
        urlKey: 'subtype',
        label: 'Тип',
        type: 'SEGMENTED',
        unit: null,
        min: null,
        max: null,
        step: null,
        default: 'standard',
        required: true,
        shareable: true,
        visibleIf: null,
        options: [
          { value: 'standard', label: 'Стандартные', isDefault: true, meta: null },
          { value: 'plastic', label: 'Пластиковые', isDefault: false, meta: null },
        ],
      },
      {
        urlKey: 'paper',
        label: 'Бумага',
        type: 'SWATCH',
        unit: null,
        min: null,
        max: null,
        step: null,
        default: 'coated-350',
        required: true,
        shareable: true,
        visibleIf: null,
        options: [
          { value: 'coated-350', label: 'Мелованная 350 г', isDefault: true, meta: null },
          { value: 'design', label: 'Дизайнерская', isDefault: false, meta: null },
        ],
      },
      {
        urlKey: 'w',
        label: 'Ширина',
        type: 'DIMENSION',
        unit: 'мм',
        min: 30,
        max: 100,
        step: 1,
        default: '90',
        required: true,
        shareable: true,
        visibleIf: { subtype: 'plastic' },
        options: [],
      },
      {
        urlKey: 'express',
        label: 'Срочно',
        type: 'TOGGLE',
        unit: null,
        min: null,
        max: null,
        step: null,
        default: '0',
        required: false,
        shareable: true,
        visibleIf: null,
        options: [],
      },
    ],
    compatibility: [
      {
        kind: 'DISABLE_OPTIONS',
        when: { subtype: 'plastic' },
        target: { param: 'paper', options: ['design'] },
        message: 'Недоступно для пластика',
      },
      { kind: 'HIDE_PARAMS', when: { subtype: 'plastic' }, target: { params: ['paper'] }, message: null },
      { kind: 'SET_BOUNDS', when: { subtype: 'plastic' }, target: { param: 'qty', min: 100, step: 100 }, message: null },
      { kind: 'MAX_QTY', when: { express: '1' }, target: { maxQty: 1000 }, message: 'Срочно — до 1000 шт.' },
      {
        kind: 'DISABLE_OPTIONS',
        when: { subtype: 'plastic' },
        target: { param: 'express', options: ['1'] },
        message: 'Срочно только для стандартных',
      },
    ],
    upsells: [
      { code: 'case', label: 'Кейс', visibleIf: null },
      { code: 'hole', label: 'Люверс', visibleIf: { subtype: 'plastic' } },
    ],
    hasActivePriceList: true,
    calculationVersion: 'business-cards:v3:p1',
    ...overrides,
  };
}

const presentation = {
  serviceId: 'business-cards',
  preview: 'card',
  defaultQty: 999, // локальный дефолт НЕ должен просачиваться
  productionDays: 2,
  groups: [
    {
      id: 'paper',
      label: 'Локальная подпись', // подпись из definition должна победить
      type: 'swatch',
      default: 'design', // локальный дефолт игнорируется
      options: [
        { id: 'coated-350', label: 'Локальный лейбл', swatch: { kind: 'paper', color: '#fff' }, badge: 'хит' },
      ],
    },
  ],
} as unknown as CalcConfig;

describe('buildGroupsFromDefinition', () => {
  it('состав/подписи/дефолты — из definition; из локального конфига только swatch/badge/note', () => {
    const groups = buildGroupsFromDefinition(makeDefinition(), presentation);
    const paper = groups.find((g) => g.id === 'paper')!;
    expect(paper.label).toBe('Бумага'); // не «Локальная подпись»
    expect(paper.default).toBe('coated-350'); // не локальный 'design'
    expect(paper.options?.map((o) => o.label)).toEqual(['Мелованная 350 г', 'Дизайнерская']);
    // Presentation слился по id: свотч и бейдж — из локального конфига.
    expect(paper.options?.[0].swatch).toEqual({ kind: 'paper', color: '#fff' });
    expect(paper.options?.[0].badge).toBe('хит');
    // У опции, отсутствующей в локальном конфиге, presentation просто нет.
    expect(paper.options?.[1].swatch).toBeUndefined();
  });

  it('express исключён из групп (кастомный тумблер), DIMENSION несёт min/max/step/unit', () => {
    const groups = buildGroupsFromDefinition(makeDefinition());
    expect(groups.some((g) => g.id === 'express')).toBe(false);
    const w = groups.find((g) => g.id === 'w')!;
    expect(w).toMatchObject({ type: 'dimension', min: 30, max: 100, step: 1, unit: 'мм', default: 90 });
  });
});

describe('правила из definition', () => {
  it('disabledOptions/hiddenParams реагируют на условия', () => {
    const def = makeDefinition();
    expect(disabledOptionsFromDefinition(def, { subtype: 'standard' })).toEqual({});
    expect(disabledOptionsFromDefinition(def, { subtype: 'plastic' })).toMatchObject({ paper: ['design'] });
    expect(hiddenParamsFromDefinition(def, { subtype: 'standard' }).has('w')).toBe(true); // visibleIf не совпал
    const hiddenPlastic = hiddenParamsFromDefinition(def, { subtype: 'plastic' });
    expect(hiddenPlastic.has('paper')).toBe(true); // HIDE_PARAMS
    expect(hiddenPlastic.has('w')).toBe(false);
  });

  it('qtyBounds объединяет базу и SET_BOUNDS', () => {
    const def = makeDefinition();
    expect(qtyBoundsFromDefinition(def, { subtype: 'standard' })).toEqual({ min: 50, max: 10000, step: 50 });
    expect(qtyBoundsFromDefinition(def, { subtype: 'plastic' })).toEqual({ min: 100, max: 10000, step: 100 });
  });

  it('expressAvailability: DISABLE_OPTIONS и MAX_QTY из definition', () => {
    const def = makeDefinition();
    expect(expressAvailabilityFromDefinition(def, { subtype: 'standard' }, 500).ok).toBe(true);
    expect(expressAvailabilityFromDefinition(def, { subtype: 'plastic' }, 500)).toMatchObject({
      ok: false,
      reason: 'Срочно только для стандартных',
    });
    expect(expressAvailabilityFromDefinition(def, { subtype: 'standard' }, 5000)).toMatchObject({
      ok: false,
      reason: 'Срочно — до 1000 шт.',
    });
  });

  it('normalizeSelection чинит запрещённую комбинацию первым доступным вариантом', () => {
    const def = makeDefinition();
    const fixed = normalizeSelectionWithDefinition(def, { subtype: 'plastic', paper: 'design' });
    expect(fixed.paper).toBe('coated-350');
  });

  it('availableUpsells фильтрует по visibleIf', () => {
    const def = makeDefinition();
    expect(availableUpsellsFromDefinition(def, { subtype: 'standard' }).map((u) => u.code)).toEqual(['case']);
    expect(availableUpsellsFromDefinition(def, { subtype: 'plastic' }).map((u) => u.code)).toEqual(['case', 'hole']);
  });

  it('defaultsFromDefinition отдаёт дефолты definition (DIMENSION — числом)', () => {
    expect(defaultsFromDefinition(makeDefinition())).toEqual({ subtype: 'standard', paper: 'coated-350', w: 90 });
  });
});
