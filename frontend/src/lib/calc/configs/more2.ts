import type { CalcConfig } from '../types';

/** Дочистка охвата: переплёт, календари, широкоформат, сувениры, фотокниги-расчёт. */

const PAPER = { light: '#f6f5f0', cream: '#f2efe7', warm: '#ece6da', bright: '#fafafa' };

/* ---------- Брошюровка (service_id: binding-staple). ТЗ п.2.3 ---------- */
export const binding: CalcConfig = {
  serviceId: 'binding-staple',
  preview: 'generic',
  defaultQty: 1,
  productionDays: 0,
  qtyLabel: 'Экземпляров',
  // Express: 2 часа, +30% (ТЗ п.2.3).
  express: { coeff: 1.3, days: 0, label: '2 часа' },
  groups: [
    {
      id: 'type',
      label: 'Тип переплёта',
      type: 'segmented',
      default: 'spiral-plastic',
      options: [
        { id: 'staple', label: 'Скрепка', coeff: 0.6, note: '4–48 стр.' },
        { id: 'spiral-plastic', label: 'Пластик. пружина', note: '8–400 стр.' },
        { id: 'spiral-metal', label: 'Метал. пружина', coeff: 1.2, note: '8–400 стр.' },
        { id: 'thermo', label: 'Термопереплёт', coeff: 1.4, note: '40–800 стр.' },
      ],
    },
    {
      id: 'format',
      label: 'Формат',
      type: 'segmented',
      default: 'A4',
      options: [
        { id: 'A4', label: 'A4' },
        { id: 'A5', label: 'A5', coeff: 0.8 },
        { id: 'A3', label: 'A3', coeff: 1.6 },
      ],
    },
    // Кол-во страниц — по ограничениям типа (ТЗ п.2.3).
    {
      id: 'pages',
      label: 'Кол-во страниц',
      type: 'segmented',
      default: '50-150',
      options: [
        { id: '<48', label: 'до 48', coeff: 0.7 },
        { id: '50-150', label: '50–150' },
        { id: '150-400', label: '150–400', coeff: 2 },
        { id: '400-800', label: '400–800', coeff: 3.2 },
      ],
    },
    // Обложка: none / transparent / cardboard / printed (ТЗ п.2.3).
    {
      id: 'cover',
      label: 'Обложка',
      type: 'segmented',
      default: 'transparent',
      options: [
        { id: 'none', label: 'Без', coeff: 0.9 },
        { id: 'transparent', label: 'Прозрачная' },
        { id: 'cardboard', label: 'Картон', coeff: 1.05 },
        { id: 'printed', label: 'С печатью', add: 150 },
      ],
    },
  ],
  qtyTiers: [
    { qty: 1, perUnit: 150 },
    { qty: 5, perUnit: 130 },
    { qty: 10, perUnit: 110 },
    { qty: 30, perUnit: 90 },
  ],
  // Ограничения страниц по типу: скрепка ≤ 48, термо от 40 (ТЗ п.2.3).
  getDisabled: (sel) => {
    if (sel.type === 'staple') return { pages: ['50-150', '150-400', '400-800'] };
    if (sel.type === 'thermo') return { pages: [] };
    return { pages: ['400-800'] }; // пружины: 8–400 стр.
  },
};

