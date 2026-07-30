import type { CalcConfig } from '../types';

/**
 * Конфиги остальных услуг на том же движке. Параметры — по «ТЗ на калькуляторы»,
 * коэффициенты демонстрационные. Превью: sheet/card/banner/generic.
 */

const PAPER = {
  light: '#f6f5f0',
  cream: '#f2efe7',
  warm: '#ece6da',
  bright: '#fafafa',
};

/* ---------- Документы ---------- */
export const documentPrint: CalcConfig = {
  serviceId: 'document-print',
  preview: 'sheet',
  defaultQty: 50,
  productionDays: 1,
  qtyLabel: 'Листов',
  groups: [
    {
      id: 'format',
      label: 'Формат',
      type: 'segmented',
      default: 'A4',
      options: [
        { id: 'A4', label: 'A4' },
        { id: 'A3', label: 'A3', coeff: 1.8 },
      ],
    },
    {
      id: 'color',
      label: 'Цветность',
      type: 'segmented',
      default: 'color',
      options: [
        { id: 'bw', label: 'Чёрно-белая', coeff: 0.45 },
        { id: 'color', label: 'Цветная' },
      ],
    },
    {
      id: 'sides',
      label: 'Стороны',
      type: 'segmented',
      default: 'single',
      options: [
        { id: 'single', label: '1 сторона' },
        { id: 'double', label: '2 стороны', coeff: 1.6 },
      ],
    },
    {
      id: 'paper',
      label: 'Бумага',
      type: 'swatch',
      default: 'office-80',
      options: [
        { id: 'office-80', label: 'Офисная 80 г', swatch: { kind: 'paper', color: PAPER.bright } },
        {
          id: 'office-100',
          label: 'Плотная 100 г',
          coeff: 1.15,
          swatch: { kind: 'paper', color: PAPER.light },
        },
        {
          id: 'photo-190',
          label: 'Фотобумага 190 г',
          coeff: 1.7,
          swatch: { kind: 'paper', color: PAPER.cream },
        },
      ],
    },
    // Срочность тремя ступенями: standard / 4 ч (+30%) / 1 ч (+60%) — ТЗ п.2.1.
    {
      id: 'urgency',
      label: 'Срочность',
      type: 'segmented',
      default: 'standard',
      options: [
        { id: 'standard', label: 'Стандарт (1 день)' },
        { id: 'express-4h', label: 'За 4 часа', coeff: 1.3, daysOverride: 0 },
        { id: 'express-1h', label: 'За 1 час', coeff: 1.6, daysOverride: 0 },
      ],
    },
  ],
  // Кол-во листов 1–5 000, цена за лист пороговая (ТЗ п.2.1).
  qtyTiers: [
    { qty: 1, perUnit: 12 },
    { qty: 10, perUnit: 8 },
    { qty: 50, perUnit: 5 },
    { qty: 200, perUnit: 3.2 },
    { qty: 1000, perUnit: 2.4 },
    { qty: 5000, perUnit: 1.8 },
  ],
  upsells: [{ id: 'staple', label: 'Скрепить', add: 30 }],
};

/**
 * Копирование документов (service_id: document-copy). ТЗ п.2.2 — параметры
 * как у document-print, плюс кол-во оригиналов × копий каждого;
 * итог листов считается автоматически (оригиналы входят множителем).
 */
export const documentCopy: CalcConfig = {
  serviceId: 'document-copy',
  preview: 'sheet',
  defaultQty: 5,
  productionDays: 1,
  qtyLabel: 'Копий каждого',
  // Итого листов = оригиналы × копии, считается автоматически (ТЗ п.2.2).
  derivedNote: (sel, qty) => {
    const orig = Number(sel.originals) || 1;
    return `Итого листов: ${orig} × ${qty} = ${(orig * qty).toLocaleString('ru-RU')}`;
  },
  groups: [
    {
      id: 'format',
      label: 'Формат',
      type: 'segmented',
      default: 'A4',
      options: [
        { id: 'A4', label: 'A4' },
        { id: 'A3', label: 'A3', coeff: 1.8 },
      ],
    },
    {
      id: 'color',
      label: 'Цветность',
      type: 'segmented',
      default: 'bw',
      options: [
        { id: 'bw', label: 'Чёрно-белая' },
        { id: 'color', label: 'Цветная', coeff: 2.2 },
      ],
    },
    {
      id: 'sides',
      label: 'Стороны',
      type: 'segmented',
      default: 'single',
      options: [
        { id: 'single', label: '1 сторона' },
        { id: 'double', label: '2 стороны', coeff: 1.6 },
      ],
    },
    // Кол-во уникальных листов; итого листов = оригиналы × копии (ТЗ п.2.2).
    {
      id: 'originals',
      label: 'Оригиналов (уникальных листов)',
      type: 'segmented',
      default: '1',
      options: [
        { id: '1', label: '1' },
        { id: '2', label: '2', coeff: 2 },
        { id: '5', label: '5', coeff: 5 },
        { id: '10', label: '10', coeff: 10 },
        { id: '20', label: '20', coeff: 20 },
      ],
    },
    {
      id: 'urgency',
      label: 'Срочность',
      type: 'segmented',
      default: 'standard',
      options: [
        { id: 'standard', label: 'Стандарт (1 день)' },
        { id: 'express-4h', label: 'За 4 часа', coeff: 1.3, daysOverride: 0 },
        { id: 'express-1h', label: 'За 1 час', coeff: 1.6, daysOverride: 0 },
      ],
    },
  ],
  qtyTiers: [
    { qty: 1, perUnit: 8 },
    { qty: 10, perUnit: 6 },
    { qty: 50, perUnit: 4 },
    { qty: 200, perUnit: 2.6 },
    { qty: 1000, perUnit: 2 },
  ],
  upsells: [{ id: 'staple', label: 'Скрепить', add: 30 }],
};

export const lamination: CalcConfig = {
  serviceId: 'lamination',
  preview: 'sheet',
  defaultQty: 10,
  productionDays: 1,
  qtyLabel: 'Листов',
  // Express: 2 часа, +30% (ТЗ п.2.5).
  express: { coeff: 1.3, days: 0, label: '2 часа' },
  groups: [
    {
      id: 'format',
      label: 'Формат',
      type: 'segmented',
      default: 'A4',
      options: [
        { id: 'A6', label: 'A6', coeff: 0.5 },
        { id: 'A5', label: 'A5', coeff: 0.7 },
        { id: 'A4', label: 'A4' },
        { id: 'A3', label: 'A3', coeff: 1.8 },
        { id: 'custom', label: 'Свой размер', coeff: 1.5 },
      ],
    },
    { id: 'customW', label: 'Ширина', type: 'dimension', default: 210, min: 50, max: 450, step: 5, unit: 'мм' },
    { id: 'customH', label: 'Высота', type: 'dimension', default: 297, min: 50, max: 620, step: 5, unit: 'мм' },
    {
      id: 'type',
      label: 'Тип плёнки',
      type: 'swatch',
      default: 'gloss',
      options: [
        { id: 'matte', label: 'Матовая', swatch: { kind: 'lam', sheen: 'matte', color: PAPER.light } },
        { id: 'gloss', label: 'Глянцевая', swatch: { kind: 'lam', sheen: 'gloss', color: PAPER.light } },
        {
          id: 'soft-touch',
          label: 'Soft Touch',
          coeff: 1.2,
          swatch: { kind: 'lam', sheen: 'soft', color: PAPER.light },
        },
      ],
    },
    {
      id: 'sides',
      label: 'Стороны',
      type: 'segmented',
      default: 'double',
      options: [
        { id: 'single', label: '1 сторона', coeff: 0.6 },
        { id: 'double', label: '2 стороны' },
      ],
    },
  ],
  // Кол-во листов 1–10 000, цена пороговая по объёму (ТЗ п.2.5).
  qtyTiers: [
    { qty: 1, perUnit: 40 },
    { qty: 10, perUnit: 25 },
    { qty: 50, perUnit: 18 },
    { qty: 200, perUnit: 12 },
    { qty: 1000, perUnit: 9 },
    { qty: 5000, perUnit: 7 },
    { qty: 10000, perUnit: 6 },
  ],
  getHidden: (sel) => (sel.format !== 'custom' ? ['customW', 'customH'] : []),
};

