import type { CalcConfig } from '../types';

/**
 * Фото на документы (service_id: id-photo). ТЗ п.3.3 — не классический
 * калькулятор, а селектор документа с фиксированной ценой за комплект.
 * Справочник 30+ документов с поиском-автоподсказкой (на проде — из БД/CMS).
 */
export const idPhoto: CalcConfig = {
  serviceId: 'id-photo',
  preview: 'idphoto',
  defaultQty: 1,
  productionDays: 0,
  qtyDiscount: [{ from: 5, coeff: 0.9 }],
  qtyLabel: 'Комплектов',
  groups: [
    {
      id: 'document',
      label: 'Документ',
      type: 'search-select',
      default: 'passport-rf',
      options: [
        // Основные документы РФ
        { id: 'passport-rf', label: 'Паспорт РФ', price: 300, note: '35×45 мм, матовое' },
        { id: 'zagranpasport', label: 'Загранпаспорт (новый образец)', price: 400, note: '35×45 мм' },
        { id: 'zagranpasport-old', label: 'Загранпаспорт (старый образец)', price: 350, note: '35×45 мм' },
        { id: 'driver', label: 'Водительское удостоверение', price: 350, note: '35×45 мм' },
        { id: 'driver-intl', label: 'Международное ВУ', price: 350, note: '35×45 мм' },
        { id: 'medbook', label: 'Медицинская книжка', price: 300, note: '30×40 мм' },
        { id: 'snils', label: 'СНИЛС', price: 300, note: '35×45 мм' },
        { id: 'pensioner', label: 'Пенсионное удостоверение', price: 300, note: '30×40 мм' },
        { id: 'social-card', label: 'Социальная карта', price: 300, note: '30×40 мм' },
        { id: 'military', label: 'Военный билет', price: 350, note: '30×40 мм' },
        { id: 'gun-license', label: 'Разрешение на оружие', price: 350, note: '30×40 мм' },
        { id: 'guard-license', label: 'Удостоверение охранника (ЧОП)', price: 350, note: '30×40 мм' },
        { id: 'sailor', label: 'Паспорт моряка', price: 400, note: '30×40 мм' },
        { id: 'hunting', label: 'Охотничий билет', price: 350, note: '25×35 мм' },
        // Учёба и работа
        { id: 'student', label: 'Студенческий билет', price: 300, note: '30×40 мм' },
        { id: 'gradebook', label: 'Зачётная книжка', price: 300, note: '30×40 мм' },
        { id: 'personal-file', label: 'Личное дело', price: 300, note: '30×40 мм' },
        { id: 'resume', label: 'Резюме / анкета', price: 300, note: '40×60 мм' },
        { id: 'work-pass', label: 'Пропуск на работу', price: 300, note: '30×40 мм' },
        { id: 'badge-photo', label: 'Фото на бейдж', price: 300, note: '30×40 мм' },
        { id: 'isic', label: 'Карта ISIC', price: 350, note: '30×40 мм' },
        // Дети
        { id: 'kids', label: 'Детские документы', price: 350, note: '30×40 / 35×45 мм' },
        { id: 'kids-passport', label: 'Паспорт РФ (14 лет)', price: 300, note: '35×45 мм' },
        { id: 'kindergarten', label: 'Детский сад / школа', price: 300, note: '30×40 мм' },
        // Миграция и гражданство
        { id: 'rvp', label: 'РВП (разрешение на проживание)', price: 400, note: '35×45 мм' },
        { id: 'vnzh', label: 'Вид на жительство', price: 400, note: '35×45 мм' },
        { id: 'citizenship', label: 'Гражданство РФ', price: 400, note: '35×45 мм' },
        { id: 'migration-card', label: 'Миграционный учёт / патент', price: 400, note: '30×40 мм' },
        // Визы
        { id: 'visa-shengen', label: 'Шенгенская виза', price: 450, note: '35×45 мм' },
        { id: 'visa-usa', label: 'Виза США', price: 600, note: '51×51 мм' },
        { id: 'visa-uk', label: 'Виза Великобритании', price: 500, note: '35×45 мм' },
        { id: 'visa-china', label: 'Виза Китая', price: 500, note: '33×48 мм' },
        { id: 'visa-japan', label: 'Виза Японии', price: 500, note: '45×45 мм' },
        { id: 'visa-india', label: 'Виза Индии', price: 500, note: '51×51 мм' },
        { id: 'visa-other', label: 'Виза (другие страны)', price: 500, note: 'по требованию' },
      ],
    },
    {
      id: 'delivery',
      label: 'Формат получения',
      type: 'segmented',
      default: 'print',
      options: [
        { id: 'print', label: 'Печать (комплект)' },
        { id: 'digital', label: 'Электронный файл', coeff: 0.7 },
        { id: 'both', label: 'Печать + файл', perUnitAdd: 100 },
      ],
    },
  ],
  qtyRange: { min: 1, max: 20, step: 1 },
};
