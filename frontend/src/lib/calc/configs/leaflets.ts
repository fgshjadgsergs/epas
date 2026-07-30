import type { CalcConfig } from '../types';

/**
 * Листовки и флаеры (service_id: leaflets) — PRESENTATION-слой.
 *
 * Источник истины по составу параметров, вариантам, дефолтам, границам,
 * совместимости и ценам — backend definition (см. prisma/demo/leaflets-demo.ts
 * и GET /services/listovki/calculator). Здесь остаются только данные
 * отображения: тип превью, свотчи бумаги/ламинации, подписи слайдера тиража
 * и структура-скелет на время загрузки definition (dev-фолбэк).
 *
 * Бизнес-правила (коэффициенты цен, getDisabled/getHidden, лимиты express)
 * из этого файла удалены — их отдаёт backend.
 */
export const leaflets: CalcConfig = {
  serviceId: 'leaflets',
  preview: 'sheet',
  defaultQty: 500,
  productionDays: 2,
  // Бейдж срочности («1 день, +30%») — подпись; доступность и наценку
  // определяет backend (MAX_QTY-правило и MULTIPLIER в demo-прайсе).
  express: { coeff: 1.3, days: 1, label: '1 день' },
  groups: [
    {
      id: 'format',
      label: 'Формат',
      type: 'segmented',
      default: 'A5',
      options: [
        { id: 'A4', label: 'A4' },
        { id: 'A5', label: 'A5' },
        { id: 'A6', label: 'A6' },
        { id: 'DL', label: 'Евро (DL)' },
        { id: 'custom', label: 'Свой размер' },
      ],
    },
    // Свой размер, мм. urlKey w/h — как в definition (ТЗ §15.16: имена
    // GET-параметров в нижнем регистре; прежние customW/customH не годились).
    { id: 'w', label: 'Ширина', type: 'dimension', default: 148, min: 74, max: 297, step: 1, unit: 'мм' },
    { id: 'h', label: 'Высота', type: 'dimension', default: 210, min: 74, max: 297, step: 1, unit: 'мм' },
    {
      id: 'paper',
      label: 'Бумага',
      type: 'swatch',
      default: 'coated-150',
      options: [
        { id: 'offset-80', label: 'Офсет 80 г', swatch: { kind: 'paper', color: '#f7f6f1' } },
        { id: 'coated-115', label: 'Мелованная 115 г', swatch: { kind: 'paper', color: '#f1efe9' } },
        { id: 'coated-150', label: 'Мелованная 150 г', swatch: { kind: 'paper', color: '#efece4' } },
        { id: 'coated-200', label: 'Мелованная 200 г', swatch: { kind: 'paper', color: '#ebe7dd' } },
      ],
    },
    {
      id: 'color',
      label: 'Цветность',
      type: 'segmented',
      default: '4+4',
      options: [
        { id: '4+4', label: 'Цвет 2 стороны' },
        { id: '4+0', label: 'Цвет 1 сторона' },
        { id: '1+1', label: 'Ч/б 2 стороны' },
        { id: '1+0', label: 'Ч/б 1 сторона' },
      ],
    },
    {
      id: 'coating',
      label: 'Ламинация',
      type: 'swatch',
      default: 'none',
      options: [
        { id: 'none', label: 'Без ламинации', swatch: { kind: 'lam', sheen: 'none' } },
        { id: 'matte-lam', label: 'Матовая', swatch: { kind: 'lam', sheen: 'matte' } },
        { id: 'gloss-lam', label: 'Глянцевая', swatch: { kind: 'lam', sheen: 'gloss' } },
      ],
    },
  ],
  // Остановки слайдера тиража (визуальные пороги; сами цены считает backend).
  qtyTiers: [
    { qty: 100, perUnit: 9 },
    { qty: 500, perUnit: 4.2 },
    { qty: 1000, perUnit: 2.8 },
    { qty: 2000, perUnit: 2.1 },
    { qty: 5000, perUnit: 1.5 },
    { qty: 10000, perUnit: 1.1 },
    { qty: 50000, perUnit: 0.85 },
    { qty: 100000, perUnit: 0.7 },
  ],
  upsells: [
    { id: 'numbering', label: 'Нумерация' },
    { id: 'perforation', label: 'Перфорация' },
    { id: 'design', label: 'Разработка дизайна' },
  ],
};