/* ---------- Фотопечать ---------- */
/**
 * Фотопечать — PRESENTATION-слой. Источник истины по форматам, границам,
 * срочности и ценам — backend definition (prisma/demo/photo-print-demo.ts,
 * GET /services/fotopechat-na-bumage/calculator). Здесь: превью, свотчи,
 * подписи цен для dev-фолбэка и скелет на время загрузки definition.
 * Ввод размеров «своего формата» перенесён в оформление заказа (на цену
 * в прототипе он не влиял — 110 ₽/шт всегда).
 */
export const photoPrint: CalcConfig = {
  serviceId: 'photo-print',
  preview: 'sheet',
  defaultQty: 10,
  productionDays: 1,
  qtyLabel: 'Итого фотографий',
  groups: [
    {
      // Мультиформат (ТЗ п.3.1): отдельное поле количества для каждого формата,
      // несколько форматов в одном заказе; итог — разбивка по форматам.
      id: 'formats',
      label: 'Форматы и количество',
      type: 'multi-qty',
      default: '10x15:10',
      options: [
        { id: '10x15', label: '10×15', price: 18 },
        { id: '13x18', label: '13×18', price: 28 },
        { id: '15x20', label: '15×20', price: 36 },
        { id: '20x30', label: '20×30', price: 70 },
        { id: '30x40', label: '30×40', price: 120 },
        { id: '30x45', label: '30×45', price: 140 },
        { id: '40x60', label: '40×60', price: 210 },
        { id: 'custom', label: 'Свой размер', note: 'до 60×90 см', price: 110 },
      ],
    },
    {
      id: 'paper',
      label: 'Бумага',
      type: 'swatch',
      default: 'gloss',
      options: [
        { id: 'gloss', label: 'Глянцевая', swatch: { kind: 'lam', sheen: 'gloss', color: PAPER.bright } },
        { id: 'matte', label: 'Матовая', swatch: { kind: 'lam', sheen: 'matte', color: PAPER.bright } },
        { id: 'satin', label: 'Сатин', swatch: { kind: 'lam', sheen: 'soft', color: PAPER.bright } },
      ],
    },
    {
      id: 'urgency',
      label: 'Срочность',
      type: 'segmented',
      default: 'standard',
      options: [
        { id: 'standard', label: 'Стандарт (1–2 дня)' },
        { id: 'express-4h', label: 'За 4 часа' },
        { id: 'express-1h', label: 'За 1 час' },
      ],
    },
  ],
  qtyTiers: [{ qty: 1, perUnit: 18 }],
};

export const posterPrint: CalcConfig = {
  serviceId: 'poster-print',
  preview: 'sheet',
  defaultQty: 1,
  productionDays: 1,
  // Express: 3–4 часа, +30% (ТЗ п.3.5).
  express: { coeff: 1.3, days: 0, label: '3–4 часа' },
  groups: [
    {
      id: 'format',
      label: 'Формат',
      type: 'segmented',
      default: 'A2',
      options: [
        { id: 'A3', label: 'A3', coeff: 0.55 },
        { id: 'A2', label: 'A2' },
        { id: 'A1', label: 'A1', coeff: 1.8 },
        { id: 'A0', label: 'A0', coeff: 3.2 },
        { id: 'custom', label: 'Свой размер', coeff: 1.5 },
      ],
    },
    { id: 'customW', label: 'Ширина', type: 'dimension', default: 42, min: 30, max: 120, step: 1, unit: 'см' },
    { id: 'customH', label: 'Высота', type: 'dimension', default: 60, min: 30, max: 180, step: 1, unit: 'см' },
    {
      id: 'paper',
      label: 'Бумага',
      type: 'swatch',
      default: 'glossy-photo',
      options: [
        {
          id: 'glossy-photo',
          label: 'Глянцевая фото',
          swatch: { kind: 'lam', sheen: 'gloss', color: PAPER.bright },
        },
        {
          id: 'matte-photo',
          label: 'Матовая фото',
          swatch: { kind: 'lam', sheen: 'matte', color: PAPER.bright },
        },
        {
          id: 'poster-130',
          label: 'Постерная 130 г',
          coeff: 0.8,
          swatch: { kind: 'paper', color: PAPER.light },
        },
      ],
    },
  ],
  qtyTiers: [
    { qty: 1, perUnit: 500 },
    { qty: 10, perUnit: 300 },
    { qty: 50, perUnit: 220 },
    { qty: 100, perUnit: 180 },
  ],
  getHidden: (sel) => (sel.format !== 'custom' ? ['customW', 'customH'] : []),
};

/**
 * Накатка на пенокартон (service_id: foam-board). ТЗ п.3.6 — параметры
 * постера, плюс толщина основы и петля для подвески.
 */
export const foamBoard: CalcConfig = {
  serviceId: 'foam-board',
  preview: 'sheet',
  defaultQty: 1,
  productionDays: 1,
  express: { coeff: 1.3, days: 0, label: '3–4 часа' },
  groups: [
    {
      id: 'format',
      label: 'Формат',
      type: 'segmented',
      default: 'A2',
      options: [
        { id: 'A3', label: 'A3', coeff: 0.55 },
        { id: 'A2', label: 'A2' },
        { id: 'A1', label: 'A1', coeff: 1.8 },
        { id: 'A0', label: 'A0', coeff: 3.2 },
        { id: 'custom', label: 'Свой размер', coeff: 1.5 },
      ],
    },
    { id: 'customW', label: 'Ширина', type: 'dimension', default: 42, min: 30, max: 120, step: 1, unit: 'см' },
    { id: 'customH', label: 'Высота', type: 'dimension', default: 60, min: 30, max: 180, step: 1, unit: 'см' },
    {
      id: 'paper',
      label: 'Бумага',
      type: 'swatch',
      default: 'matte-photo',
      options: [
        {
          id: 'glossy-photo',
          label: 'Глянцевая фото',
          swatch: { kind: 'lam', sheen: 'gloss', color: PAPER.bright },
        },
        {
          id: 'matte-photo',
          label: 'Матовая фото',
          swatch: { kind: 'lam', sheen: 'matte', color: PAPER.bright },
        },
      ],
    },
    // Толщина пенокартона 3/5/10 мм (ТЗ п.3.6).
    {
      id: 'thickness',
      label: 'Толщина основы',
      type: 'segmented',
      default: '5mm',
      options: [
        { id: '3mm', label: '3 мм', coeff: 0.9 },
        { id: '5mm', label: '5 мм' },
        { id: '10mm', label: '10 мм', coeff: 1.25 },
      ],
    },
  ],
  qtyTiers: [
    { qty: 1, perUnit: 900 },
    { qty: 10, perUnit: 700 },
    { qty: 50, perUnit: 550 },
  ],
  // Петля для подвески +30 ₽ (ТЗ п.3.6).
  upsells: [{ id: 'loop', label: 'Петля для подвески', add: 30 }],
  getHidden: (sel) => (sel.format !== 'custom' ? ['customW', 'customH'] : []),
};

