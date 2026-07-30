import type { CalcConfig } from '../types';

/**
 * Визитки (service_id: business-cards). Параметры и совместимость — из
 * «ТЗ на калькуляторы», п.1.1. Коэффициенты цен — демонстрационные
 * (на проде расчёт возвращает бэкенд).
 */
export const businessCards: CalcConfig = {
  serviceId: 'business-cards',
  preview: 'card',
  defaultQty: 100,
  productionDays: 2,
  // Express: мин. надбавка 50%, только standard + базовая ламинация, тираж ≤ 1000 (ТЗ п.1.1).
  express: {
    coeff: 1.5,
    days: 0,
    label: 'в день заказа',
    maxQty: 1000,
    available: (sel) =>
      sel.subtype === 'standard' && ['none', 'matte-lam', 'gloss-lam'].includes(String(sel.coating)),
    hint: 'только стандартные визитки с базовой ламинацией',
  },
  groups: [
    {
      id: 'subtype',
      label: 'Тип',
      type: 'segmented',
      default: 'standard',
      options: [
        { id: 'standard', label: 'Стандартные' },
        { id: 'lacquer', label: 'С лакировкой', coeff: 1.25 },
        { id: 'foil', label: 'Тиснение фольгой', coeff: 1.4 },
        { id: 'plastic', label: 'Пластиковые', coeff: 1.8 },
      ],
    },
    {
      id: 'format',
      label: 'Формат',
      type: 'segmented',
      default: '90x50',
      options: [
        { id: '90x50', label: '90×50' },
        { id: '85x55', label: '85×55' },
        { id: '90x90', label: '90×90', coeff: 1.3 },
        { id: '55x55', label: '55×55', coeff: 0.85 },
        { id: 'custom', label: 'Свой размер', coeff: 1.2 },
      ],
    },
    // Свой размер: ввод ширины и высоты в мм, диапазон 30–100 мм (ТЗ п.1.1).
    // url-ключи w/h — как в definition backend и примерах ТЗ URL.
    { id: 'w', label: 'Ширина', type: 'dimension', default: 90, min: 30, max: 100, step: 1, unit: 'мм' },
    { id: 'h', label: 'Высота', type: 'dimension', default: 50, min: 30, max: 100, step: 1, unit: 'мм' },
    {
      id: 'paper',
      label: 'Бумага',
      type: 'swatch',
      default: 'coated-350',
      options: [
        { id: 'coated-300', label: 'Мелованная 300 г', swatch: { kind: 'paper', color: '#eceae3' } },
        { id: 'coated-350', label: 'Мелованная 350 г', swatch: { kind: 'paper', color: '#f3f1ea' } },
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
      label: 'Покрытие',
      type: 'swatch',
      default: 'none',
      options: [
        { id: 'none', label: 'Без покрытия', swatch: { kind: 'lam', sheen: 'none' } },
        { id: 'matte-lam', label: 'Матовая', coeff: 1.1, swatch: { kind: 'lam', sheen: 'matte' } },
        { id: 'gloss-lam', label: 'Глянцевая', coeff: 1.1, swatch: { kind: 'lam', sheen: 'gloss' } },
        {
          id: 'soft-touch',
          label: 'Soft Touch',
          coeff: 1.2,
          badge: 'хит',
          swatch: { kind: 'lam', sheen: 'soft' },
        },
        { id: 'uv-gloss', label: 'UV-лак глянец', coeff: 1.25, swatch: { kind: 'lam', sheen: 'gloss' } },
        { id: 'uv-matte', label: 'UV-лак мат', coeff: 1.25, swatch: { kind: 'lam', sheen: 'matte' } },
      ],
    },
    // Вид лака: только для подтипа lacquer + UV-лак; selective +50% (ТЗ п.1.1).
    {
      id: 'lacquer',
      label: 'Вид лака',
      type: 'segmented',
      default: 'full',
      options: [
        { id: 'full', label: 'Сплошной' },
        { id: 'selective', label: 'Выборочный', coeff: 1.5 },
      ],
    },
    {
      id: 'foil',
      label: 'Цвет фольги',
      type: 'swatch',
      default: 'gold',
      options: [
        {
          id: 'gold',
          label: 'Золото',
          swatch: { kind: 'foil', color: 'linear-gradient(135deg,#f7d774,#b8860b)' },
        },
        {
          id: 'silver',
          label: 'Серебро',
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
    {
      id: 'sides',
      label: 'Стороны',
      type: 'segmented',
      default: 'double',
      options: [
        { id: 'single', label: '1 сторона' },
        { id: 'double', label: '2 стороны', coeff: 1.35 },
      ],
    },
  ],
  // Тираж 50–10 000 (ТЗ п.1.1); пластик — от 100 (см. getMinQty).
  qtyTiers: [
    { qty: 50, perUnit: 18 },
    { qty: 100, perUnit: 12 },
    { qty: 200, perUnit: 9 },
    { qty: 300, perUnit: 7.5 },
    { qty: 500, perUnit: 6 },
    { qty: 1000, perUnit: 4.5 },
    { qty: 2000, perUnit: 3.6 },
    { qty: 5000, perUnit: 3 },
    { qty: 10000, perUnit: 2.6 },
  ],
  upsells: [
    { id: 'rounded-corners', label: 'Скруглённые углы', coeff: 1.1 },
    { id: 'plastic-case', label: 'Кейс для визиток', add: 150 },
    { id: 'design', label: 'Разработка дизайна', add: 500 },
    { id: 'hole', label: 'Отверстие под люверс', coeff: 1.05 },
  ],
  // Доступность покрытий по подтипу (таблица из ТЗ, п.1.1).
  getDisabled: (sel) => {
    const subtype = sel.subtype as string;
    const coatingBySubtype: Record<string, string[]> = {
      standard: ['none', 'matte-lam', 'gloss-lam', 'soft-touch'],
      lacquer: ['none', 'soft-touch', 'uv-gloss', 'uv-matte'],
      foil: ['none', 'matte-lam'],
      plastic: ['none'],
    };
    const allowed = coatingBySubtype[subtype] ?? ['none'];
    const allCoatings = ['none', 'matte-lam', 'gloss-lam', 'soft-touch', 'uv-gloss', 'uv-matte'];
    return { coating: allCoatings.filter((c) => !allowed.includes(c)) };
  },
  // Бумага скрыта для пластика; фольга — только для foil; вид лака — только
  // для lacquer + UV-лак; свой размер — только при format=custom.
  getHidden: (sel) => {
    const hidden: string[] = [];
    if (sel.subtype === 'plastic') hidden.push('paper');
    if (sel.subtype !== 'foil') hidden.push('foil');
    if (!(sel.subtype === 'lacquer' && String(sel.coating).startsWith('uv-'))) hidden.push('lacquer');
    if (sel.format !== 'custom') hidden.push('w', 'h');
    return hidden;
  },
  // Пластиковые визитки: минимальный тираж 100, шаг 100 (ТЗ п.1.1).
  getMinQty: (sel) => (sel.subtype === 'plastic' ? 100 : 50),
};
