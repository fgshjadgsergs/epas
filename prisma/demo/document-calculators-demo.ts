/**
 * Демо-данные калькуляторов партии C4 — документы, постпечать, печати/штампы
 * и фото на документы. Data-driven поверх общей TIER-фабрики
 * (tier-calculators-demo.ts), чтобы не плодить по файлу на услугу.
 *
 * СТРУКТУРА (параметры/варианты/зависимости/qty/обработки) — строго по
 * `ТЗ_калькуляторы.md` (разделы указаны в каждом spec). ₽-надбавки и
 * %-модификаторы, ЯВНО заданные в ТЗ (срочность +30/+50/+60/+100 %, обложка
 * +150/+200/+300 ₽, доставка файла +100 ₽, скидка от 5 шт. −10 % и т. п.),
 * перенесены как бизнес-данные.
 *
 * ЦЕНЫ БАЗОВЫХ ТИРАЖЕЙ (BASE_TIER) и неоговорённые в ТЗ коэффициенты —
 * ДЕМОНСТРАЦИОННЫЕ (числа прежнего frontend-прототипа more.ts/more2.ts/
 * id-photo.ts): прайс создаётся только как isDemo. Боевых цен заказчик не давал.
 *
 * НЕ вошли: «пломбираторы» (/pechati-shtampy/plombiratory/) — раздела в
 * ТЗ_калькуляторы.md нет → TZ_ABSENT, не выдумываем.
 */
import type { TierSpec } from './tier-calculators-demo';

export const CAT_DOCUMENTS = 'pechat-dokumentov';
export const CAT_STAMPS = 'pechati-shtampy';
export const CAT_ID_PHOTO = 'foto-na-dokumenty';

/** Общая для документов срочность (ТЗ 2.1): standard / +30 % / +60 %. */
const urgencyDocPrint = {
  key: 'urgency', label: 'Срочность', type: 'SEGMENTED' as const, opts: [
    { v: 'standard', l: 'Стандарт (1 день)', def: true },
    { v: 'express-4h', l: 'За 4 часа', coeff: 1.3 },
    { v: 'express-1h', l: 'За 1 час', coeff: 1.6 },
  ],
};

/**
 * Фото на документы (ТЗ 3.3): «Список из БД (30+ вариантов), управляется из
 * CMS». Тип документа — OPTION; базовая цена варьируется как MULTIPLIER
 * относительно базового тиража (passport-rf = 300 ₽ DEMO). Полный список
 * ведётся в CMS; здесь — DEMO-набор из прототипа. coeff = цена / 300.
 */
const ID_PHOTO_DOCS: { v: string; l: string; price: number }[] = [
  { v: 'passport-rf', l: 'Паспорт РФ', price: 300 },
  { v: 'zagranpasport', l: 'Загранпаспорт (новый образец)', price: 400 },
  { v: 'zagranpasport-old', l: 'Загранпаспорт (старый образец)', price: 350 },
  { v: 'driver', l: 'Водительское удостоверение', price: 350 },
  { v: 'driver-intl', l: 'Международное ВУ', price: 350 },
  { v: 'medbook', l: 'Медицинская книжка', price: 300 },
  { v: 'snils', l: 'СНИЛС', price: 300 },
  { v: 'pensioner', l: 'Пенсионное удостоверение', price: 300 },
  { v: 'social-card', l: 'Социальная карта', price: 300 },
  { v: 'military', l: 'Военный билет', price: 350 },
  { v: 'gun-license', l: 'Разрешение на оружие', price: 350 },
  { v: 'guard-license', l: 'Удостоверение охранника (ЧОП)', price: 350 },
  { v: 'sailor', l: 'Паспорт моряка', price: 400 },
  { v: 'hunting', l: 'Охотничий билет', price: 350 },
  { v: 'student', l: 'Студенческий билет', price: 300 },
  { v: 'gradebook', l: 'Зачётная книжка', price: 300 },
  { v: 'personal-file', l: 'Личное дело', price: 300 },
  { v: 'resume', l: 'Резюме / анкета', price: 300 },
  { v: 'work-pass', l: 'Пропуск на работу', price: 300 },
  { v: 'badge-photo', l: 'Фото на бейдж', price: 300 },
  { v: 'isic', l: 'Карта ISIC', price: 350 },
  { v: 'kids', l: 'Детские документы', price: 350 },
  { v: 'kids-passport', l: 'Паспорт РФ (14 лет)', price: 300 },
  { v: 'kindergarten', l: 'Детский сад / школа', price: 300 },
  { v: 'rvp', l: 'РВП (разрешение на проживание)', price: 400 },
  { v: 'vnzh', l: 'Вид на жительство', price: 400 },
  { v: 'citizenship', l: 'Гражданство РФ', price: 400 },
  { v: 'migration-card', l: 'Миграционный учёт / патент', price: 400 },
  { v: 'visa-shengen', l: 'Шенгенская виза', price: 450 },
  { v: 'visa-usa', l: 'Виза США', price: 600 },
  { v: 'visa-uk', l: 'Виза Великобритании', price: 500 },
  { v: 'visa-china', l: 'Виза Китая', price: 500 },
  { v: 'visa-japan', l: 'Виза Японии', price: 500 },
  { v: 'visa-india', l: 'Виза Индии', price: 500 },
  { v: 'visa-other', l: 'Виза (другие страны)', price: 500 },
];
const ID_PHOTO_BASE = 300;
const idPhotoOptions = ID_PHOTO_DOCS.map((d, i) => ({
  v: d.v, l: d.l, def: i === 0,
  ...(d.price !== ID_PHOTO_BASE ? { coeff: Number((d.price / ID_PHOTO_BASE).toFixed(4)) } : {}),
}));