export const canvasPrint: CalcConfig = {
  serviceId: 'canvas-print',
  preview: 'sheet',
  defaultQty: 1,
  productionDays: 2,
  // Express: 1 день, +30% (ТЗ п.3.4).
  express: { coeff: 1.3, days: 1, label: '1 день' },
  // От 3 шт. — скидка 5% (ТЗ п.3.4).
  qtyDiscount: [{ from: 3, coeff: 0.95 }],
  groups: [
    {
      // Размеры по ТЗ п.3.4: 20x30…80x100 + custom.
      id: 'size',
      label: 'Размер (см)',
      type: 'segmented',
      default: '40x60',
      options: [
        { id: '20x30', label: '20×30', coeff: 0.45 },
        { id: '30x40', label: '30×40', coeff: 0.6 },
        { id: '40x60', label: '40×60' },
        { id: '50x70', label: '50×70', coeff: 1.6 },
        { id: '60x80', label: '60×80', coeff: 2.2 },
        { id: '60x90', label: '60×90', coeff: 2.5 },
        { id: '80x100', label: '80×100', coeff: 3.4 },
        { id: 'custom', label: 'Свой размер', coeff: 1.8 },
      ],
    },
    { id: 'customW', label: 'Ширина', type: 'dimension', default: 40, min: 20, max: 150, step: 5, unit: 'см' },
    { id: 'customH', label: 'Высота', type: 'dimension', default: 60, min: 20, max: 150, step: 5, unit: 'см' },
    {
      id: 'frame',
      label: 'Подрамник',
      type: 'segmented',
      default: 'with',
      options: [
        { id: 'with', label: '3 см' },
        { id: 'thick', label: '4 см', coeff: 1.2 },
        { id: 'without', label: 'Рулон', coeff: 0.75 },
      ],
    },
    // Загиб кромки — только при наличии подрамника (ТЗ п.3.4).
    {
      id: 'wrap',
      label: 'Загиб',
      type: 'segmented',
      default: 'mirror',
      options: [
        { id: 'mirror', label: 'Зеркальный' },
        { id: 'white', label: 'Белый' },
        { id: 'black', label: 'Чёрный' },
        { id: 'color-continuation', label: 'Продолжение картинки', coeff: 1.05 },
      ],
    },
  ],
  qtyTiers: [
    { qty: 1, perUnit: 1400 },
    { qty: 3, perUnit: 1250 },
    { qty: 5, perUnit: 1100 },
  ],
  getHidden: (sel) => {
    const hidden: string[] = [];
    if (sel.size !== 'custom') hidden.push('customW', 'customH');
    if (sel.frame === 'without') hidden.push('wrap');
    return hidden;
  },
};

/* ---------- Наклейки и этикетки ---------- */
export const stickers: CalcConfig = {
  serviceId: 'stickers',
  preview: 'sheet',
  defaultQty: 100,
  productionDays: 1,
  // Express: 1 день, +30% (ТЗ п.5.1).
  express: { coeff: 1.3, days: 1, label: '1 день' },
  groups: [
    {
      // Типы по ТЗ п.5.1: sheet / cut / sticker-pack.
      id: 'type',
      label: 'Тип',
      type: 'segmented',
      default: 'cut',
      options: [
        { id: 'sheet', label: 'На листе' },
        { id: 'cut', label: 'Вырубные' },
        { id: 'sticker-pack', label: 'Стикерпак', coeff: 1.2 },
      ],
    },
    // Форма вырубки — только для cut (ТЗ п.5.1).
    {
      id: 'shape',
      label: 'Форма вырубки',
      type: 'segmented',
      default: 'circle',
      options: [
        { id: 'circle', label: 'Круг' },
        { id: 'square', label: 'Квадрат' },
        { id: 'rectangle', label: 'Прямоугольник' },
        { id: 'oval', label: 'Овал' },
        { id: 'contour', label: 'По контуру', coeff: 1.3 },
      ],
    },
    // Размер наклейки, мм (диаметр или большая сторона).
    { id: 'size', label: 'Размер', type: 'dimension', default: 50, min: 20, max: 200, step: 5, unit: 'мм' },
    // Формат листа — для стикерпака (ТЗ п.5.1).
    {
      id: 'sheetFormat',
      label: 'Формат листа',
      type: 'segmented',
      default: 'A5',
      options: [
        { id: 'A6', label: 'A6', coeff: 0.7 },
        { id: 'A5', label: 'A5' },
        { id: 'A4', label: 'A4', coeff: 1.5 },
      ],
    },
    {
      id: 'material',
      label: 'Материал',
      type: 'swatch',
      default: 'paper-gloss',
      options: [
        {
          id: 'paper-gloss',
          label: 'Бумага глянец',
          swatch: { kind: 'lam', sheen: 'gloss', color: PAPER.bright },
        },
        {
          id: 'paper-matte',
          label: 'Бумага мат',
          swatch: { kind: 'lam', sheen: 'matte', color: PAPER.bright },
        },
        { id: 'film-white', label: 'Плёнка белая', coeff: 1.2, swatch: { kind: 'paper', color: '#ffffff' } },
        {
          id: 'film-transparent',
          label: 'Прозрачная',
          coeff: 1.3,
          swatch: { kind: 'paper', color: '#dfeaf2' },
        },
        {
          id: 'film-holographic',
          label: 'Голография',
          coeff: 1.5,
          swatch: { kind: 'foil', color: 'linear-gradient(135deg,#ff9be6,#9bdcff,#b6ff9b)' },
        },
      ],
    },
  ],
  qtyTiers: [
    { qty: 1, perUnit: 25 },
    { qty: 10, perUnit: 15 },
    { qty: 50, perUnit: 8 },
    { qty: 100, perUnit: 5 },
    { qty: 500, perUnit: 2.5 },
    { qty: 1000, perUnit: 1.8 },
    { qty: 5000, perUnit: 1.1 },
  ],
  getHidden: (sel) => {
    const hidden: string[] = [];
    if (sel.type !== 'cut') hidden.push('shape');
    if (sel.type === 'sticker-pack') hidden.push('size');
    if (sel.type !== 'sticker-pack') hidden.push('sheetFormat');
    return hidden;
  },
  // Мин: вырубные — 10 шт., листовые/стикерпак — от 1 листа (ТЗ п.5.1).
  getMinQty: (sel) => (sel.type === 'cut' ? 10 : 1),
};

