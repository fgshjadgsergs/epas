import type { CalcConfig } from '../types';

/**
 * Печать баннеров (service_id: banner-print) — PRESENTATION-слой.
 *
 * Источник истины по параметрам, вариантам, дефолтам, границам, формулам
 * (площадь/периметр/люверсы/подшив) и ценам — backend definition
 * (prisma/demo/banner-demo.ts, GET /services/bannery/calculator).
 * Здесь остаются данные отображения: превью, свотчи материалов, пресеты
 * размеров для быстрого выбора и скелет на время загрузки definition.
 * pricePerSqm — только dev-фолбэк без backend.
 */
export const banner: CalcConfig = {
  serviceId: 'banner-print',
  preview: 'banner',
  pricing: 'area',
  defaultQty: 1,
  pricePerSqm: 450,
  productionDays: 2,
  // Бейдж срочности — подпись; наценку и срок определяет backend.
  express: { coeff: 1.25, days: 1, label: '1 день' },
  qtyRange: { min: 1, max: 10, step: 1 },
  // Пресеты размеров — быстрый выбор ширины×высоты (presentation).
  sizePresets: [
    { label: '1×1 м', w: 1, h: 1 },
    { label: '2×1 м', w: 2, h: 1 },
    { label: '3×2 м', w: 3, h: 2 },
    { label: '4×3 м', w: 4, h: 3 },
    { label: '5×1 м (перетяжка)', w: 5, h: 1 },
  ],
  groups: [
    // urlKey w/h — как в definition и примерах ТЗ URL (/bannery/?w=2&h=1).
    { id: 'w', label: 'Ширина', type: 'dimension', default: 2, min: 0.5, max: 5, step: 0.05, unit: 'м' },
    { id: 'h', label: 'Высота', type: 'dimension', default: 1, min: 0.5, max: 5, step: 0.05, unit: 'м' },
    {
      id: 'material',
      label: 'Материал',
      type: 'swatch',
      default: 'banner-440',
      options: [
        { id: 'banner-440', label: 'Баннер 440 г', swatch: { kind: 'paper', color: '#e9e9e6' } },
        { id: 'banner-510', label: 'Баннер 510 г', badge: 'плотный', swatch: { kind: 'paper', color: '#e2e2dd' } },
        { id: 'satin', label: 'Сатин (ткань)', swatch: { kind: 'lam', sheen: 'soft', color: '#f0efe9' } },
        { id: 'mesh', label: 'Сетка (mesh)', swatch: { kind: 'paper', color: '#dcdcd6' } },
        { id: 'pvc-self-adhesive', label: 'ПВХ самоклейка', swatch: { kind: 'paper', color: '#ededf0' } },
      ],
    },
    {
      id: 'lugs',
      label: 'Люверсы',
      type: 'segmented',
      default: 'with',
      options: [
        { id: 'with', label: 'Каждые 50 см' },
        { id: 'custom', label: 'Свой шаг' },
        { id: 'none', label: 'Без люверсов' },
      ],
    },
    { id: 'lugstep', label: 'Шаг люверсов', type: 'dimension', default: 50, min: 20, max: 100, step: 5, unit: 'см' },
    {
      id: 'hem',
      label: 'Обшивка кромок',
      type: 'segmented',
      default: 'none',
      options: [
        { id: 'none', label: 'Без обшивки' },
        { id: 'basic', label: 'Обычная' },
        { id: 'thick', label: 'Усиленная' },
      ],
    },
  ],
};
