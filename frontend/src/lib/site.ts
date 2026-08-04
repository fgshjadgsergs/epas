/**
 * Единый источник правды по бренду и контактам.
 * Значения-заглушки из ТЗ; на проде управляются из CMS.
 */
export const site = {
  name: 'КИДС-ПРИНТ',
  legalName: 'КИДС-ПРИНТ',
  tagline: 'Онлайн-типография',
  description:
    'Онлайн-типография в Санкт-Петербурге: печать визиток, листовок, фотокниг, баннеров. Онлайн-расчёт стоимости, срочное изготовление, доставка по России.',
  url: 'https://example.com',
  city: 'Санкт-Петербург',
  /** Предложный падеж для конструкций «в …» (H1, title). */
  cityLoc: 'Санкт-Петербурге',
  locale: 'ru_RU',
  phone: {
    display: '+7 (495) 000-00-00',
    href: 'tel:+74950000000',
  },
  email: 'info@kidsprint.ru',
  workHours: 'Ежедневно 9:00–21:00',
  freeDeliveryFrom: 3000,
  socials: {
    vk: 'https://vk.com/kidsprint',
    telegram: 'https://t.me/kidsprint',
    whatsapp: 'https://wa.me/74950000000',
  },
  rating: { value: 4.9, count: 1241, source: 'Яндекс.Карты' },
  /** Внешняя страница отзывов на Яндекс.Картах (ТЗ: кнопка «Читать все отзывы»). */
  reviewsUrl: 'https://yandex.ru/maps/org/kidsprint/reviews/',
  legal: { inn: '0000000000', ogrn: '0000000000000' },
  yandexMetrikaId: 0, // подставляется из env на проде
} as const;

export type Site = typeof site;