export const labels: CalcConfig = {
  serviceId: 'labels',
  preview: 'sheet',
  defaultQty: 500,
  productionDays: 2,
  groups: [
    {
      // Типы по ТЗ п.5.2: label-roll / label-sheet / clothing-tag / barcode.
      id: 'type',
      label: 'Тип',
      type: 'segmented',
      default: 'label-roll',
      options: [
        { id: 'label-roll', label: 'Этикетки в рулоне' },
        { id: 'label-sheet', label: 'Этикетки на листе' },
        { id: 'clothing-tag', label: 'Бирки для одежды', coeff: 1.3 },
        { id: 'barcode', label: 'Штрихкоды' },
      ],
    },
    // Размер: ширина × высота в мм (ТЗ п.5.2).
    { id: 'width', label: 'Ширина', type: 'dimension', default: 58, min: 15, max: 150, step: 1, unit: 'мм' },
    { id: 'height', label: 'Высота', type: 'dimension', default: 40, min: 10, max: 100, step: 1, unit: 'мм' },
    // Материал этикеток (ТЗ п.5.2).
    {
      id: 'material',
      label: 'Материал',
      type: 'swatch',
      default: 'paper-white',
      options: [
        { id: 'paper-white', label: 'Бумага белая', swatch: { kind: 'paper', color: PAPER.bright } },
        { id: 'film-white', label: 'Плёнка белая', coeff: 1.3, swatch: { kind: 'paper', color: '#ffffff' } },
        { id: 'craft', label: 'Крафт', coeff: 1.1, swatch: { kind: 'paper', color: '#cbb893' } },
      ],
    },
    // Материал бирок (ТЗ п.5.2).
    {
      id: 'tagMaterial',
      label: 'Материал бирки',
      type: 'swatch',
      default: 'coated-300',
      options: [
        { id: 'coated-300', label: 'Мелованная 300 г', swatch: { kind: 'paper', color: PAPER.cream } },
        { id: 'tyvek', label: 'Тайвек', coeff: 1.3, swatch: { kind: 'paper', color: '#f4f4f2' } },
        { id: 'plastic-pvc', label: 'Пластик PVC', coeff: 1.5, swatch: { kind: 'paper', color: '#eef0f2' } },
      ],
    },
    // Крепление бирки (ТЗ п.5.2).
    {
      id: 'fix',
      label: 'Крепление',
      type: 'segmented',
      default: 'hole',
      options: [
        { id: 'hole', label: 'Отверстие' },
        { id: 'hole-pin', label: 'Отверстие + пин', perUnitAdd: 3 },
        { id: 'self-adhesive', label: 'Самоклейка' },
      ],
    },
  ],
  qtyTiers: [
    { qty: 50, perUnit: 5 },
    { qty: 100, perUnit: 4 },
    { qty: 500, perUnit: 2 },
    { qty: 1000, perUnit: 1.3 },
    { qty: 5000, perUnit: 0.8 },
    { qty: 10000, perUnit: 0.5 },
  ],
  getHidden: (sel) => {
    const isTag = sel.type === 'clothing-tag';
    return isTag ? ['material'] : ['tagMaterial', 'fix'];
  },
  // Мин: этикетки в рулоне — 100, бирки — 50 (ТЗ п.5.2).
  getMinQty: (sel) => (sel.type === 'label-roll' || sel.type === 'barcode' ? 100 : 50),
};

/* ---------- Календари ---------- */
export const calendarWall: CalcConfig = {
  serviceId: 'calendar-wall',
  preview: 'sheet',
  defaultQty: 50,
  productionDays: 5,
  // Срочность: только standard, 5–7 дней (ТЗ п.6.1) — экспресс недоступен.
  groups: [
    {
      id: 'format',
      label: 'Формат',
      type: 'segmented',
      default: 'A3',
      options: [
        { id: 'A3', label: 'A3' },
        { id: 'A2', label: 'A2', coeff: 1.8 },
        { id: 'custom', label: 'Свой размер', coeff: 1.4 },
      ],
    },
    { id: 'customW', label: 'Ширина', type: 'dimension', default: 30, min: 20, max: 60, step: 1, unit: 'см' },
    { id: 'customH', label: 'Высота', type: 'dimension', default: 42, min: 20, max: 86, step: 1, unit: 'см' },
    {
      id: 'sheets',
      label: 'Листов (перекидок)',
      type: 'segmented',
      default: '12+1',
      options: [
        { id: '12+1', label: '12+1' },
        { id: '6+1', label: '6+1', coeff: 0.6 },
        { id: '4+1', label: '4+1', coeff: 0.45 },
      ],
    },
    {
      id: 'binding',
      label: 'Скрепление',
      type: 'segmented',
      default: 'eurohook',
      options: [
        { id: 'eurohook', label: 'Евроспираль' },
        { id: 'spiral-metal', label: 'Метал. пружина', coeff: 1.2 },
      ],
    },
    // Бумага блока (ТЗ п.6.1).
    {
      id: 'paper',
      label: 'Бумага блока',
      type: 'swatch',
      default: 'coated-115',
      options: [
        { id: 'coated-115', label: 'Мелованная 115 г', swatch: { kind: 'paper', color: PAPER.light } },
        {
          id: 'coated-150',
          label: 'Мелованная 150 г',
          coeff: 1.15,
          swatch: { kind: 'paper', color: PAPER.cream },
        },
      ],
    },
    // Покрытие обложки (ТЗ п.6.1).
    {
      id: 'coverCoating',
      label: 'Покрытие обложки',
      type: 'swatch',
      default: 'none',
      options: [
        { id: 'none', label: 'Без', swatch: { kind: 'lam', sheen: 'none', color: PAPER.cream } },
        {
          id: 'matte-lam',
          label: 'Матовая',
          coeff: 1.1,
          swatch: { kind: 'lam', sheen: 'matte', color: PAPER.cream },
        },
        {
          id: 'gloss-lam',
          label: 'Глянцевая',
          coeff: 1.1,
          swatch: { kind: 'lam', sheen: 'gloss', color: PAPER.cream },
        },
      ],
    },
    // Год — данные календарной сетки (ТЗ п.6.1).
    {
      id: 'year',
      label: 'Год',
      type: 'segmented',
      default: '2027',
      options: [
        { id: '2026', label: '2026' },
        { id: '2027', label: '2027' },
      ],
    },
  ],
  // Тираж 10–5 000 (ТЗ п.6.1).
  qtyTiers: [
    { qty: 10, perUnit: 350 },
    { qty: 50, perUnit: 220 },
    { qty: 100, perUnit: 170 },
    { qty: 500, perUnit: 120 },
    { qty: 1000, perUnit: 95 },
    { qty: 5000, perUnit: 80 },
  ],
  upsells: [{ id: 'pad', label: 'Подложка-подвес', perUnitAdd: 15 }],
  getHidden: (sel) => (sel.format !== 'custom' ? ['customW', 'customH'] : []),
};

export const calendarPocket: CalcConfig = {
  serviceId: 'calendar-pocket',
  preview: 'card',
  defaultQty: 500,
  productionDays: 2,
  // Express: ≤ 500 шт., 1 день, +30% (ТЗ п.6.3).
  express: { coeff: 1.3, days: 1, label: '1 день', maxQty: 500 },
  groups: [
    {
      id: 'format',
      label: 'Формат',
      type: 'segmented',
      default: '70x100',
      options: [
        { id: '70x100', label: '70×100' },
        { id: '90x50', label: '90×50', coeff: 0.85 },
        { id: '85x55', label: '85×55', coeff: 0.85 },
      ],
    },
    {
      id: 'paper',
      label: 'Бумага',
      type: 'swatch',
      default: 'coated-300',
      options: [
        { id: 'coated-300', label: 'Мелованная 300 г', swatch: { kind: 'paper', color: PAPER.cream } },
        {
          id: 'coated-350',
          label: 'Мелованная 350 г',
          coeff: 1.1,
          swatch: { kind: 'paper', color: PAPER.light },
        },
      ],
    },
    {
      id: 'coating',
      label: 'Покрытие',
      type: 'swatch',
      default: 'gloss-lam',
      options: [
        { id: 'none', label: 'Без', swatch: { kind: 'lam', sheen: 'none', color: PAPER.cream } },
        { id: 'matte-lam', label: 'Матовая', swatch: { kind: 'lam', sheen: 'matte', color: PAPER.cream } },
        { id: 'gloss-lam', label: 'Глянцевая', swatch: { kind: 'lam', sheen: 'gloss', color: PAPER.cream } },
        {
          id: 'soft-touch',
          label: 'Soft Touch',
          coeff: 1.2,
          swatch: { kind: 'lam', sheen: 'soft', color: PAPER.cream },
        },
      ],
    },
  ],
  // Тираж 100–50 000 (ТЗ п.6.3).
  qtyTiers: [
    { qty: 100, perUnit: 9 },
    { qty: 500, perUnit: 4 },
    { qty: 1000, perUnit: 2.6 },
    { qty: 5000, perUnit: 1.4 },
    { qty: 10000, perUnit: 1.1 },
    { qty: 50000, perUnit: 0.9 },
  ],
};

