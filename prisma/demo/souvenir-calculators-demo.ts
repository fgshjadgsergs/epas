/**
 * Демо-данные калькуляторов партии C5 — сувениры/текстиль (футболки, кружки,
 * шопперы) и фотокниги. Data-driven поверх общей TIER-фабрики
 * (tier-calculators-demo.ts).
 *
 * СТРУКТУРА — строго по `ТЗ_калькуляторы.md` (разделы в каждом spec). Явные
 * ₽-надбавки/%-коэффициенты ТЗ (срочность +30/+40/+50 %, обложка кожзам +300 ₽,
 * подарочная упаковка +150 ₽, скидка от 2/5 шт. и т. п.) перенесены как
 * бизнес-данные. Базовые тиражи (BASE_TIER) и неоговорённые коэффициенты —
 * ДЕМОНСТРАЦИОННЫЕ (числа прототипа frontend): прайс только isDemo.
 *
 * НЕ вошли: «ланьярды/бейджи» (/suveniry/lanyardy-bejdzi/) — раздела в
 * ТЗ_калькуляторы.md нет (Группа 8 = 8.1 футболки, 8.2 кружки, 8.3 шопперы;
 * «бейджи» из п.1.6 — это полиграфия badges-blanks, уже отдельная услуга) →
 * TZ_ABSENT, не выдумываем.
 */
import type { TierSpec } from './tier-calculators-demo';

export const CAT_SOUVENIRS = 'suveniry';
export const CAT_PHOTOBOOKS = 'fotoknigi';