/* ---------- Твёрдый переплёт и дипломные работы (ТЗ п.2.4) ---------- */
export const hardcoverBinding: CalcConfig = {
  serviceId: 'hard-cover-binding',
  preview: 'generic',
  defaultQty: 1,
  productionDays: 2,
  qtyLabel: 'Экземпляров',
  groups: [
    {
      id: 'type',
      label: 'Тип работы',
      type: 'segmented',
      default: 'diploma',
      options: [
        { id: 'diploma', label: 'Диплом' },
        { id: 'thesis', label: 'Диссертация', coeff: 1.15 },
        { id: 'report', label: 'Отчёт', coeff: 0.95 },
        { id: 'book', label: 'Книга', coeff: 1.1 },
      ],
    },
    {
      id: 'format',
      label: 'Формат',
      type: 'segmented',
      default: 'A4',
      options: [
        { id: 'A4', label: 'A4' },
        { id: 'A5', label: 'A5', coeff: 0.85 },
      ],
    },
    // Кол-во страниц 20–800 (ТЗ п.2.4).
    {
      id: 'pages',
      label: 'Кол-во страниц',
      type: 'segmented',
      default: '100-200',
      options: [
        { id: '20-100', label: '20–100', coeff: 0.8 },
        { id: '100-200', label: '100–200' },
        { id: '200-400', label: '200–400', coeff: 1.4 },
        { id: '400-800', label: '400–800', coeff: 2 },
      ],
    },
    // Обложка (ТЗ п.2.4): стандартные цвета / printed +200 / кожзам +300.
    {
      id: 'cover',
      label: 'Обложка',
      type: 'swatch',
      default: 'standard-blue',
      options: [
        { id: 'standard-black', label: 'Чёрная', swatch: { kind: 'ink', color: '#1c1c1e' } },
        { id: 'standard-blue', label: 'Синяя', swatch: { kind: 'ink', color: '#1e3a6e' } },
        { id: 'standard-red', label: 'Бордовая', swatch: { kind: 'ink', color: '#7a1f2b' } },
        { id: 'printed', label: 'С печатью', add: 200, swatch: { kind: 'paper', color: PAPER.bright } },
        { id: 'leatherette', label: 'Кожзам', add: 300, swatch: { kind: 'paper', color: '#4a3b2f' } },
      ],
    },
    // Тиснение (ТЗ п.2.4).
    {
      id: 'emboss',
      label: 'Тиснение',
      type: 'swatch',
      default: 'gold-foil',
      options: [
        { id: 'none', label: 'Без', swatch: { kind: 'lam', sheen: 'none', color: '#3b4252' } },
        {
          id: 'gold-foil',
          label: 'Золото',
          coeff: 1.1,
          swatch: { kind: 'foil', color: 'linear-gradient(135deg,#f7d774,#b8860b)' },
        },
        {
          id: 'silver-foil',
          label: 'Серебро',
          coeff: 1.1,
          swatch: { kind: 'foil', color: 'linear-gradient(135deg,#e8e8e8,#9a9a9a)' },
        },
      ],
    },
    // Печать блока — опция; добавляет цветность и бумагу (ТЗ п.2.4).
    {
      id: 'printBlock',
      label: 'Печать блока',
      type: 'segmented',
      default: 'no',
      options: [
        { id: 'no', label: 'Только переплёт' },
        { id: 'yes', label: 'С печатью блока', coeff: 1.8 },
      ],
    },
    {
      id: 'blockColor',
      label: 'Цветность блока',
      type: 'segmented',
      default: 'bw',
      options: [
        { id: 'bw', label: 'Чёрно-белая' },
        { id: 'color', label: 'Цветная', coeff: 1.6 },
      ],
    },
    {
      id: 'blockPaper',
      label: 'Бумага блока',
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
      ],
    },
    // Срочность: standard / 4 ч (+50%) / 1 ч (+100%) — ТЗ п.2.4.
    {
      id: 'urgency',
      label: 'Срочность',
      type: 'segmented',
      default: 'standard',
      options: [
        { id: 'standard', label: 'Стандарт (1–2 дня)' },
        { id: 'express', label: 'За 4 часа', coeff: 1.5, daysOverride: 0 },
        { id: 'superexpress', label: 'За 1 час', coeff: 2, daysOverride: 0 },
      ],
    },
  ],
  qtyTiers: [
    { qty: 1, perUnit: 600 },
    { qty: 3, perUnit: 540 },
    { qty: 5, perUnit: 490 },
    { qty: 10, perUnit: 440 },
  ],
  getHidden: (sel) => (sel.printBlock !== 'yes' ? ['blockColor', 'blockPaper'] : []),
};