/* ---------- Сувениры и текстиль ---------- */
export const tshirt: CalcConfig = {
  serviceId: 'tshirt-print',
  preview: 'generic',
  defaultQty: 1,
  productionDays: 4,
  qtyLabel: 'Итого футболок',
  // Express: 1–2 дня, мин. 5 шт., +30% (ТЗ п.8.1).
  express: { coeff: 1.3, days: 2, label: '1–2 дня', minQty: 5 },
  groups: [
    {
      // Цвета по ТЗ п.8.1: white/black/grey/navy/red/yellow/green.
      id: 'color',
      label: 'Цвет футболки',
      type: 'swatch',
      default: 'white',
      options: [
        { id: 'white', label: 'Белая', swatch: { kind: 'ink', color: '#fafafa' } },
        { id: 'black', label: 'Чёрная', swatch: { kind: 'ink', color: '#222222' } },
        { id: 'grey', label: 'Серая', swatch: { kind: 'ink', color: '#8a8a8a' } },
        { id: 'navy', label: 'Синяя', swatch: { kind: 'ink', color: '#243b6b' } },
        { id: 'red', label: 'Красная', swatch: { kind: 'ink', color: '#c0392b' } },
        { id: 'yellow', label: 'Жёлтая', swatch: { kind: 'ink', color: '#e8c332' } },
        { id: 'green', label: 'Зелёная', swatch: { kind: 'ink', color: '#2e8b57' } },
      ],
    },
    {
      // Мультиразмер (ТЗ п.8.1): таблица «размер → количество», XS–3XL.
      id: 'sizes',
      label: 'Размеры и количество',
      type: 'multi-qty',
      default: 'M:1',
      options: [
        { id: 'XS', label: 'XS' },
        { id: 'S', label: 'S' },
        { id: 'M', label: 'M' },
        { id: 'L', label: 'L' },
        { id: 'XL', label: 'XL' },
        { id: '2XL', label: '2XL', note: '+10%', coeff: 1.1 },
        { id: '3XL', label: '3XL', note: '+15%', coeff: 1.15 },
      ],
    },
    {
      id: 'method',
      label: 'Метод нанесения',
      type: 'segmented',
      default: 'dtg',
      options: [
        { id: 'dtg', label: 'DTG (цифровая)' },
        { id: 'screenprint', label: 'Шелкография', coeff: 0.9, note: 'от 50 шт.' },
        { id: 'transfer', label: 'Термотрансфер', coeff: 0.95 },
      ],
    },
    // Кол-во цветов — только для шелкографии, 1–8 (ТЗ п.8.1).
    {
      id: 'inkColors',
      label: 'Кол-во цветов',
      type: 'segmented',
      default: '1',
      options: [
        { id: '1', label: '1' },
        { id: '2', label: '2', coeff: 1.15 },
        { id: '4', label: '4', coeff: 1.4 },
        { id: '6', label: '6', coeff: 1.65 },
        { id: '8', label: '8', coeff: 1.9 },
      ],
    },
    {
      // Зоны по ТЗ п.8.1: front/back/front+back/sleeve.
      id: 'zone',
      label: 'Зона нанесения',
      type: 'segmented',
      default: 'front',
      options: [
        { id: 'front', label: 'Перёд' },
        { id: 'back', label: 'Спина' },
        { id: 'front+back', label: 'Перёд + спина', coeff: 1.6 },
        { id: 'sleeve', label: 'Рукав', coeff: 0.8 },
      ],
    },
    // Размер нанесения (ТЗ п.8.1).
    {
      id: 'printSize',
      label: 'Размер нанесения',
      type: 'segmented',
      default: 'medium',
      options: [
        { id: 'small', label: 'До 10×10 см', coeff: 0.85 },
        { id: 'medium', label: 'До 20×20 см' },
        { id: 'large', label: 'До 30×40 см', coeff: 1.25 },
        { id: 'fullprint', label: 'Fullprint', coeff: 1.7 },
      ],
    },
  ],
  qtyTiers: [
    { qty: 1, perUnit: 900 },
    { qty: 5, perUnit: 750 },
    { qty: 10, perUnit: 650 },
    { qty: 50, perUnit: 500 },
    { qty: 100, perUnit: 420 },
  ],
  getHidden: (sel) => (sel.method !== 'screenprint' ? ['inkColors'] : []),
  // Шелкография — от 50 шт., DTG и трансфер — от 1 (ТЗ п.8.1).
  getMinQty: (sel) => (sel.method === 'screenprint' ? 50 : 1),
};

export const mug: CalcConfig = {
  serviceId: 'mug-print',
  preview: 'generic',
  defaultQty: 1,
  productionDays: 2,
  // Express: 1 день, +40% (ТЗ п.8.2).
  express: { coeff: 1.4, days: 1, label: '1 день' },
  groups: [
    {
      id: 'type',
      label: 'Тип кружки',
      type: 'swatch',
      default: 'standard-white',
      options: [
        { id: 'standard-white', label: 'Белая 330 мл', swatch: { kind: 'ink', color: '#fafafa' } },
        { id: 'color-inside', label: 'Цвет внутри 330 мл', coeff: 1.2, swatch: { kind: 'ink', color: '#c0392b' } },
        { id: 'travel-mug', label: 'Термокружка 450 мл', coeff: 1.6, swatch: { kind: 'ink', color: '#3a3a3a' } },
        { id: 'magic', label: 'Хамелеон 330 мл', coeff: 1.5, swatch: { kind: 'ink', color: '#222222' } },
      ],
    },
    {
      id: 'zone',
      label: 'Зона печати',
      type: 'segmented',
      default: 'full',
      options: [
        { id: 'full', label: 'По кругу' },
        { id: 'half', label: 'С одной стороны', coeff: 0.8 },
      ],
    },
  ],
  qtyTiers: [
    { qty: 1, perUnit: 450 },
    { qty: 5, perUnit: 380 },
    { qty: 10, perUnit: 320 },
    { qty: 50, perUnit: 260 },
  ],
  upsells: [
    { id: 'gift-box', label: 'Подарочная коробка', add: 120 },
    { id: 'spoon', label: 'Ложка', add: 80 },
  ],
};

export const shopper: CalcConfig = {
  serviceId: 'shopper-print',
  preview: 'generic',
  defaultQty: 10,
  productionDays: 4,
  groups: [
    {
      id: 'type',
      label: 'Тип',
      type: 'swatch',
      default: 'cotton-natural',
      options: [
        { id: 'cotton-natural', label: 'Хлопок суровый', swatch: { kind: 'paper', color: '#e8e2d2' } },
        { id: 'cotton-white', label: 'Хлопок белый', swatch: { kind: 'paper', color: '#fafafa' } },
        { id: 'non-woven', label: 'Спанбонд', coeff: 0.8, swatch: { kind: 'paper', color: '#dfe6ea' } },
      ],
    },
    {
      // Размеры по ТЗ п.8.3 с габаритами.
      id: 'size',
      label: 'Размер',
      type: 'segmented',
      default: 'standard',
      options: [
        { id: 'small', label: 'Малый 30×35×6', coeff: 0.85 },
        { id: 'standard', label: 'Стандарт 38×42×8' },
        { id: 'large', label: 'Большой 42×38×8', coeff: 1.2 },
      ],
    },
    {
      id: 'method',
      label: 'Метод нанесения',
      type: 'segmented',
      default: 'screenprint',
      options: [
        { id: 'screenprint', label: 'Шелкография' },
        { id: 'transfer', label: 'Термотрансфер', coeff: 1.05 },
        { id: 'dtg', label: 'DTG', coeff: 1.15 },
      ],
    },
    // Кол-во цветов — для шелкографии, 1–4 (ТЗ п.8.3).
    {
      id: 'inkColors',
      label: 'Кол-во цветов',
      type: 'segmented',
      default: '1',
      options: [
        { id: '1', label: '1' },
        { id: '2', label: '2', coeff: 1.15 },
        { id: '3', label: '3', coeff: 1.3 },
        { id: '4', label: '4', coeff: 1.45 },
      ],
    },
    // Зона нанесения (ТЗ п.8.3).
    {
      id: 'zone',
      label: 'Зона нанесения',
      type: 'segmented',
      default: 'front',
      options: [
        { id: 'front', label: 'Одна сторона' },
        { id: 'front+back', label: 'Две стороны', coeff: 1.5 },
      ],
    },
  ],
  // Мин. 10 шт. (ТЗ п.8.3).
  qtyTiers: [
    { qty: 10, perUnit: 350 },
    { qty: 50, perUnit: 280 },
    { qty: 100, perUnit: 230 },
    { qty: 500, perUnit: 180 },
  ],
  getHidden: (sel) => (sel.method !== 'screenprint' ? ['inkColors'] : []),
  getMinQty: () => 10,
};