export const DOCUMENT_SPECS: TierSpec[] = [
  // 1. Печать документов (ТЗ 2.1). qty = кол-во листов; цена за лист пороговая
  //    (диапазоны 1–9 / 10–49 / 50–199 / 200+). Стороны/цвет/бумага/срочность —
  //    множители к цене за лист.
  {
    code: 'document-print', title: 'Печать документов A4/A3 (демо)', slug: 'pechat-a4-a3', category: CAT_DOCUMENTS, tz: '2.1',
    minQty: 1, maxQty: 5000, qtyStep: 1, defaultQty: 10, productionDays: 1,
    urlOrder: ['format', 'color', 'sides', 'paper', 'urgency', 'qty'],
    params: [
      { key: 'format', label: 'Формат', type: 'SEGMENTED', opts: [
        { v: 'A4', l: 'A4', def: true }, { v: 'A3', l: 'A3', coeff: 1.8 } ] },
      { key: 'color', label: 'Цветность', type: 'SEGMENTED', opts: [
        { v: 'bw', l: 'Чёрно-белая', coeff: 0.45 }, { v: 'color', l: 'Цветная', def: true } ] },
      { key: 'sides', label: 'Стороны', type: 'SEGMENTED', opts: [
        { v: 'single', l: '1 сторона', def: true }, { v: 'double', l: '2 стороны', coeff: 1.6 } ] },
      { key: 'paper', label: 'Бумага', type: 'SWATCH', opts: [
        { v: 'office-80', l: 'Офисная 80 г', def: true }, { v: 'office-100', l: 'Офисная 100 г', coeff: 1.15 },
        { v: 'photo-190', l: 'Фотобумага 190 г', coeff: 1.6 } ] },
      urgencyDocPrint,
    ],
    tiers: [[1, 12], [10, 8], [50, 5], [200, 3.2]],
    upsells: [{ code: 'staple', label: 'Скрепить', kind: 'FLAT', amount: 30 }],
    demoComment: 'ДЕМО-прайс печати документов (цена за лист — прототип frontend). Структура — ТЗ п.2.1.',
  },
  // 2. Копирование документов (ТЗ 2.2). Итого листов = оригиналы × копии
  //    (авто, на сервере через config.quantityFrom). Пороговая цена за лист.
  {
    code: 'document-copy', title: 'Копирование A4/A3 (демо)', slug: 'kopirovanie-a4-a3', category: CAT_DOCUMENTS, tz: '2.2',
    minQty: 1, maxQty: 50000, qtyStep: 1, defaultQty: 5, productionDays: 1,
    quantityFrom: ['originals', 'copies'],
    urlOrder: ['format', 'color', 'sides', 'originals', 'copies', 'urgency'],
    params: [
      { key: 'format', label: 'Формат', type: 'SEGMENTED', opts: [
        { v: 'A4', l: 'A4', def: true }, { v: 'A3', l: 'A3', coeff: 1.8 } ] },
      { key: 'color', label: 'Цветность', type: 'SEGMENTED', opts: [
        { v: 'bw', l: 'Чёрно-белая', def: true }, { v: 'color', l: 'Цветная', coeff: 2.2 } ] },
      { key: 'sides', label: 'Стороны', type: 'SEGMENTED', opts: [
        { v: 'single', l: '1 сторона', def: true }, { v: 'double', l: '2 стороны', coeff: 1.6 } ] },
      { key: 'originals', label: 'Оригиналов (уникальных листов)', type: 'DIMENSION', unit: 'шт', min: 1, max: 100, step: 1, default: '1' },
      { key: 'copies', label: 'Копий каждого', type: 'DIMENSION', unit: 'шт', min: 1, max: 1000, step: 1, default: '5' },
      urgencyDocPrint,
    ],
    tiers: [[1, 8], [10, 6], [50, 4], [200, 2.6]],
    upsells: [{ code: 'staple', label: 'Скрепить', kind: 'FLAT', amount: 30 }],
    demoComment: 'ДЕМО-прайс копирования (цена за лист — прототип frontend). Итого листов = оригиналы × копии — ТЗ п.2.2.',
  },
  // 3. Ламинирование (ТЗ 2.5). qty = кол-во листов; цена пороговая по объёму.
  //    Формат A6–A3 + custom (границы для «своего размера»).
  {
    code: 'lamination', title: 'Ламинирование (демо)', slug: 'laminirovanie', category: CAT_DOCUMENTS, tz: '2.5',
    minQty: 1, maxQty: 10000, qtyStep: 1, defaultQty: 10, productionDays: 1,
    express: { coeff: 1.3, days: 0 },
    urlOrder: ['format', 'customW', 'customH', 'type', 'sides', 'qty', 'express'],
    params: [
      { key: 'format', label: 'Формат', type: 'SEGMENTED', opts: [
        { v: 'A6', l: 'A6', coeff: 0.5 }, { v: 'A5', l: 'A5', coeff: 0.7 }, { v: 'A4', l: 'A4', def: true },
        { v: 'A3', l: 'A3', coeff: 1.8 }, { v: 'custom', l: 'Свой размер', coeff: 1.5 } ] },
      { key: 'customW', label: 'Ширина', type: 'DIMENSION', unit: 'мм', min: 50, max: 450, step: 5, default: '210', visibleIf: { format: 'custom' } },
      { key: 'customH', label: 'Высота', type: 'DIMENSION', unit: 'мм', min: 50, max: 620, step: 5, default: '297', visibleIf: { format: 'custom' } },
      { key: 'type', label: 'Тип плёнки', type: 'SWATCH', opts: [
        { v: 'matte', l: 'Матовая' }, { v: 'gloss', l: 'Глянцевая', def: true }, { v: 'soft-touch', l: 'Soft Touch', coeff: 1.2 } ] },
      { key: 'sides', label: 'Стороны', type: 'SEGMENTED', opts: [
        { v: 'single', l: '1 сторона', coeff: 0.6 }, { v: 'double', l: '2 стороны', def: true } ] },
    ],
    tiers: [[1, 40], [10, 25], [50, 18], [200, 12], [1000, 9], [5000, 7], [10000, 6]],
    demoComment: 'ДЕМО-прайс ламинирования (цена за лист по объёму — прототип frontend). Структура — ТЗ п.2.5.',
  },
  // 4. Брошюровка (ТЗ 2.3). qty = экземпляры; тип переплёта ограничивает
  //    допустимые диапазоны страниц (staple 4–48 / spiral 8–400 / thermo 40–800)
  //    — backend отклоняет несовместимую комбинацию (DISABLE_OPTIONS → 422).
  {
    code: 'binding-staple', title: 'Брошюровка (демо)', slug: 'broshyurovka', category: CAT_DOCUMENTS, tz: '2.3',
    minQty: 1, maxQty: 1000, qtyStep: 1, defaultQty: 1, productionDays: 1,
    express: { coeff: 1.3, days: 0 },
    urlOrder: ['type', 'format', 'pages', 'cover', 'qty', 'express'],
    params: [
      { key: 'type', label: 'Тип переплёта', type: 'SEGMENTED', opts: [
        { v: 'staple', l: 'Скрепка', coeff: 0.6 }, { v: 'spiral-plastic', l: 'Пластиковая пружина', def: true },
        { v: 'spiral-metal', l: 'Металлическая пружина', coeff: 1.2 }, { v: 'thermo', l: 'Термопереплёт', coeff: 1.4 } ] },
      { key: 'format', label: 'Формат', type: 'SEGMENTED', opts: [
        { v: 'A4', l: 'A4', def: true }, { v: 'A5', l: 'A5', coeff: 0.8 }, { v: 'A3', l: 'A3', coeff: 1.6 } ] },
      { key: 'pages', label: 'Кол-во страниц', type: 'SEGMENTED', opts: [
        { v: 'p-48', l: 'до 48', coeff: 0.7 }, { v: 'p-150', l: '49–150', def: true },
        { v: 'p-400', l: '151–400', coeff: 2 }, { v: 'p-800', l: '401–800', coeff: 3.2 } ] },
      { key: 'cover', label: 'Обложка', type: 'SWATCH', opts: [
        { v: 'none', l: 'Без', coeff: 0.9 }, { v: 'transparent', l: 'Прозрачная', def: true },
        { v: 'cardboard', l: 'Картон', coeff: 1.05 }, { v: 'printed', l: 'С печатью', perUnit: 150 } ] },
    ],
    tiers: [[1, 120], [5, 100], [10, 85], [50, 70]],
    disableRules: [
      { when: { type: 'staple' }, param: 'pages', options: ['p-150', 'p-400', 'p-800'], message: 'Скрепка — до 48 страниц (ТЗ 2.3)' },
      { when: { type: ['spiral-plastic', 'spiral-metal'] }, param: 'pages', options: ['p-800'], message: 'Пружина — до 400 страниц (ТЗ 2.3)' },
      { when: { type: 'thermo' }, param: 'pages', options: ['p-48'], message: 'Термопереплёт — от 40 страниц (ТЗ 2.3)' },
    ],
    demoComment: 'ДЕМО-прайс брошюровки (базовые тиражи — прототип frontend). Совместимость тип×страницы — ТЗ п.2.3.',
  },
  // 5. Твёрдый переплёт / дипломные работы (ТЗ 2.4). Один Definition; тип
  //    (diploma/thesis/report/book) — параметр/пресет, а не отдельная услуга.
  {
    code: 'hard-cover-binding', title: 'Твёрдый переплёт / дипломы (демо)', slug: 'tvyordyj-pereplet', category: CAT_DOCUMENTS, tz: '2.4',
    minQty: 1, maxQty: 500, qtyStep: 1, defaultQty: 1, productionDays: 2,
    urlOrder: ['type', 'format', 'pages', 'cover', 'emboss', 'printBlock', 'blockColor', 'blockPaper', 'urgency', 'qty'],
    params: [
      { key: 'type', label: 'Тип работы', type: 'SEGMENTED', opts: [
        { v: 'diploma', l: 'Диплом', def: true }, { v: 'thesis', l: 'Диссертация', coeff: 1.15 },
        { v: 'report', l: 'Отчёт', coeff: 0.95 }, { v: 'book', l: 'Книга', coeff: 1.1 } ] },
      { key: 'format', label: 'Формат', type: 'SEGMENTED', opts: [
        { v: 'A4', l: 'A4', def: true }, { v: 'A5', l: 'A5', coeff: 0.85 } ] },
      { key: 'pages', label: 'Кол-во страниц', type: 'SEGMENTED', opts: [
        { v: 'p-100', l: '20–100', coeff: 0.8 }, { v: 'p-200', l: '100–200', def: true },
        { v: 'p-400', l: '200–400', coeff: 1.4 }, { v: 'p-800', l: '400–800', coeff: 2 } ] },
      { key: 'cover', label: 'Обложка', type: 'SWATCH', opts: [
        { v: 'standard-black', l: 'Чёрная', def: true }, { v: 'standard-blue', l: 'Синяя' },
        { v: 'standard-red', l: 'Бордовая' }, { v: 'printed', l: 'С печатью', perUnit: 200 },
        { v: 'leatherette', l: 'Кожзам', perUnit: 300 } ] },
      { key: 'emboss', label: 'Тиснение', type: 'SEGMENTED', opts: [
        { v: 'none', l: 'Без', def: true }, { v: 'gold-foil', l: 'Золотая фольга', coeff: 1.15 },
        { v: 'silver-foil', l: 'Серебряная фольга', coeff: 1.12 } ] },
      { key: 'printBlock', label: 'Печать блока', type: 'SEGMENTED', opts: [
        { v: 'no', l: 'Только переплёт', def: true }, { v: 'yes', l: 'С печатью блока', coeff: 1.8 } ] },
      { key: 'blockColor', label: 'Цветность блока', type: 'SEGMENTED', visibleIf: { printBlock: 'yes' }, opts: [
        { v: 'bw', l: 'Чёрно-белая', def: true }, { v: 'color', l: 'Цветная', coeff: 1.6 } ] },
      { key: 'blockPaper', label: 'Бумага блока', type: 'SWATCH', visibleIf: { printBlock: 'yes' }, opts: [
        { v: 'office-80', l: 'Офисная 80 г', def: true }, { v: 'office-100', l: 'Офисная 100 г', coeff: 1.1 } ] },
      { key: 'urgency', label: 'Срочность', type: 'SEGMENTED', opts: [
        { v: 'standard', l: 'Стандарт (1–2 дня)', def: true }, { v: 'express', l: 'За 4 часа', coeff: 1.5 },
        { v: 'superexpress', l: 'За 1 час', coeff: 2 } ] },
    ],
    tiers: [[1, 700], [5, 620], [10, 560], [50, 500]],
    demoComment: 'ДЕМО-прайс твёрдого переплёта (базовые тиражи — прототип frontend). Тип-пресет и надбавки обложки/тиснения — ТЗ п.2.4.',
  },
  // 6. Автоматические штампы (ТЗ 7.1). Выбор оснастки (SKU) + чернила + макет;
  //    базовая цена по модели, запасная подушка +150 ₽.
  {
    code: 'stamp-auto', title: 'Автоматические штампы (демо)', slug: 'shtampy-avtomaticheskie', category: CAT_STAMPS, tz: '7.1',
    minQty: 1, maxQty: 1000, qtyStep: 1, defaultQty: 1, productionDays: 1,
    express: { coeff: 1.5, days: 0 },
    urlOrder: ['model', 'ink', 'maket', 'qty', 'express'],
    params: [
      { key: 'model', label: 'Модель оснастки', type: 'SEGMENTED', opts: [
        { v: 'trodat-4910', l: 'Trodat 4910 (26×9)', coeff: 0.85 }, { v: 'trodat-4911', l: 'Trodat 4911 (38×14)', coeff: 0.9 },
        { v: 'trodat-4912', l: 'Trodat 4912 (47×18)', def: true }, { v: 'trodat-4913', l: 'Trodat 4913 (58×22)', coeff: 1.2 },
        { v: 'trodat-4915', l: 'Trodat 4915 (70×25)', coeff: 1.35 }, { v: 'trodat-4926', l: 'Trodat 4926 (75×38)', coeff: 1.5 },
        { v: 'colop-e10', l: 'Colop E10 (27×10)', coeff: 0.9 }, { v: 'colop-e20', l: 'Colop E20 (38×14)', coeff: 0.95 },
        { v: 'colop-e30', l: 'Colop E30 (47×18)', coeff: 1.05 }, { v: 'colop-e40', l: 'Colop E40 (59×23)', coeff: 1.25 } ] },
      { key: 'ink', label: 'Цвет чернил', type: 'SWATCH', opts: [
        { v: 'blue', l: 'Синий', def: true }, { v: 'black', l: 'Чёрный' }, { v: 'red', l: 'Красный' },
        { v: 'green', l: 'Зелёный' }, { v: 'violet', l: 'Фиолетовый' } ] },
      { key: 'maket', label: 'Макет', type: 'SEGMENTED', opts: [
        { v: 'text', l: 'Ввести текст', def: true }, { v: 'file', l: 'Загрузить файл (AI, PDF, CDR)' } ] },
    ],
    tiers: [[1, 900], [3, 800], [5, 700]],
    upsells: [{ code: 'spare-pad', label: 'Запасная подушка', kind: 'PER_UNIT', amount: 150 }],
    demoComment: 'ДЕМО-прайс автоматических штампов (базовые модели — прототип frontend). Модели/подушка/срочность — ТЗ п.7.1.',
  },
  // 7. Карманные печати (ТЗ 7.2). Форма (SKU) + чернила + макет; подушка +100 ₽.
  {
    code: 'stamp-pocket', title: 'Карманные печати (демо)', slug: 'pechati-karmannye', category: CAT_STAMPS, tz: '7.2',
    minQty: 1, maxQty: 1000, qtyStep: 1, defaultQty: 1, productionDays: 1,
    urlOrder: ['shape', 'ink', 'maket', 'qty'],
    params: [
      { key: 'shape', label: 'Форма', type: 'SEGMENTED', opts: [
        { v: 'circle-40', l: 'Круг 40 мм', def: true }, { v: 'circle-35', l: 'Круг 35 мм', coeff: 0.9 },
        { v: 'circle-32', l: 'Круг 32 мм', coeff: 0.85 }, { v: 'rectangle-50x30', l: '50×30 мм', coeff: 1.05 },
        { v: 'rectangle-60x40', l: '60×40 мм', coeff: 1.2 } ] },
      { key: 'ink', label: 'Цвет чернил', type: 'SWATCH', opts: [
        { v: 'blue', l: 'Синий', def: true }, { v: 'black', l: 'Чёрный' }, { v: 'red', l: 'Красный' } ] },
      { key: 'maket', label: 'Макет', type: 'SEGMENTED', opts: [
        { v: 'text', l: 'Ввести текст', def: true }, { v: 'file', l: 'Загрузить файл' } ] },
    ],
    tiers: [[1, 750], [3, 680], [5, 620]],
    upsells: [{ code: 'spare-pad', label: 'Запасная подушка', kind: 'PER_UNIT', amount: 100 }],
    demoComment: 'ДЕМО-прайс карманных печатей (базовые тиражи — прототип frontend). Формы/подушка — ТЗ п.7.2.',
  },
  // 8. Факсимиле (ТЗ 7.2). Форма + произвольный размер в границах 20×10–80×40 мм
  //    + метод + оснастка.
  {
    code: 'facsimile', title: 'Факсимиле (демо)', slug: 'faksimile', category: CAT_STAMPS, tz: '7.2',
    minQty: 1, maxQty: 1000, qtyStep: 1, defaultQty: 1, productionDays: 1,
    urlOrder: ['shape', 'width', 'height', 'method', 'mount', 'qty'],
    params: [
      { key: 'shape', label: 'Форма', type: 'SEGMENTED', opts: [
        { v: 'rectangle', l: 'Прямоугольная', def: true }, { v: 'custom-shape', l: 'По контуру подписи', coeff: 1.25 } ] },
      { key: 'width', label: 'Ширина', type: 'DIMENSION', unit: 'мм', min: 20, max: 80, step: 1, default: '50' },
      { key: 'height', label: 'Высота', type: 'DIMENSION', unit: 'мм', min: 10, max: 40, step: 1, default: '20' },
      { key: 'method', label: 'Метод изготовления', type: 'SEGMENTED', opts: [
        { v: 'flash', l: 'Флеш-технология', def: true }, { v: 'laser', l: 'Лазерная гравировка', coeff: 1.15 } ] },
      { key: 'mount', label: 'Оснастка', type: 'SEGMENTED', opts: [
        { v: 'auto', l: 'Автоматическая', def: true }, { v: 'without', l: 'Без оснастки', coeff: 0.7 } ] },
    ],
    tiers: [[1, 1400], [3, 1250]],
    demoComment: 'ДЕМО-прайс факсимиле (базовые тиражи — прототип frontend). Форма/размер 20×10–80×40 мм/метод/оснастка — ТЗ п.7.2.',
  },
  // 9. Фото на документы (ТЗ 3.3). Тип документа (OPTION, цена как MULTIPLIER
  //    к базе), формат получения, комплектов; от 5 шт. — скидка 10 %.
  {
    code: 'id-photo', title: 'Фото на документы (демо)', slug: 'foto-na-dokumenty', category: CAT_ID_PHOTO, tz: '3.3',
    minQty: 1, maxQty: 1000, qtyStep: 1, defaultQty: 1, productionDays: 1,
    urlOrder: ['document', 'delivery', 'qty'],
    params: [
      { key: 'document', label: 'Тип документа', type: 'SEGMENTED', opts: idPhotoOptions },
      { key: 'delivery', label: 'Формат получения', type: 'SEGMENTED', opts: [
        { v: 'print', l: 'Печать (комплект)', def: true }, { v: 'digital', l: 'Электронный файл', coeff: 0.7 },
        { v: 'both', l: 'Печать + файл', perUnit: 100 } ] },
    ],
    tiers: [[1, ID_PHOTO_BASE]],
    qtyDiscount: { from: 5, coeff: 0.9 },
    demoComment: 'ДЕМО-прайс фото на документы (базовая цена комплекта — прототип frontend/CMS). Типы документов и скидка от 5 шт. — ТЗ п.3.3.',
  },
];