/* ---------- Календари (настольные, фото, планинги) ---------- */
export const calendarDesk: CalcConfig = {
  serviceId: 'calendar-desk',
  preview: 'card',
  defaultQty: 50,
  productionDays: 3,
  groups: [
    {
      id: 'format',
      label: 'Формат',
      type: 'segmented',
      default: 'A5',
      options: [
        { id: 'A6', label: 'A6', coeff: 0.8 },
        { id: 'A5', label: 'A5' },
        { id: 'A4', label: 'A4', coeff: 1.4 },
      ],
    },
    {
      id: 'sheets',
      label: 'Листов',
      type: 'segmented',
      default: '12+1',
      options: [
        { id: '12+1', label: '12+1' },
        { id: '6+1', label: '6+1', coeff: 0.6 },
      ],
    },
    // Скрепление (ТЗ п.6.2).
    {
      id: 'binding',
      label: 'Скрепление',
      type: 'segmented',
      default: 'spiral-metal',
      options: [
        { id: 'spiral-metal', label: 'Метал. пружина' },
        { id: 'spiral-plastic', label: 'Пластик. пружина', coeff: 0.9 },
      ],
    },
    {
      id: 'stand',
      label: 'Подставка',
      type: 'segmented',
      default: 'cardboard',
      options: [
        { id: 'cardboard', label: 'Картон' },
        { id: 'plastic', label: 'Пластик', perUnitAdd: 20 },
      ],
    },
    // Бумага (ТЗ п.6.2).
    {
      id: 'paper',
      label: 'Бумага',
      type: 'swatch',
      default: 'coated-150',
      options: [
        { id: 'coated-150', label: 'Мелованная 150 г', swatch: { kind: 'paper', color: PAPER.light } },
        {
          id: 'coated-200',
          label: 'Мелованная 200 г',
          coeff: 1.15,
          swatch: { kind: 'paper', color: PAPER.cream },
        },
      ],
    },
  ],
  // Тираж 10–1 000 (ТЗ п.6.2).
  qtyTiers: [
    { qty: 10, perUnit: 250 },
    { qty: 50, perUnit: 160 },
    { qty: 100, perUnit: 120 },
    { qty: 500, perUnit: 90 },
    { qty: 1000, perUnit: 75 },
  ],
};

export const photoCalendar: CalcConfig = {
  serviceId: 'photo-calendar',
  preview: 'sheet',
  defaultQty: 10,
  productionDays: 3,
  groups: [
    {
      id: 'type',
      label: 'Тип',
      type: 'segmented',
      default: 'wall',
      options: [
        { id: 'wall', label: 'Настенный' },
        { id: 'desk', label: 'Настольный', coeff: 0.8 },
        { id: 'pocket', label: 'Карманный', coeff: 0.4 },
      ],
    },
    {
      id: 'format',
      label: 'Формат',
      type: 'segmented',
      default: 'A3',
      options: [
        { id: 'A4', label: 'A4', coeff: 0.7 },
        { id: 'A3', label: 'A3' },
        { id: 'A2', label: 'A2', coeff: 1.6 },
      ],
    },
  ],
  qtyTiers: [
    { qty: 1, perUnit: 450 },
    { qty: 10, perUnit: 300 },
    { qty: 50, perUnit: 220 },
    { qty: 100, perUnit: 170 },
  ],
};

export const planner: CalcConfig = {
  serviceId: 'planner',
  preview: 'sheet',
  defaultQty: 50,
  productionDays: 4,
  groups: [
    {
      id: 'format',
      label: 'Формат',
      type: 'segmented',
      default: 'A3',
      options: [
        { id: 'A4', label: 'A4', coeff: 0.7 },
        { id: 'A3', label: 'A3' },
        { id: 'A2', label: 'A2', coeff: 1.6 },
      ],
    },
    {
      id: 'paper',
      label: 'Бумага',
      type: 'swatch',
      default: 'offset-100',
      options: [
        { id: 'offset-100', label: 'Офсет 100 г', swatch: { kind: 'paper', color: PAPER.bright } },
        {
          id: 'coated-150',
          label: 'Мелованная 150 г',
          coeff: 1.15,
          swatch: { kind: 'paper', color: PAPER.cream },
        },
      ],
    },
  ],
  qtyTiers: [
    { qty: 10, perUnit: 280 },
    { qty: 50, perUnit: 180 },
    { qty: 100, perUnit: 140 },
    { qty: 500, perUnit: 100 },
  ],
};