/* ---------- Печати и штампы ---------- */
export const stampAuto: CalcConfig = {
  serviceId: 'stamp-auto',
  preview: 'generic',
  defaultQty: 1,
  productionDays: 1,
  // Express: 4 часа, +50% (ТЗ п.7.1).
  express: { coeff: 1.5, days: 0, label: '4 часа' },
  groups: [
    {
      // Модели оснастки с размером поля — по ТЗ п.7.1 (справочник в БД).
      id: 'model',
      label: 'Модель оснастки',
      type: 'select',
      default: 'trodat-4912',
      options: [
        { id: 'trodat-4910', label: 'Trodat 4910', note: '26×9 мм', coeff: 0.85 },
        { id: 'trodat-4911', label: 'Trodat 4911', note: '38×14 мм', coeff: 0.9 },
        { id: 'trodat-4912', label: 'Trodat 4912', note: '47×18 мм' },
        { id: 'trodat-4913', label: 'Trodat 4913', note: '58×22 мм', coeff: 1.2 },
        { id: 'trodat-4915', label: 'Trodat 4915', note: '70×25 мм', coeff: 1.35 },
        { id: 'trodat-4926', label: 'Trodat 4926', note: '75×38 мм', coeff: 1.5 },
        { id: 'colop-e10', label: 'Colop E10', note: '27×10 мм', coeff: 0.9 },
        { id: 'colop-e20', label: 'Colop E20', note: '38×14 мм', coeff: 0.95 },
        { id: 'colop-e30', label: 'Colop E30', note: '47×18 мм', coeff: 1.05 },
        { id: 'colop-e40', label: 'Colop E40', note: '59×23 мм', coeff: 1.25 },
      ],
    },
    {
      id: 'ink',
      label: 'Цвет чернил',
      type: 'swatch',
      default: 'blue',
      options: [
        { id: 'blue', label: 'Синий', swatch: { kind: 'ink', color: '#1d4ed8' } },
        { id: 'black', label: 'Чёрный', swatch: { kind: 'ink', color: '#111111' } },
        { id: 'red', label: 'Красный', swatch: { kind: 'ink', color: '#c0392b' } },
        { id: 'green', label: 'Зелёный', swatch: { kind: 'ink', color: '#16a34a' } },
        { id: 'violet', label: 'Фиолетовый', swatch: { kind: 'ink', color: '#7c3aed' } },
      ],
    },
    // Макет: ввод текста построчно или загрузка файла (ТЗ п.7.1).
    {
      id: 'maket',
      label: 'Макет',
      type: 'segmented',
      default: 'text',
      options: [
        { id: 'text', label: 'Ввести текст' },
        { id: 'file', label: 'Загрузить файл (AI, PDF, CDR)' },
      ],
    },
  ],
  qtyTiers: [
    { qty: 1, perUnit: 900 },
    { qty: 3, perUnit: 800 },
    { qty: 5, perUnit: 700 },
  ],
  upsells: [{ id: 'spare-pad', label: 'Запасная подушка', add: 150 }],
};

/**
 * Карманные печати (service_id: stamp-pocket). ТЗ п.7.2.
 */
export const stampPocket: CalcConfig = {
  serviceId: 'stamp-pocket',
  preview: 'generic',
  defaultQty: 1,
  productionDays: 1,
  groups: [
    {
      id: 'shape',
      label: 'Форма',
      type: 'segmented',
      default: 'circle-40',
      options: [
        { id: 'circle-40', label: 'Круг 40 мм' },
        { id: 'circle-35', label: 'Круг 35 мм', coeff: 0.9 },
        { id: 'circle-32', label: 'Круг 32 мм', coeff: 0.85 },
        { id: 'rectangle-50x30', label: '50×30 мм', coeff: 1.05 },
        { id: 'rectangle-60x40', label: '60×40 мм', coeff: 1.2 },
      ],
    },
    {
      id: 'ink',
      label: 'Цвет чернил',
      type: 'swatch',
      default: 'blue',
      options: [
        { id: 'blue', label: 'Синий', swatch: { kind: 'ink', color: '#1d4ed8' } },
        { id: 'black', label: 'Чёрный', swatch: { kind: 'ink', color: '#111111' } },
        { id: 'red', label: 'Красный', swatch: { kind: 'ink', color: '#c0392b' } },
      ],
    },
    {
      id: 'maket',
      label: 'Макет',
      type: 'segmented',
      default: 'text',
      options: [
        { id: 'text', label: 'Ввести текст' },
        { id: 'file', label: 'Загрузить файл' },
      ],
    },
  ],
  qtyTiers: [
    { qty: 1, perUnit: 750 },
    { qty: 3, perUnit: 680 },
    { qty: 5, perUnit: 620 },
  ],
  // Запасная подушка +100 ₽ (ТЗ п.7.2).
  upsells: [{ id: 'spare-pad', label: 'Запасная подушка', add: 100 }],
};

/**
 * Факсимиле (service_id: facsimile). ТЗ п.7.2 — форма, размер 20×10–80×40 мм,
 * метод flash/laser, оснастка auto/without.
 */
export const facsimile: CalcConfig = {
  serviceId: 'facsimile',
  preview: 'generic',
  defaultQty: 1,
  productionDays: 1,
  groups: [
    {
      id: 'shape',
      label: 'Форма',
      type: 'segmented',
      default: 'rectangle',
      options: [
        { id: 'rectangle', label: 'Прямоугольная' },
        { id: 'custom-shape', label: 'По контуру подписи', coeff: 1.25 },
      ],
    },
    { id: 'width', label: 'Ширина', type: 'dimension', default: 50, min: 20, max: 80, step: 1, unit: 'мм' },
    { id: 'height', label: 'Высота', type: 'dimension', default: 20, min: 10, max: 40, step: 1, unit: 'мм' },
    {
      id: 'method',
      label: 'Метод изготовления',
      type: 'segmented',
      default: 'flash',
      options: [
        { id: 'flash', label: 'Флеш-технология' },
        { id: 'laser', label: 'Лазерная гравировка', coeff: 1.15 },
      ],
    },
    {
      id: 'mount',
      label: 'Оснастка',
      type: 'segmented',
      default: 'auto',
      options: [
        { id: 'auto', label: 'Автоматическая' },
        { id: 'without', label: 'Без оснастки', coeff: 0.7 },
      ],
    },
  ],
  qtyTiers: [
    { qty: 1, perUnit: 1400 },
    { qty: 3, perUnit: 1250 },
  ],
};