export const SOUVENIR_SPECS: TierSpec[] = [
  // 8.1 Футболки. Мультиразмер (таблица размер→кол-во) = MULTI_QTY; тираж =
  //     сумма строк; тариф за штуку — по общему тиражу (BASE_TIER). Шелкография
  //     от 50 шт., срочность от 5 шт. — MIN_QTY на бэкенде.
  {
    code: 'tshirt-print', title: 'Печать на футболках (демо)', slug: 'futbolki', category: CAT_SOUVENIRS, tz: '8.1',
    minQty: 1, maxQty: 10000, qtyStep: 1, defaultQty: 1, productionDays: 4,
    express: { coeff: 1.3, days: 2 },
    urlOrder: ['color', 'sizes', 'method', 'inkColors', 'zone', 'printSize', 'qty', 'express'],
    params: [
      { key: 'color', label: 'Цвет футболки', type: 'SWATCH', opts: [
        { v: 'white', l: 'Белая', def: true }, { v: 'black', l: 'Чёрная' }, { v: 'grey', l: 'Серая' },
        { v: 'navy', l: 'Синяя' }, { v: 'red', l: 'Красная' }, { v: 'yellow', l: 'Жёлтая' }, { v: 'green', l: 'Зелёная' } ] },
      { key: 'sizes', label: 'Размеры и количество', type: 'MULTI_QTY', default: 'M:1',
        multiQty: { lineMin: 0, lineMax: 1000, lineStep: 1, totalMin: 1, totalMax: 10000 },
        opts: [
          { v: 'XS', l: 'XS' }, { v: 'S', l: 'S' }, { v: 'M', l: 'M', def: true }, { v: 'L', l: 'L' },
          { v: 'XL', l: 'XL' }, { v: '2XL', l: '2XL' }, { v: '3XL', l: '3XL' } ] },
      { key: 'method', label: 'Метод нанесения', type: 'SEGMENTED', opts: [
        { v: 'dtg', l: 'DTG (цифровая)', def: true }, { v: 'screenprint', l: 'Шелкография', coeff: 0.9 },
        { v: 'transfer', l: 'Термотрансфер', coeff: 0.95 } ] },
      { key: 'inkColors', label: 'Кол-во цветов', type: 'SEGMENTED', visibleIf: { method: 'screenprint' }, opts: [
        { v: '1', l: '1', def: true }, { v: '2', l: '2', coeff: 1.15 }, { v: '4', l: '4', coeff: 1.4 },
        { v: '6', l: '6', coeff: 1.65 }, { v: '8', l: '8', coeff: 1.9 } ] },
      { key: 'zone', label: 'Зона нанесения', type: 'SEGMENTED', opts: [
        { v: 'front', l: 'Перёд', def: true }, { v: 'back', l: 'Спина' },
        { v: 'front+back', l: 'Перёд + спина', coeff: 1.6 }, { v: 'sleeve', l: 'Рукав', coeff: 0.8 } ] },
      { key: 'printSize', label: 'Размер нанесения', type: 'SEGMENTED', opts: [
        { v: 'small', l: 'До 10×10 см', coeff: 0.85 }, { v: 'medium', l: 'До 20×20 см', def: true },
        { v: 'large', l: 'До 30×40 см', coeff: 1.25 }, { v: 'fullprint', l: 'Fullprint', coeff: 1.7 } ] },
    ],
    tiers: [[1, 900], [5, 750], [10, 650], [50, 500], [100, 420]],
    minQtyRules: [{ when: { method: 'screenprint' }, minQty: 50 }, { when: { express: '1' }, minQty: 5 }],
    demoComment: 'ДЕМО-прайс футболок (базовые тиражи — прототип frontend). Мультиразмер/методы/минимумы — ТЗ п.8.1.',
  },
  // 8.2 Кружки. SKU (тип) + зона печати; qty-тираж; upsells коробка/ложка.
  {
    code: 'mug-print', title: 'Печать на кружках (демо)', slug: 'kruzhki', category: CAT_SOUVENIRS, tz: '8.2',
    minQty: 1, maxQty: 10000, qtyStep: 1, defaultQty: 1, productionDays: 2,
    express: { coeff: 1.4, days: 1 },
    urlOrder: ['type', 'zone', 'qty', 'express'],
    params: [
      { key: 'type', label: 'Тип кружки', type: 'SWATCH', opts: [
        { v: 'standard-white', l: 'Белая 330 мл', def: true }, { v: 'color-inside', l: 'Цвет внутри 330 мл', coeff: 1.2 },
        { v: 'travel-mug', l: 'Термокружка 450 мл', coeff: 1.6 }, { v: 'magic', l: 'Хамелеон 330 мл', coeff: 1.5 } ] },
      { key: 'zone', label: 'Зона печати', type: 'SEGMENTED', opts: [
        { v: 'full', l: 'По кругу', def: true }, { v: 'half', l: 'С одной стороны', coeff: 0.8 } ] },
    ],
    tiers: [[1, 450], [5, 380], [10, 320], [50, 260]],
    upsells: [{ code: 'gift-box', label: 'Подарочная коробка', kind: 'FLAT', amount: 120 },
      { code: 'spoon', label: 'Ложка', kind: 'FLAT', amount: 80 }],
    demoComment: 'ДЕМО-прайс кружек (базовые тиражи — прототип frontend). Типы/зона/upsells — ТЗ п.8.2.',
  },
  // 8.3 Шопперы. Материал + фикс-размер (OPTION) + метод + цвета (шелкография
  //     1–4) + зона; минимальный тираж 10 шт.
  {
    code: 'shopper-print', title: 'Шопперы с логотипом (демо)', slug: 'shoppery', category: CAT_SOUVENIRS, tz: '8.3',
    minQty: 10, maxQty: 100000, qtyStep: 1, defaultQty: 10, productionDays: 4,
    urlOrder: ['type', 'size', 'method', 'inkColors', 'zone', 'qty'],
    params: [
      { key: 'type', label: 'Тип', type: 'SWATCH', opts: [
        { v: 'cotton-natural', l: 'Хлопок суровый', def: true }, { v: 'cotton-white', l: 'Хлопок белый' },
        { v: 'non-woven', l: 'Спанбонд', coeff: 0.8 } ] },
      { key: 'size', label: 'Размер', type: 'SEGMENTED', opts: [
        { v: 'small', l: 'Малый 30×35×6', coeff: 0.85 }, { v: 'standard', l: 'Стандарт 38×42×8', def: true },
        { v: 'large', l: 'Большой 42×38×8', coeff: 1.2 } ] },
      { key: 'method', label: 'Метод нанесения', type: 'SEGMENTED', opts: [
        { v: 'screenprint', l: 'Шелкография', def: true }, { v: 'transfer', l: 'Термотрансфер', coeff: 1.05 },
        { v: 'dtg', l: 'DTG', coeff: 1.15 } ] },
      { key: 'inkColors', label: 'Кол-во цветов', type: 'SEGMENTED', visibleIf: { method: 'screenprint' }, opts: [
        { v: '1', l: '1', def: true }, { v: '2', l: '2', coeff: 1.15 }, { v: '3', l: '3', coeff: 1.3 }, { v: '4', l: '4', coeff: 1.45 } ] },
      { key: 'zone', label: 'Зона нанесения', type: 'SEGMENTED', opts: [
        { v: 'front', l: 'Одна сторона', def: true }, { v: 'front+back', l: 'Две стороны', coeff: 1.5 } ] },
    ],
    tiers: [[10, 350], [50, 280], [100, 230], [500, 180]],
    demoComment: 'ДЕМО-прайс шопперов (базовые тиражи — прототип frontend). Материалы/размеры/методы/мин.10 — ТЗ п.8.3.',
  },
  // 3.2 Фотокниги. Калькулятор ЦЕНЫ (не конструктор разворотов). Подтип →
  //     доступность форматов/типов страниц/лимитов страниц (DISABLE_OPTIONS →
  //     422). Скидка от 2/5 шт., срочность +50 % (≤20 стр., ≤2 экз.).
  {
    code: 'photobook', title: 'Фотокниги (демо)', slug: 'fotoknigi', category: CAT_PHOTOBOOKS, tz: '3.2',
    minQty: 1, maxQty: 1000, qtyStep: 1, defaultQty: 1, productionDays: 5,
    express: { coeff: 1.5, days: 2, maxQty: 2 },
    urlOrder: ['subtype', 'format', 'cover', 'pagesType', 'pages', 'qty', 'express'],
    params: [
      { key: 'subtype', label: 'Переплёт', type: 'SEGMENTED', opts: [
        { v: 'layflat', l: 'LayFlat', coeff: 1.3 }, { v: 'hardcover', l: 'Hardcover', def: true },
        { v: 'softcover', l: 'Softcover', coeff: 0.8 } ] },
      { key: 'format', label: 'Формат, см', type: 'SEGMENTED', opts: [
        { v: '20x15', l: '20×15', coeff: 0.8 }, { v: '20x20', l: '20×20', def: true }, { v: '25x20', l: '25×20', coeff: 1.15 },
        { v: '30x20', l: '30×20', coeff: 1.3 }, { v: '30x30', l: '30×30', coeff: 1.8 }, { v: '40x20', l: '40×20 (панорама)', coeff: 1.6 } ] },
      { key: 'cover', label: 'Обложка', type: 'SWATCH', visibleIf: { subtype: 'hardcover' }, opts: [
        { v: 'fabric', l: 'Ткань', coeff: 1.1 }, { v: 'photo-cover', l: 'Фотообложка', def: true },
        { v: 'leatherette', l: 'Кожзам', perUnit: 300 } ] },
      { key: 'pagesType', label: 'Тип страниц', type: 'SWATCH', opts: [
        { v: 'coated-170', l: 'Мелованная 170 г', def: true }, { v: 'design-200', l: 'Дизайнерская 200 г', coeff: 1.2 },
        { v: 'layflat-pages', l: 'LayFlat-разворот', coeff: 1.3 } ] },
      { key: 'pages', label: 'Кол-во страниц', type: 'SEGMENTED', opts: [
        { v: '20', l: '20', coeff: 0.7 }, { v: '24', l: '24', coeff: 0.78 }, { v: '32', l: '32', coeff: 0.9 },
        { v: '40', l: '40', def: true }, { v: '60', l: '60', coeff: 1.35 }, { v: '80', l: '80', coeff: 1.7 },
        { v: '100', l: '100', coeff: 2 }, { v: '120', l: '120', coeff: 2.3 }, { v: '160', l: '160', coeff: 2.9 },
        { v: '200', l: '200', coeff: 3.5 } ] },
    ],
    tiers: [[1, 2400]],
    qtyDiscount: [{ from: 2, coeff: 0.95 }, { from: 5, coeff: 0.9 }],
    upsells: [{ code: 'gift-wrap', label: 'Подарочная упаковка', kind: 'FLAT', amount: 150 }],
    disableRules: [
      // Доступность форматов по подтипу (таблица ТЗ 3.2).
      { when: { subtype: 'layflat' }, param: 'format', options: ['20x15'], message: 'LayFlat недоступен в формате 20×15 (ТЗ 3.2)' },
      { when: { subtype: 'hardcover' }, param: 'format', options: ['40x20'], message: 'Панорама 40×20 доступна только для LayFlat (ТЗ 3.2)' },
      { when: { subtype: 'softcover' }, param: 'format', options: ['30x30', '40x20'], message: 'Softcover: 30×30 и 40×20 недоступны (ТЗ 3.2)' },
      // Тип страниц LayFlat-разворот — только для LayFlat.
      { when: { subtype: ['hardcover', 'softcover'] }, param: 'pagesType', options: ['layflat-pages'], message: 'LayFlat-разворот доступен только для LayFlat (ТЗ 3.2)' },
      // Лимит страниц по подтипу: softcover ≤ 100, layflat ≤ 120.
      { when: { subtype: 'layflat' }, param: 'pages', options: ['160', '200'], message: 'LayFlat — до 120 страниц (ТЗ 3.2)' },
      { when: { subtype: 'softcover' }, param: 'pages', options: ['120', '160', '200'], message: 'Softcover — до 100 страниц (ТЗ 3.2)' },
      // Срочность — только для книг до 20 страниц (ТЗ 3.2).
      { when: { pages: ['24', '32', '40', '60', '80', '100', '120', '160', '200'] }, param: 'express', options: ['1'], message: 'Срочно — только книги до 20 страниц (ТЗ 3.2)' },
    ],
    demoComment: 'ДЕМО-прайс фотокниг (базовая цена — прототип frontend). Подтипы/форматы/страницы/скидки — ТЗ п.3.2.',
  },
];