/* ---------- Широкоформат (roll-up, интерьерная) ---------- */
export const rollup: CalcConfig = {
  serviceId: 'rollup',
  preview: 'generic',
  defaultQty: 1,
  productionDays: 3,
  // Express: 1 день, +40% (ТЗ п.4.2).
  express: { coeff: 1.4, days: 1, label: '1 день' },
  groups: [
    {
      id: 'width',
      label: 'Ширина стенда',
      type: 'segmented',
      default: '80',
      options: [
        { id: '60', label: '60 см', coeff: 0.85 },
        { id: '80', label: '80 см' },
        { id: '100', label: '100 см', coeff: 1.15 },
        { id: '120', label: '120 см', coeff: 1.3 },
        { id: '150', label: '150 см', coeff: 1.6 },
      ],
    },
    // Высота полотна 200/220 см (ТЗ п.4.2).
    {
      id: 'height',
      label: 'Высота полотна',
      type: 'segmented',
      default: '200',
      options: [
        { id: '200', label: '200 см' },
        { id: '220', label: '220 см', coeff: 1.1 },
      ],
    },
    {
      id: 'complect',
      label: 'Комплектация',
      type: 'segmented',
      default: 'with-stand',
      options: [
        { id: 'print-only', label: 'Только полотно', coeff: 0.6 },
        { id: 'with-stand', label: 'С механизмом' },
        { id: 'with-bag', label: '+ сумка', coeff: 1.12 },
        { id: 'premium', label: 'Premium', coeff: 1.4 },
      ],
    },
  ],
  qtyTiers: [
    { qty: 1, perUnit: 2500 },
    { qty: 3, perUnit: 2300 },
    { qty: 5, perUnit: 2100 },
  ],
};

/** Press Wall / Фотостена (service_id: presswall). ТЗ п.4.3 — расчёт по площади. */
export const presswall: CalcConfig = {
  serviceId: 'presswall',
  preview: 'banner',
  pricing: 'area',
  pricePerSqm: 650,
  defaultQty: 1,
  productionDays: 3,
  qtyRange: { min: 1, max: 10, step: 1 },
  sizePresets: [
    { label: '2×2 м', w: 2, h: 2 },
    { label: '3×2 м', w: 3, h: 2 },
    { label: '4×2.5 м', w: 4, h: 2.5 },
    { label: '6×3 м', w: 6, h: 3 },
  ],
  groups: [
    // Ширина 1–6 м, высота 1–3 м, шаг 0.5 м (ТЗ п.4.3).
    { id: 'width', label: 'Ширина', type: 'dimension', default: 3, min: 1, max: 6, step: 0.5, unit: 'м' },
    { id: 'height', label: 'Высота', type: 'dimension', default: 2, min: 1, max: 3, step: 0.5, unit: 'м' },
    {
      id: 'material',
      label: 'Материал',
      type: 'swatch',
      default: 'banner-440',
      options: [
        { id: 'banner-440', label: 'Баннер 440 г', swatch: { kind: 'paper', color: '#e9e9e6' } },
        {
          id: 'satin',
          label: 'Сатин (ткань)',
          coeff: 1.35,
          swatch: { kind: 'lam', sheen: 'soft', color: '#f0efe9' },
        },
      ],
    },
    // Конструкция: только печать / с каркасом / каркас + сумка (ТЗ п.4.3).
    {
      id: 'construction',
      label: 'Конструкция',
      type: 'segmented',
      default: 'with-frame',
      options: [
        { id: 'print-only', label: 'Только полотно', coeff: 0.55 },
        { id: 'with-frame', label: 'С каркасом' },
        { id: 'with-frame-bag', label: 'Каркас + сумка', coeff: 1.12 },
      ],
    },
  ],
};

