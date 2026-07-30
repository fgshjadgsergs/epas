/**
 * Определение калькулятора «Визитки» (ТЗ п.1.1) как переиспользуемая фабрика —
 * чтобы одну и ту же структуру использовали и демо-сид (isDemo=true + демо-цены),
 * и боевой провижн (isDemo=false + пустой прайс). Цены базовых тиражей —
 * ДЕМОНСТРАЦИОННЫЕ (прототип frontend), отдаются только демо-сидом.
 */
import type { Prisma } from '@prisma/client';

/** Параметры/опции/совместимость/upsells/производство (без прайса и isDemo/status). */
export function businessCardsDefinitionCreate(
  version: number,
): Omit<Prisma.CalculatorDefinitionCreateInput, 'isDemo' | 'status' | 'priceLists'> {
  return {
    code: 'business-cards',
    title: 'Визитки (демо)',
    version,
    pricingMode: 'TIER',
    urlOrder: ['subtype', 'format', 'w', 'h', 'paper', 'coating', 'lacquer', 'foil', 'sides', 'qty', 'express'],
    minQty: 50,
    maxQty: 10000,
    qtyStep: 50,
    defaultQty: 100,
    parameters: {
      create: [
        {
          urlKey: 'subtype', label: 'Тип', type: 'SEGMENTED', sortOrder: 0,
          options: {
            create: [
              { value: 'standard', label: 'Стандартные', isDefault: true, sortOrder: 0 },
              { value: 'lacquer', label: 'С лакировкой', sortOrder: 1 },
              { value: 'foil', label: 'Тиснение фольгой', sortOrder: 2 },
              { value: 'plastic', label: 'Пластиковые', sortOrder: 3 },
            ],
          },
        },
        {
          urlKey: 'format', label: 'Формат', type: 'SEGMENTED', sortOrder: 1,
          options: {
            create: [
              { value: '90x50', label: '90×50', isDefault: true, sortOrder: 0 },
              { value: '85x55', label: '85×55', sortOrder: 1 },
              { value: '90x90', label: '90×90', sortOrder: 2 },
              { value: '55x55', label: '55×55', sortOrder: 3 },
              { value: 'custom', label: 'Свой размер', sortOrder: 4 },
            ],
          },
        },
        { urlKey: 'w', label: 'Ширина', type: 'DIMENSION', sortOrder: 2, unit: 'мм', minValue: 30, maxValue: 100, stepValue: 1, defaultValue: '90', visibleIf: { format: 'custom' } },
        { urlKey: 'h', label: 'Высота', type: 'DIMENSION', sortOrder: 3, unit: 'мм', minValue: 30, maxValue: 100, stepValue: 1, defaultValue: '50', visibleIf: { format: 'custom' } },
        {
          urlKey: 'paper', label: 'Бумага', type: 'SWATCH', sortOrder: 4,
          options: {
            create: [
              { value: 'coated-300', label: 'Мелованная 300 г', sortOrder: 0 },
              { value: 'coated-350', label: 'Мелованная 350 г', isDefault: true, sortOrder: 1 },
              { value: 'design', label: 'Дизайнерская', sortOrder: 2 },
            ],
          },
        },
        {
          urlKey: 'coating', label: 'Покрытие', type: 'SWATCH', sortOrder: 5,
          options: {
            create: [
              { value: 'none', label: 'Без покрытия', isDefault: true, sortOrder: 0 },
              { value: 'matte-lam', label: 'Матовая ламинация', sortOrder: 1 },
              { value: 'gloss-lam', label: 'Глянцевая ламинация', sortOrder: 2 },
              { value: 'soft-touch', label: 'Soft Touch', sortOrder: 3 },
              { value: 'uv-gloss', label: 'UV-лак глянец', sortOrder: 4 },
              { value: 'uv-matte', label: 'UV-лак мат', sortOrder: 5 },
            ],
          },
        },
        {
          urlKey: 'lacquer', label: 'Вид лака', type: 'SEGMENTED', sortOrder: 6, visibleIf: { subtype: 'lacquer', coating: ['uv-gloss', 'uv-matte'] },
          options: {
            create: [
              { value: 'full', label: 'Сплошной', isDefault: true, sortOrder: 0 },
              { value: 'selective', label: 'Выборочный', sortOrder: 1 },
            ],
          },
        },
        {
          urlKey: 'foil', label: 'Цвет фольги', type: 'SWATCH', sortOrder: 7, visibleIf: { subtype: 'foil' },
          options: {
            create: [
              { value: 'gold', label: 'Золото', isDefault: true, sortOrder: 0 },
              { value: 'silver', label: 'Серебро', sortOrder: 1 },
              { value: 'holographic', label: 'Голография', sortOrder: 2 },
            ],
          },
        },
        {
          urlKey: 'sides', label: 'Стороны', type: 'SEGMENTED', sortOrder: 8,
          options: {
            create: [
              { value: 'single', label: '1 сторона', sortOrder: 0 },
              { value: 'double', label: '2 стороны', isDefault: true, sortOrder: 1 },
            ],
          },
        },
        { urlKey: 'express', label: 'Срочное изготовление', type: 'TOGGLE', sortOrder: 9, isRequired: false, defaultValue: '0' },
      ],
    },
    compatibilityRules: {
      create: [
        { kind: 'DISABLE_OPTIONS', when: { subtype: 'standard' }, target: { param: 'coating', options: ['uv-gloss', 'uv-matte'] }, message: 'UV-лак недоступен для стандартных визиток', sortOrder: 0 },
        { kind: 'DISABLE_OPTIONS', when: { subtype: 'lacquer' }, target: { param: 'coating', options: ['matte-lam', 'gloss-lam'] }, message: 'Ламинация недоступна для визиток с лакировкой', sortOrder: 1 },
        { kind: 'DISABLE_OPTIONS', when: { subtype: 'foil' }, target: { param: 'coating', options: ['gloss-lam', 'soft-touch', 'uv-gloss', 'uv-matte'] }, message: 'Для тиснения доступны только «без покрытия» и матовая ламинация', sortOrder: 2 },
        { kind: 'DISABLE_OPTIONS', when: { subtype: 'plastic' }, target: { param: 'coating', options: ['matte-lam', 'gloss-lam', 'soft-touch', 'uv-gloss', 'uv-matte'] }, message: 'Покрытия недоступны для пластиковых визиток', sortOrder: 3 },
        { kind: 'HIDE_PARAMS', when: { subtype: 'plastic' }, target: { params: ['paper'] }, sortOrder: 4 },
        { kind: 'SET_BOUNDS', when: { subtype: 'plastic' }, target: { param: 'qty', min: 100, step: 100 }, message: 'Минимальный тираж для пластиковых визиток — 100 шт., шаг 100', sortOrder: 5 },
        { kind: 'MAX_QTY', when: { express: '1' }, target: { maxQty: 1000 }, message: 'Срочное изготовление — только для тиража до 1 000 шт.', sortOrder: 6 },
        { kind: 'DISABLE_OPTIONS', when: { subtype: ['lacquer', 'foil', 'plastic'] }, target: { param: 'express', options: ['1'] }, message: 'Срочно — только стандартные визитки с базовой ламинацией', sortOrder: 7 },
        { kind: 'DISABLE_OPTIONS', when: { coating: ['soft-touch', 'uv-gloss', 'uv-matte'] }, target: { param: 'express', options: ['1'] }, message: 'Срочно — только стандартные визитки с базовой ламинацией', sortOrder: 8 },
      ],
    },
    upsells: {
      create: [
        { code: 'rounded-corners', label: 'Скруглённые углы', pricing: 'MULTIPLIER', multiplier: 1.1, sortOrder: 0 },
        { code: 'plastic-case', label: 'Кейс для визиток', pricing: 'FLAT', amountMinor: 15000, sortOrder: 1 },
        { code: 'design', label: 'Разработка дизайна', pricing: 'FLAT', amountMinor: 50000, sortOrder: 2 },
        { code: 'hole', label: 'Отверстие под люверс', pricing: 'MULTIPLIER', multiplier: 1.05, visibleIf: { subtype: 'plastic' }, sortOrder: 3 },
      ],
    },
    productionRules: {
      create: [
        { condition: undefined, workingDays: 2, cutoff: '14:00', priority: 0 },
        { condition: { express: '1' }, workingDays: 0, cutoff: '12:00', priority: 10 },
      ],
    },
  } as unknown as Omit<Prisma.CalculatorDefinitionCreateInput, 'isDemo' | 'status' | 'priceLists'>;
}