/* ---------- Полиграфия (буклеты, открытки, сертификаты, меню) ---------- */
export const booklets: CalcConfig = {
  serviceId: 'booklets',
  preview: 'sheet',
  defaultQty: 100,
  productionDays: 3,
  // Express: 1 день, +40%, тираж ≤ 1 000 (ТЗ п.1.3).
  express: { coeff: 1.4, days: 1, label: '1 день', maxQty: 1000 },
  groups: [
    {
      id: 'format',
      label: 'Формат (развёрнутый)',
      type: 'segmented',
      default: 'a4-bifold',
      options: [
        { id: 'dl-trifold', label: 'Евро (DL)', coeff: 0.9 },
        { id: 'a4-bifold', label: 'A4' },
        { id: 'a4-trifold', label: 'A4 широкий', coeff: 1.1 },
        { id: 'a5-bifold', label: 'A5', coeff: 0.8 },
      ],
    },
    // Тип фальцовки, совместимость с форматом (ТЗ п.1.3).
    {
      id: 'fold',
      label: 'Тип фальцовки',
      type: 'segmented',
      default: 'bifold',
      options: [
        { id: 'bifold', label: '1 фальц (bifold)' },
        { id: 'trifold', label: '2 фальца (trifold)', coeff: 1.05 },
        { id: 'gatefold', label: 'Воротами (gatefold)', coeff: 1.15 },
        { id: 'zfold', label: 'Гармошка (Z-fold)', coeff: 1.05 },
      ],
    },
    {
      id: 'paper',
      label: 'Бумага',
      type: 'swatch',
      default: 'coated-150',
      options: [
        {
          id: 'coated-115',
          label: 'Мелованная 115 г',
          coeff: 0.9,
          swatch: { kind: 'paper', color: PAPER.light },
        },
        { id: 'coated-150', label: 'Мелованная 150 г', swatch: { kind: 'paper', color: PAPER.cream } },
        {
          id: 'coated-200',
          label: 'Мелованная 200 г',
          coeff: 1.15,
          swatch: { kind: 'paper', color: PAPER.warm },
        },
        {
          id: 'design',
          label: 'Дизайнерская',
          coeff: 1.25,
          badge: 'премиум',
          swatch: { kind: 'paper', color: '#e7ded0' },
        },
      ],
    },
    {
      id: 'coating',
      label: 'Ламинация',
      type: 'swatch',
      default: 'none',
      options: [
        { id: 'none', label: 'Без', swatch: { kind: 'lam', sheen: 'none', color: PAPER.cream } },
        {
          id: 'matte-lam',
          label: 'Матовая',
          coeff: 1.1,
          swatch: { kind: 'lam', sheen: 'matte', color: PAPER.cream },
        },
        {
          id: 'gloss-lam',
          label: 'Глянцевая',
          coeff: 1.1,
          swatch: { kind: 'lam', sheen: 'gloss', color: PAPER.cream },
        },
        {
          id: 'soft-touch',
          label: 'Soft Touch',
          coeff: 1.2,
          swatch: { kind: 'lam', sheen: 'soft', color: PAPER.cream },
        },
      ],
    },
  ],
  // Тираж 100–50 000, шаг 100 (ТЗ п.1.3).
  qtyTiers: [
    { qty: 100, perUnit: 28 },
    { qty: 500, perUnit: 16 },
    { qty: 1000, perUnit: 11 },
    { qty: 5000, perUnit: 7 },
    { qty: 10000, perUnit: 5 },
    { qty: 50000, perUnit: 4 },
  ],
  upsells: [
    { id: 'design', label: 'Разработка дизайна (6 полос)', add: 2500 },
    { id: 'glued-pocket', label: 'Клеевой кармашек', perUnitAdd: 4 },
  ],
  // Совместимость фальцовки с форматом: «2 фальца» — bifold-форматы только bifold.
  getDisabled: (sel) => {
    const bifoldOnly = sel.format === 'a4-bifold' || sel.format === 'a5-bifold';
    return bifoldOnly ? { fold: ['trifold', 'gatefold', 'zfold'] } : { fold: ['bifold'] };
  },
};

export const postcards: CalcConfig = {
  serviceId: 'postcards',
  preview: 'card',
  defaultQty: 100,
  productionDays: 2,
  // Срочность: только standard, 2 дня (ТЗ п.1.4) — экспресс недоступен.
  groups: [
    {
      id: 'format',
      label: 'Формат',
      type: 'segmented',
      default: '148x105',
      options: [
        { id: '148x105', label: '148×105' },
        { id: '150x150', label: '150×150', coeff: 1.2 },
        { id: '210x99', label: '210×99', coeff: 1.1 },
        { id: '210x148', label: '210×148', coeff: 1.4 },
        { id: 'custom', label: 'Свой размер', coeff: 1.3 },
      ],
    },
    { id: 'customW', label: 'Ширина', type: 'dimension', default: 148, min: 90, max: 300, step: 1, unit: 'мм' },
    { id: 'customH', label: 'Высота', type: 'dimension', default: 105, min: 90, max: 300, step: 1, unit: 'мм' },
    {
      id: 'paper',
      label: 'Бумага',
      type: 'swatch',
      default: 'coated-350',
      options: [
        { id: 'coated-300', label: 'Мелованная 300 г', swatch: { kind: 'paper', color: PAPER.cream } },
        { id: 'coated-350', label: 'Мелованная 350 г', swatch: { kind: 'paper', color: PAPER.light } },
        { id: 'design', label: 'Дизайнерская', coeff: 1.25, swatch: { kind: 'paper', color: '#e7ded0' } },
      ],
    },
    {
      id: 'coating',
      label: 'Покрытие',
      type: 'swatch',
      default: 'matte-lam',
      options: [
        { id: 'none', label: 'Без', swatch: { kind: 'lam', sheen: 'none', color: PAPER.light } },
        { id: 'matte-lam', label: 'Матовая', swatch: { kind: 'lam', sheen: 'matte', color: PAPER.light } },
        { id: 'gloss-lam', label: 'Глянцевая', swatch: { kind: 'lam', sheen: 'gloss', color: PAPER.light } },
        {
          id: 'soft-touch',
          label: 'Soft Touch',
          coeff: 1.2,
          swatch: { kind: 'lam', sheen: 'soft', color: PAPER.light },
        },
      ],
    },
    // Тиснение фольгой +15% (ТЗ п.1.4).
    {
      id: 'foilEmboss',
      label: 'Тиснение фольгой',
      type: 'segmented',
      default: 'no',
      options: [
        { id: 'no', label: 'Без тиснения' },
        { id: 'yes', label: 'С тиснением', coeff: 1.15 },
      ],
    },
    // Конверт: none / C6 (+8 ₽/шт.) / C5 (+12 ₽/шт.) — ТЗ п.1.4.
    {
      id: 'envelope',
      label: 'Конверт',
      type: 'segmented',
      default: 'none',
      options: [
        { id: 'none', label: 'Без конверта' },
        { id: 'c6', label: 'C6', perUnitAdd: 8 },
        { id: 'c5', label: 'C5', perUnitAdd: 12 },
      ],
    },
  ],
  // Тираж 50–5 000, шаг 50 (ТЗ п.1.4).
  qtyTiers: [
    { qty: 50, perUnit: 20 },
    { qty: 100, perUnit: 14 },
    { qty: 500, perUnit: 7 },
    { qty: 1000, perUnit: 5 },
    { qty: 5000, perUnit: 3.5 },
  ],
  getHidden: (sel) => (sel.format !== 'custom' ? ['customW', 'customH'] : []),
};