export const interiorPrint: CalcConfig = {
  serviceId: 'interior-print',
  preview: 'banner',
  pricing: 'area',
  pricePerSqm: 900,
  defaultQty: 1,
  productionDays: 2,
  // Express: 1 день, +30% (ТЗ п.4.4).
  express: { coeff: 1.3, days: 1, label: '1 день' },
  qtyRange: { min: 1, max: 10, step: 1 },
  groups: [
    // Мин. 20×20 см, макс. 300×300 см (ТЗ п.4.4).
    { id: 'width', label: 'Ширина', type: 'dimension', default: 1, min: 0.2, max: 3, step: 0.1, unit: 'м' },
    { id: 'height', label: 'Высота', type: 'dimension', default: 1, min: 0.2, max: 3, step: 0.1, unit: 'м' },
    {
      // Материалы по ТЗ п.4.4.
      id: 'material',
      label: 'Материал',
      type: 'swatch',
      default: 'self-adhesive-matte',
      options: [
        { id: 'self-adhesive-matte', label: 'Плёнка матовая', swatch: { kind: 'paper', color: PAPER.light } },
        {
          id: 'self-adhesive-gloss',
          label: 'Плёнка глянец',
          coeff: 1.05,
          swatch: { kind: 'lam', sheen: 'gloss', color: PAPER.light },
        },
        {
          id: 'self-adhesive-wall',
          label: 'Фотообои',
          coeff: 1.2,
          swatch: { kind: 'paper', color: PAPER.warm },
        },
        { id: 'canvas', label: 'Холст', coeff: 1.4, swatch: { kind: 'paper', color: PAPER.cream } },
        {
          id: 'backlit-film',
          label: 'Backlit (на просвет)',
          coeff: 1.5,
          swatch: { kind: 'paper', color: '#fff7e0' },
        },
      ],
    },
    {
      id: 'lamination',
      label: 'Ламинация',
      type: 'segmented',
      default: 'none',
      options: [
        { id: 'none', label: 'Без' },
        { id: 'matte-lam', label: 'Матовая', coeff: 1.15 },
        { id: 'gloss-lam', label: 'Глянцевая', coeff: 1.15 },
      ],
    },
  ],
};

/* ---------- Сувениры (ланъярды) ---------- */
export const lanyards: CalcConfig = {
  serviceId: 'lanyards',
  preview: 'generic',
  defaultQty: 50,
  productionDays: 5,
  groups: [
    {
      id: 'width',
      label: 'Ширина, мм',
      type: 'segmented',
      default: '15',
      options: [
        { id: '10', label: '10', coeff: 0.85 },
        { id: '15', label: '15' },
        { id: '20', label: '20', coeff: 1.2 },
        { id: '25', label: '25', coeff: 1.35 },
      ],
    },
    {
      id: 'attachment',
      label: 'Карабин',
      type: 'segmented',
      default: 'carabine',
      options: [
        { id: 'carabine', label: 'Карабин' },
        { id: 'hook', label: 'Крючок', coeff: 0.95 },
        { id: 'safety', label: 'С отстёжкой', coeff: 1.1 },
      ],
    },
  ],
  qtyTiers: [
    { qty: 10, perUnit: 180 },
    { qty: 50, perUnit: 120 },
    { qty: 100, perUnit: 90 },
    { qty: 500, perUnit: 65 },
  ],
};