/** ДЕМО price rules визиток (базовые тиражи — прототип frontend). */
export function businessCardsDemoPriceRulesCreate(): Prisma.PriceRuleUncheckedCreateNestedManyWithoutPriceListInput {
  return {
    create: [
      { kind: 'BASE_TIER', qtyFrom: 50, qtyTo: 99, amountMinor: 1800, sortOrder: 0 },
      { kind: 'BASE_TIER', qtyFrom: 100, qtyTo: 199, amountMinor: 1200, sortOrder: 1 },
      { kind: 'BASE_TIER', qtyFrom: 200, qtyTo: 299, amountMinor: 900, sortOrder: 2 },
      { kind: 'BASE_TIER', qtyFrom: 300, qtyTo: 499, amountMinor: 750, sortOrder: 3 },
      { kind: 'BASE_TIER', qtyFrom: 500, qtyTo: 999, amountMinor: 600, sortOrder: 4 },
      { kind: 'BASE_TIER', qtyFrom: 1000, qtyTo: 1999, amountMinor: 450, sortOrder: 5 },
      { kind: 'BASE_TIER', qtyFrom: 2000, qtyTo: 4999, amountMinor: 360, sortOrder: 6 },
      { kind: 'BASE_TIER', qtyFrom: 5000, qtyTo: 9999, amountMinor: 300, sortOrder: 7 },
      { kind: 'BASE_TIER', qtyFrom: 10000, qtyTo: null, amountMinor: 260, sortOrder: 8 },
      { kind: 'MULTIPLIER', condition: { subtype: 'lacquer' }, multiplier: 1.25, sortOrder: 10 },
      { kind: 'MULTIPLIER', condition: { subtype: 'foil' }, multiplier: 1.4, sortOrder: 11 },
      { kind: 'MULTIPLIER', condition: { subtype: 'plastic' }, multiplier: 1.8, sortOrder: 12 },
      { kind: 'MULTIPLIER', condition: { format: '90x90' }, multiplier: 1.3, sortOrder: 13 },
      { kind: 'MULTIPLIER', condition: { format: '55x55' }, multiplier: 0.85, sortOrder: 14 },
      { kind: 'MULTIPLIER', condition: { format: 'custom' }, multiplier: 1.2, sortOrder: 15 },
      { kind: 'MULTIPLIER', condition: { paper: 'design' }, multiplier: 1.25, sortOrder: 16 },
      { kind: 'MULTIPLIER', condition: { coating: 'matte-lam' }, multiplier: 1.1, sortOrder: 17 },
      { kind: 'MULTIPLIER', condition: { coating: 'gloss-lam' }, multiplier: 1.1, sortOrder: 18 },
      { kind: 'MULTIPLIER', condition: { coating: 'soft-touch' }, multiplier: 1.2, sortOrder: 19 },
      { kind: 'MULTIPLIER', condition: { coating: 'uv-gloss' }, multiplier: 1.25, sortOrder: 20 },
      { kind: 'MULTIPLIER', condition: { coating: 'uv-matte' }, multiplier: 1.25, sortOrder: 21 },
      { kind: 'MULTIPLIER', condition: { lacquer: 'selective' }, multiplier: 1.5, sortOrder: 22 },
      { kind: 'MULTIPLIER', condition: { foil: 'holographic' }, multiplier: 1.2, sortOrder: 23 },
      { kind: 'MULTIPLIER', condition: { sides: 'double' }, multiplier: 1.35, sortOrder: 24 },
      { kind: 'MULTIPLIER', condition: { express: '1' }, multiplier: 1.5, sortOrder: 25 },
    ],
  } as unknown as Prisma.PriceRuleUncheckedCreateNestedManyWithoutPriceListInput;
}