export const certificates: CalcConfig = {
  serviceId: 'certificates',
  preview: 'sheet',
  defaultQty: 50,
  productionDays: 2,
  // Express: ≤ 50 шт. (ТЗ п.1.5).
  express: { coeff: 1.5, days: 1, label: '1 день', maxQty: 50 },
  groups: [
    {
      id: 'format',
      label: 'Формат',
      type: 'segmented',
      default: 'A4',
      options: [
        { id: 'A4', label: 'A4' },
        { id: 'A5', label: 'A5', coeff: 0.7 },
        { id: 'custom', label: 'Свой размер', coeff: 1.2 },
      ],
    },
    { id: 'customW', label: 'Ширина', type: 'dimension', default: 210, min: 100, max: 300, step: 1, unit: 'мм' },
    { id: 'customH', label: 'Высота', type: 'dimension', default: 297, min: 100, max: 300, step: 1, unit: 'мм' },
    {
      id: 'paper',
      label: 'Бумага',
      type: 'swatch',
      default: 'design-200',
      options: [
        { id: 'design-200', label: 'Дизайнерская 200 г', swatch: { kind: 'paper', color: '#efe7d6' } },
        {
          id: 'coated-300',
          label: 'Мелованная 300 г',
          coeff: 0.9,
          swatch: { kind: 'paper', color: PAPER.cream },
        },
        {
          id: 'offset-160',
          label: 'Офсетная 160 г',
          coeff: 0.8,
          swatch: { kind: 'paper', color: PAPER.bright },
        },
      ],
    },
    // Цветность 4+0 / 1+0 (ТЗ п.1.5).
    {
      id: 'color',
      label: 'Цветность',
      type: 'segmented',
      default: '4+0',
      options: [
        { id: '4+0', label: 'Цветная (4+0)' },
        { id: '1+0', label: 'Ч/б (1+0)', coeff: 0.6 },
      ],
    },
    // Покрытие (ТЗ п.1.5).
    {
      id: 'coating',
      label: 'Покрытие',
      type: 'swatch',
      default: 'none',
      options: [
        { id: 'none', label: 'Без', swatch: { kind: 'lam', sheen: 'none', color: '#efe7d6' } },
        {
          id: 'matte-lam',
          label: 'Матовая',
          coeff: 1.1,
          swatch: { kind: 'lam', sheen: 'matte', color: '#efe7d6' },
        },
        {
          id: 'gloss-lam',
          label: 'Глянцевая',
          coeff: 1.1,
          swatch: { kind: 'lam', sheen: 'gloss', color: '#efe7d6' },
        },
        {
          id: 'uv-gloss',
          label: 'UV-лак',
          coeff: 1.2,
          swatch: { kind: 'lam', sheen: 'gloss', color: '#f2ecdd' },
        },
      ],
    },
    // Тиснение / голография +20% (ТЗ п.1.5).
    {
      id: 'emboss',
      label: 'Тиснение / голография',
      type: 'swatch',
      default: 'none',
      options: [
        { id: 'none', label: 'Без', swatch: { kind: 'lam', sheen: 'none', color: '#efe7d6' } },
        {
          id: 'gold',
          label: 'Золото',
          coeff: 1.2,
          swatch: { kind: 'foil', color: 'linear-gradient(135deg,#f7d774,#b8860b)' },
        },
        {
          id: 'silver',
          label: 'Серебро',
          coeff: 1.2,
          swatch: { kind: 'foil', color: 'linear-gradient(135deg,#e8e8e8,#9a9a9a)' },
        },
        {
          id: 'holographic',
          label: 'Голография',
          coeff: 1.2,
          swatch: { kind: 'foil', color: 'linear-gradient(135deg,#ff9be6,#9bdcff,#b6ff9b)' },
        },
      ],
    },
  ],
  // Тираж 10–5 000 (ТЗ п.1.5).
  qtyTiers: [
    { qty: 10, perUnit: 80 },
    { qty: 50, perUnit: 45 },
    { qty: 100, perUnit: 32 },
    { qty: 500, perUnit: 22 },
    { qty: 1000, perUnit: 16 },
    { qty: 5000, perUnit: 12 },
  ],
  upsells: [
    { id: 'frame-simple', label: 'Рамка деревянная', perUnitAdd: 350 },
    { id: 'design', label: 'Разработка дизайна', add: 800 },
  ],
  getHidden: (sel) => (sel.format !== 'custom' ? ['customW', 'customH'] : []),
};

export const menu: CalcConfig = {
  serviceId: 'menu',
  preview: 'sheet',
  defaultQty: 50,
  productionDays: 4,
  // Express: 2 дня, ≤ 25 шт., +40% (ТЗ п.1.7).
  express: { coeff: 1.4, days: 2, label: '2 дня', maxQty: 25 },
  groups: [
    {
      id: 'type',
      label: 'Тип',
      type: 'segmented',
      default: 'card',
      options: [
        { id: 'card', label: 'Карта' },
        { id: 'booklet', label: 'Буклет', coeff: 1.6 },
        { id: 'folder', label: 'Папка', coeff: 2 },
      ],
    },
    {
      id: 'format',
      label: 'Формат',
      type: 'segmented',
      default: 'A4',
      options: [
        { id: 'A4', label: 'A4' },
        { id: 'A5', label: 'A5', coeff: 0.7 },
        { id: 'custom', label: 'Свой размер', coeff: 1.2 },
      ],
    },
    { id: 'customW', label: 'Ширина', type: 'dimension', default: 210, min: 100, max: 320, step: 1, unit: 'мм' },
    { id: 'customH', label: 'Высота', type: 'dimension', default: 297, min: 100, max: 450, step: 1, unit: 'мм' },
    // Кол-во страниц — для буклета, 8–64 с шагом 4 (ТЗ п.1.7).
    {
      id: 'pages',
      label: 'Кол-во страниц',
      type: 'segmented',
      default: '8',
      options: [
        { id: '8', label: '8' },
        { id: '12', label: '12', coeff: 1.3 },
        { id: '16', label: '16', coeff: 1.6 },
        { id: '24', label: '24', coeff: 2.1 },
        { id: '32', label: '32', coeff: 2.6 },
        { id: '48', label: '48', coeff: 3.4 },
        { id: '64', label: '64', coeff: 4.2 },
      ],
    },
    // Переплёт — для буклета (ТЗ п.1.7).
    {
      id: 'binding',
      label: 'Переплёт',
      type: 'segmented',
      default: 'staple',
      options: [
        { id: 'staple', label: 'Скрепка' },
        { id: 'wire', label: 'Пружина', coeff: 1.2 },
        { id: 'soft-cover', label: 'Мягкий переплёт', coeff: 1.5 },
      ],
    },
    {
      id: 'paper',
      label: 'Бумага блока',
      type: 'swatch',
      default: 'coated-200',
      options: [
        {
          id: 'coated-115',
          label: 'Мелованная 115 г',
          coeff: 0.85,
          swatch: { kind: 'paper', color: PAPER.light },
        },
        { id: 'coated-200', label: 'Мелованная 200 г', swatch: { kind: 'paper', color: PAPER.cream } },
      ],
    },
    {
      id: 'coating',
      label: 'Покрытие',
      type: 'swatch',
      default: 'soft-touch',
      options: [
        { id: 'none', label: 'Без', swatch: { kind: 'lam', sheen: 'none', color: PAPER.cream } },
        { id: 'matte-lam', label: 'Матовая', swatch: { kind: 'lam', sheen: 'matte', color: PAPER.cream } },
        { id: 'gloss-lam', label: 'Глянцевая', swatch: { kind: 'lam', sheen: 'gloss', color: PAPER.cream } },
        {
          id: 'soft-touch',
          label: 'Soft Touch',
          coeff: 1.2,
          swatch: { kind: 'lam', sheen: 'soft', color: PAPER.cream },
        },
      ],
    },
  ],
  // Тираж 10–1 000 (ТЗ п.1.7).
  qtyTiers: [
    { qty: 10, perUnit: 180 },
    { qty: 50, perUnit: 90 },
    { qty: 100, perUnit: 65 },
    { qty: 500, perUnit: 45 },
    { qty: 1000, perUnit: 35 },
  ],
  getHidden: (sel) => {
    const hidden: string[] = [];
    if (sel.type !== 'booklet') hidden.push('pages', 'binding');
    if (sel.format !== 'custom') hidden.push('customW', 'customH');
    return hidden;
  },
};