/* ---------- Бирки, бейджи, бланки (service_id: badges-blanks). ТЗ п.1.6 ---------- */
export const badges: CalcConfig = {
  serviceId: 'badges-blanks',
  preview: 'card',
  defaultQty: 50,
  productionDays: 3,
  groups: [
    {
      id: 'subtype',
      label: 'Подтип',
      type: 'segmented',
      default: 'badges',
      options: [
        { id: 'tags', label: 'Бирки' },
        { id: 'badges', label: 'Бейджи', coeff: 1.2 },
        { id: 'blanks', label: 'Бланки', coeff: 0.7 },
      ],
    },
    /* --- Бирки (ТЗ п.1.6, подтип tags) --- */
    {
      id: 'tagFormat',
      label: 'Формат',
      type: 'segmented',
      default: '50x90',
      options: [
        { id: '50x90', label: '50×90' },
        { id: '55x85', label: '55×85' },
        { id: '40x70', label: '40×70', coeff: 0.85 },
        { id: 'custom', label: 'Свой размер', coeff: 1.2 },
      ],
    },
    {
      id: 'tagPaper',
      label: 'Бумага',
      type: 'swatch',
      default: 'coated-300',
      options: [
        { id: 'coated-300', label: 'Мелованная 300 г', swatch: { kind: 'paper', color: PAPER.cream } },
        { id: 'design-200', label: 'Дизайнерская 200 г', coeff: 1.3, swatch: { kind: 'paper', color: '#efe7d6' } },
        { id: 'kraft', label: 'Крафт', coeff: 1.1, swatch: { kind: 'paper', color: '#cbb893' } },
      ],
    },
    {
      id: 'tagFix',
      label: 'Крепление',
      type: 'segmented',
      default: 'none',
      options: [
        { id: 'none', label: 'Без' },
        { id: 'hole', label: 'Отверстие' },
        { id: 'hole-ribbon', label: 'Отверстие + лента', perUnitAdd: 5 },
      ],
    },
    {
      id: 'tagColor',
      label: 'Цветность',
      type: 'segmented',
      default: '4+0',
      options: [
        { id: '4+0', label: '4+0' },
        { id: '4+4', label: '4+4', coeff: 1.4 },
        { id: '1+0', label: '1+0', coeff: 0.6 },
      ],
    },
    /* --- Бейджи (ТЗ п.1.6, подтип badges) --- */
    {
      id: 'badgeMaterial',
      label: 'Материал',
      type: 'swatch',
      default: 'plastic-pvc',
      options: [
        {
          id: 'rigid-paper',
          label: 'Плотная бумага',
          coeff: 0.8,
          swatch: { kind: 'paper', color: PAPER.cream },
        },
        { id: 'plastic-pvc', label: 'Пластик PVC', swatch: { kind: 'paper', color: '#eef0f2' } },
        { id: 'soft-pvc', label: 'Мягкий PVC', coeff: 1.2, swatch: { kind: 'paper', color: '#e6eaee' } },
      ],
    },
    {
      id: 'badgeFormat',
      label: 'Формат',
      type: 'segmented',
      default: '90x60',
      options: [
        { id: '90x60', label: '90×60' },
        { id: '85x55', label: '85×55', coeff: 0.95 },
        { id: '105x70', label: '105×70', coeff: 1.2 },
        { id: 'custom', label: 'Свой размер', coeff: 1.25 },
      ],
    },
    {
      id: 'badgeFill',
      label: 'Наполнение',
      type: 'segmented',
      default: 'print-only',
      options: [
        { id: 'print-only', label: 'Только печать' },
        { id: 'with-holder', label: 'С держателем', perUnitAdd: 15 },
        { id: 'with-clip', label: 'С клипсой', perUnitAdd: 20 },
      ],
    },
    /* --- Бланки (ТЗ п.1.6, подтип blanks) --- */
    {
      id: 'blankFormat',
      label: 'Формат',
      type: 'segmented',
      default: 'A4',
      options: [
        { id: 'A4', label: 'A4' },
        { id: 'A5', label: 'A5', coeff: 0.7 },
        { id: 'A6', label: 'A6', coeff: 0.5 },
      ],
    },
    {
      id: 'blankPaper',
      label: 'Бумага',
      type: 'swatch',
      default: 'offset-80',
      options: [
        { id: 'offset-80', label: 'Офсет 80 г', swatch: { kind: 'paper', color: PAPER.bright } },
        { id: 'offset-120', label: 'Офсет 120 г', coeff: 1.2, swatch: { kind: 'paper', color: PAPER.light } },
        {
          id: 'coated-150',
          label: 'Мелованная 150 г',
          coeff: 1.35,
          swatch: { kind: 'paper', color: PAPER.cream },
        },
      ],
    },
    {
      id: 'blankColor',
      label: 'Цветность',
      type: 'segmented',
      default: '4+0',
      options: [
        { id: '4+0', label: '4+0' },
        { id: '1+0', label: '1+0', coeff: 0.5 },
      ],
    },
    {
      id: 'blankNumbering',
      label: 'Нумерация',
      type: 'segmented',
      default: 'no',
      options: [
        { id: 'no', label: 'Без нумерации' },
        { id: 'yes', label: 'С нумерацией', perUnitAdd: 5 },
      ],
    },
  ],
  qtyTiers: [
    { qty: 10, perUnit: 90 },
    { qty: 50, perUnit: 55 },
    { qty: 100, perUnit: 40 },
    { qty: 500, perUnit: 28 },
    { qty: 1000, perUnit: 20 },
    { qty: 5000, perUnit: 14 },
    { qty: 10000, perUnit: 10 },
    { qty: 50000, perUnit: 8 },
  ],
  // Каждому подтипу — свой набор параметров (ТЗ п.1.6).
  getHidden: (sel) => {
    const tags = ['tagFormat', 'tagPaper', 'tagFix', 'tagColor'];
    const badgesG = ['badgeMaterial', 'badgeFormat', 'badgeFill'];
    const blanks = ['blankFormat', 'blankPaper', 'blankColor', 'blankNumbering'];
    if (sel.subtype === 'tags') return [...badgesG, ...blanks];
    if (sel.subtype === 'badges') return [...tags, ...blanks];
    return [...tags, ...badgesG];
  },
  // Мин. тираж: бирки 50, бейджи 10, бланки 100 (ТЗ п.1.6).
  getMinQty: (sel) => (sel.subtype === 'tags' ? 50 : sel.subtype === 'badges' ? 10 : 100),
};

/* ---------- Пломбираторы ---------- */
export const plombir: CalcConfig = {
  serviceId: 'plombir',
  preview: 'generic',
  defaultQty: 1,
  productionDays: 2,
  groups: [
    {
      id: 'type',
      label: 'Тип',
      type: 'segmented',
      default: 'standard',
      options: [
        { id: 'standard', label: 'Стандартный' },
        { id: 'custom', label: 'По эскизу', coeff: 1.4 },
      ],
    },
  ],
  qtyTiers: [
    { qty: 1, perUnit: 1200 },
    { qty: 3, perUnit: 1050 },
    { qty: 5, perUnit: 950 },
  ],
};

/* ---------- Фотокниги (расчёт; редактор — фаза 4). ТЗ п.3.2 ---------- */
export const photobook: CalcConfig = {
  serviceId: 'photobook',
  preview: 'generic',
  defaultQty: 1,
  productionDays: 5,
  qtyLabel: 'Экземпляров',
  // От 2 экз. — скидка 5–10% (ТЗ п.3.2).
  qtyDiscount: [
    { from: 2, coeff: 0.95 },
    { from: 5, coeff: 0.9 },
  ],
  // Express: 2 дня, +50%, ≤ 20 стр. и ≤ 2 экз. (ТЗ п.3.2).
  express: {
    coeff: 1.5,
    days: 2,
    label: '2 дня',
    maxQty: 2,
    available: (sel) => sel.pages === '20',
    hint: 'только для книг до 20 страниц',
  },
  groups: [
    {
      id: 'subtype',
      label: 'Переплёт',
      type: 'segmented',
      default: 'hardcover',
      options: [
        { id: 'layflat', label: 'LayFlat', coeff: 1.3 },
        { id: 'hardcover', label: 'Hardcover' },
        { id: 'softcover', label: 'Softcover', coeff: 0.8 },
      ],
    },
    {
      // Форматы и доступность по подтипу (таблица из ТЗ п.3.2).
      id: 'format',
      label: 'Формат, см',
      type: 'segmented',
      default: '20x20',
      options: [
        { id: '20x15', label: '20×15', coeff: 0.8 },
        { id: '20x20', label: '20×20' },
        { id: '25x20', label: '25×20', coeff: 1.15 },
        { id: '30x20', label: '30×20', coeff: 1.3 },
        { id: '30x30', label: '30×30', coeff: 1.8 },
        { id: '40x20', label: '40×20', badge: 'панорама', coeff: 1.6 },
      ],
    },
    // Обложка — только для hardcover (ТЗ п.3.2).
    {
      id: 'cover',
      label: 'Обложка',
      type: 'swatch',
      default: 'photo-cover',
      options: [
        { id: 'fabric', label: 'Ткань', coeff: 1.1, swatch: { kind: 'paper', color: '#d9d2c5' } },
        { id: 'photo-cover', label: 'Фотообложка', swatch: { kind: 'lam', sheen: 'gloss', color: PAPER.bright } },
        { id: 'leatherette', label: 'Кожзам', add: 300, swatch: { kind: 'paper', color: '#4a3b2f' } },
      ],
    },
    // Тип страниц (ТЗ п.3.2): layflat-pages — только для LayFlat.
    {
      id: 'pagesType',
      label: 'Тип страниц',
      type: 'swatch',
      default: 'coated-170',
      options: [
        { id: 'coated-170', label: 'Мелованная 170 г', swatch: { kind: 'paper', color: PAPER.light } },
        {
          id: 'design-200',
          label: 'Дизайнерская 200 г',
          coeff: 1.2,
          swatch: { kind: 'paper', color: '#efe7d6' },
        },
        {
          id: 'layflat-pages',
          label: 'LayFlat-разворот',
          coeff: 1.3,
          swatch: { kind: 'paper', color: PAPER.warm },
        },
      ],
    },
    // Кол-во страниц: мин. 20, шаг 4; лимиты по подтипу (ТЗ п.3.2).
    {
      id: 'pages',
      label: 'Кол-во страниц',
      type: 'segmented',
      default: '40',
      options: [
        { id: '20', label: '20', coeff: 0.7 },
        { id: '24', label: '24', coeff: 0.78 },
        { id: '32', label: '32', coeff: 0.9 },
        { id: '40', label: '40' },
        { id: '60', label: '60', coeff: 1.35 },
        { id: '80', label: '80', coeff: 1.7 },
        { id: '100', label: '100', coeff: 2 },
        { id: '120', label: '120', coeff: 2.3 },
        { id: '160', label: '160', coeff: 2.9 },
        { id: '200', label: '200', coeff: 3.5 },
      ],
    },
  ],
  qtyTiers: [{ qty: 1, perUnit: 2400 }],
  // Подарочная упаковка +150 ₽ (ТЗ п.3.2).
  upsells: [{ id: 'gift-wrap', label: 'Подарочная упаковка', add: 150 }],
  // Матрица доступности форматов и лимиты страниц по подтипу (ТЗ п.3.2).
  getDisabled: (sel) => {
    const disabled: Record<string, string[]> = {};
    if (sel.subtype === 'layflat') {
      disabled.format = ['20x15'];
      disabled.pages = ['160', '200']; // layflat ≤ 120 стр.
    } else if (sel.subtype === 'hardcover') {
      disabled.format = ['40x20'];
      disabled.pagesType = ['layflat-pages'];
      // hardcover ≤ 200 стр. — все опции доступны.
    } else {
      disabled.format = ['30x30', '40x20'];
      disabled.pagesType = ['layflat-pages'];
      disabled.pages = ['120', '160', '200']; // softcover ≤ 100 стр.
    }
    return disabled;
  },
  getHidden: (sel) => (sel.subtype !== 'hardcover' ? ['cover'] : []),
};
