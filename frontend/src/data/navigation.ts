/**
 * Модель навигации. Один источник правды для навбара, мегаменю и мобильного меню.
 * Контент мегаменю — из «ТЗ навигация для дизайнера», п.3.2.
 * URL — плоская ЧПУ-схема (см. «Общие технические требования», правила редиректов).
 * Все ссылки присутствуют в HTML при SSR — требование SEO (ТЗ навигации, п.6).
 */

export interface MegaLink {
  label: string;
  href: string;
  /** Подсветить как приоритетную ссылку (напр. «Онлайн-конструктор»). */
  highlight?: boolean;
}

export interface MegaGroup {
  title: string;
  links: MegaLink[];
}

export interface MegaPromo {
  text: string;
  ctaLabel: string;
  ctaHref: string;
}

export interface NavItem {
  id: string;
  label: string;
  href: string;
  /** Визуально выделенный пункт (Для бизнеса). */
  featured?: boolean;
  mega?: {
    heading: string;
    groups: MegaGroup[];
    promo: MegaPromo;
  };
}

/** Верхняя утилитарная полоска — вспомогательные ссылки (ТЗ навигации, п.2.1). */
export const utilityNav: MegaLink[] = [
  { label: 'О компании', href: '/o-kompanii/' },
  { label: 'Портфолио', href: '/portfolio/' },
  { label: 'Помощь с макетом', href: '/trebovaniya-k-maketam/' },
  { label: 'Контакты', href: '/kontakty/' },
];

export const mainNav: NavItem[] = [
  {
    id: 'foto-na-dokumenty',
    label: 'Фото на документы',
    href: '/foto-na-dokumenty/',
    mega: {
      heading: 'Фото на документы — по ГОСТу, готово за 5 минут',
      groups: [
        {
          title: 'Российские документы',
          links: [
            { label: 'Паспорт РФ', href: '/foto-na-dokumenty/pasport-rf/' },
            { label: 'Загранпаспорт', href: '/foto-na-dokumenty/zagranpasport/' },
            { label: 'Водительское удостоверение', href: '/foto-na-dokumenty/voditelskoe-udostoverenie/' },
            { label: 'СНИЛС / Пенсионное', href: '/foto-na-dokumenty/snils/' },
            { label: 'Медицинская книжка', href: '/foto-na-dokumenty/medicinskaya-knizhka/' },
            { label: '→ Все российские документы', href: '/foto-na-dokumenty/' },
          ],
        },
        {
          title: 'Для зарубежных документов',
          links: [
            { label: 'Шенгенская виза', href: '/foto-na-dokumenty/viza/' },
            { label: 'Виза США', href: '/foto-na-dokumenty/viza/' },
            { label: 'Загранпаспорт других стран', href: '/foto-na-dokumenty/zagranpasport/' },
            { label: '→ Все зарубежные документы', href: '/foto-na-dokumenty/' },
          ],
        },
        {
          title: 'Прочее',
          links: [
            { label: 'Фото для детей', href: '/foto-na-dokumenty/detskie-dokumenty/' },
            { label: 'Студенческий билет / Зачётная книжка', href: '/foto-na-dokumenty/detskie-dokumenty/' },
            { label: '→ Полный список документов', href: '/foto-na-dokumenty/' },
          ],
        },
      ],
      promo: {
        text: 'Готово за 5 минут. Формат по ГОСТу. Примут в МФЦ и посольствах.',
        ctaLabel: 'Загрузить фото →',
        ctaHref: '/foto-na-dokumenty/',
      },
    },
  },
  {
    id: 'pechat-dokumentov',
    label: 'Копирование и печать',
    href: '/pechat-dokumentov/',
    mega: {
      heading: 'Копирование и печать документов — А4, А3, срочно',
      groups: [
        {
          title: 'Печать и копирование',
          links: [
            { label: 'Печать документов А4', href: '/pechat-dokumentov/pechat-a4-a3/' },
            { label: 'Печать документов А3', href: '/pechat-dokumentov/pechat-a4-a3/' },
            { label: 'Копирование А4 / А3', href: '/pechat-dokumentov/kopirovanie-a4-a3/' },
            { label: 'Печать презентаций', href: '/pechat-dokumentov/prezentacii/' },
            { label: 'Печать чертежей', href: '/pechat-dokumentov/chertezhi/' },
          ],
        },
        {
          title: 'Переплёт',
          links: [
            { label: 'Брошюровка (пружина, скрепка)', href: '/pechat-dokumentov/broshyurovka/' },
            { label: 'Твёрдый переплёт', href: '/pechat-dokumentov/tvyordyj-pereplet/' },
            { label: 'Печать дипломных работ', href: '/pechat-dokumentov/diplomnye-raboty/' },
            { label: 'Печать авторефератов', href: '/pechat-dokumentov/avtoreferaty/' },
          ],
        },
        {
          title: 'Дополнительно',
          links: [{ label: 'Ламинирование', href: '/pechat-dokumentov/laminirovanie/' }],
        },
      ],
      promo: {
        text: 'Загрузи PDF — получи готовое. Чёрно-белая печать А4 от 10 ₽/лист.',
        ctaLabel: 'Рассчитать стоимость →',
        ctaHref: '/pechat-dokumentov/',
      },
    },
  },
  {
    id: 'fotopechat',
    label: 'Фотопечать',
    href: '/fotopechat/',
    mega: {
      heading: 'Фотопечать — профессиональная бумага, доставка по России',
      groups: [
        {
          title: 'Форматы',
          links: [
            { label: 'Печать 10×15 см', href: '/fotopechat/pechat-fotografij/' },
            { label: 'Печать 13×18 см', href: '/fotopechat/pechat-fotografij/' },
            { label: 'Печать 20×30 см', href: '/fotopechat/pechat-fotografij/' },
            { label: 'Печать 30×40 и крупнее', href: '/fotopechat/pechat-fotografij/' },
            { label: '→ Все форматы', href: '/fotopechat/' },
          ],
        },
        {
          title: 'Интерьерная',
          links: [
            { label: 'Печать на холсте', href: '/fotopechat/pechat-na-holste/' },
            { label: 'Постеры и плакаты', href: '/fotopechat/postery-i-plakaty/' },
            { label: 'Накатка на пенокартон', href: '/fotopechat/nakatka-na-penokarton/' },
          ],
        },
        {
          title: 'Популярное',
          links: [
            { label: 'Печать фото из Instagram', href: '/fotopechat/pechat-fotografij/' },
            { label: 'Фотографии для документов', href: '/foto-na-dokumenty/' },
            { label: '→ Все услуги фотопечати', href: '/fotopechat/' },
          ],
        },
      ],
      promo: {
        text: 'Профессиональная фотобумага. Тираж от 1 снимка.',
        ctaLabel: 'Заказать фотопечать →',
        ctaHref: '/fotopechat/',
      },
    },
  },
  {
    id: 'fotoknigi',
    label: 'Фотокниги',
    href: '/fotoknigi/',
    mega: {
      heading: 'Фотокниги на заказ — онлайн-конструктор, доставка по России',
      groups: [
        {
          title: 'По типу переплёта',
          links: [
            { label: 'Фотокниги Lay-flat (без шва)', href: '/fotoknigi/layflat/' },
            { label: 'Фотокниги Hardcover (твёрдая обложка)', href: '/fotoknigi/hardcover/' },
            { label: 'Фотокниги Softcover (мягкая обложка)', href: '/fotoknigi/softcover/' },
          ],
        },
        {
          title: 'По поводу',
          links: [
            { label: 'Свадебные фотокниги', href: '/fotoknigi/svadebnye/' },
            { label: 'Детские фотокниги', href: '/fotoknigi/detskie/' },
            { label: 'Выпускные альбомы', href: '/fotoknigi/vypusknye-albomy/' },
            { label: '→ Все виды фотокниг', href: '/fotoknigi/' },
          ],
        },
        {
          title: 'Инструмент',
          links: [{ label: 'Онлайн-конструктор фотокниг', href: '/fotoknigi/konstruktor/', highlight: true }],
        },
      ],
      promo: {
        text: 'Создайте фотокнигу в онлайн-конструкторе прямо в браузере. Без установки программ.',
        ctaLabel: 'Открыть конструктор →',
        ctaHref: '/fotoknigi/konstruktor/',
      },
    },
  },
  {
    id: 'poligrafiya',
    label: 'Полиграфия',
    href: '/poligrafiya/',
    mega: {
      heading: 'Оперативная полиграфия — печать с доставкой, тираж от 1 экземпляра',
      groups: [
        {
          title: 'Визитки',
          links: [
            { label: 'Стандартные визитки', href: '/vizitki/' },
            { label: 'Визитки с лакировкой', href: '/vizitki/s-lakirovkoy/' },
            { label: 'Визитки с тиснением фольгой', href: '/vizitki/s-tisneniem/' },
            { label: 'Пластиковые визитки', href: '/vizitki/plastikovye/' },
            { label: '→ Все виды визиток', href: '/vizitki/' },
          ],
        },
        {
          title: 'Листовки и буклеты',
          links: [
            { label: 'Листовки А4', href: '/listovki/a4/' },
            { label: 'Листовки А5', href: '/listovki/a5/' },
            { label: 'Флаеры (А6, DL)', href: '/listovki/a6-flyery/' },
            { label: 'Буклет евроформат', href: '/buklety/evroformat/' },
            { label: 'Буклет А4', href: '/buklety/a4/' },
            { label: 'Буклет А5', href: '/buklety/a5/' },
            { label: '→ Все листовки и буклеты', href: '/listovki/' },
          ],
        },
        {
          title: 'Прочее',
          links: [
            { label: 'Открытки и приглашения', href: '/otkrytki/' },
            { label: 'Сертификаты и дипломы', href: '/sertifikaty/' },
            { label: 'Бирки, бейджи, бланки', href: '/birki-bejdzi-blanki/' },
            { label: 'Меню для ресторанов', href: '/menyu/' },
            { label: 'Календари', href: '/kalendari/' },
            { label: '→ Весь каталог полиграфии', href: '/poligrafiya/' },
          ],
        },
      ],
      promo: {
        text: 'Визитки от 990 ₽, срочно за 3 часа. Тираж от 50 штук.',
        ctaLabel: 'Рассчитать визитки →',
        ctaHref: '/vizitki/',
      },
    },
  },
  {
    id: 'naklejki',
    label: 'Наклейки',
    href: '/naklejki/',
    mega: {
      heading: 'Наклейки и этикетки — вырубка по контуру, тираж от 1 штуки',
      groups: [
        {
          title: 'Виды наклеек',
          links: [
            { label: 'Печать наклеек', href: '/naklejki/pechat/' },
            { label: 'Стикерпаки', href: '/naklejki/stikerpaki/' },
            { label: 'Этикетки', href: '/naklejki/etiketki/' },
          ],
        },
        {
          title: 'Для бизнеса',
          links: [
            { label: 'Этикетки в рулонах', href: '/naklejki/etiketki/' },
            { label: 'Бирки и ярлыки для одежды', href: '/naklejki/birki-dlya-odezhdy/' },
            { label: '→ Все наклейки и этикетки', href: '/naklejki/' },
          ],
        },
        {
          title: 'Популярные форматы',
          links: [
            { label: 'Круглые наклейки', href: '/naklejki/pechat/' },
            { label: 'Прямоугольные наклейки', href: '/naklejki/pechat/' },
            { label: 'Наклейки на прозрачной плёнке', href: '/naklejki/pechat/' },
          ],
        },
      ],
      promo: {
        text: 'Любая форма, любой материал. Тираж от 1 штуки.',
        ctaLabel: 'Рассчитать наклейки →',
        ctaHref: '/naklejki/pechat/',
      },
    },
  },
  {
    id: 'shirokoformat',
    label: 'Широкоформат',
    href: '/shirokoformat/',
    mega: {
      heading: 'Широкоформатная и наружная печать — баннеры, стенды, Roll Up',
      groups: [
        {
          title: 'Наружная реклама',
          links: [
            { label: 'Печать баннеров', href: '/shirokoformat/bannery/' },
            { label: 'Печать афиш и постеров', href: '/shirokoformat/afishi-postery/' },
            { label: 'Интерьерная печать', href: '/shirokoformat/interyernaya-pechat/' },
          ],
        },
        {
          title: 'Для мероприятий',
          links: [
            { label: 'Стенды Roll Up', href: '/shirokoformat/roll-up/' },
            { label: 'Press Wall / Фотостена', href: '/shirokoformat/' },
          ],
        },
        {
          title: 'Популярные размеры',
          links: [
            { label: 'Баннер 1×0.5 м', href: '/shirokoformat/bannery/?w=1&h=0.5' },
            { label: 'Баннер 2×1 м', href: '/shirokoformat/bannery/?w=2&h=1' },
            { label: 'Roll Up 80×200 см', href: '/shirokoformat/roll-up/' },
            { label: '→ Все форматы', href: '/shirokoformat/' },
          ],
        },
      ],
      promo: {
        text: 'Любой формат баннера. Люверсы, обшивка — в комплекте.',
        ctaLabel: 'Рассчитать баннер →',
        ctaHref: '/shirokoformat/bannery/',
      },
    },
  },
  {
    id: 'pechati-shtampy',
    label: 'Печати и штампы',
    href: '/pechati-shtampy/',
    mega: {
      heading: 'Изготовление печатей и штампов — за 1 рабочий день',
      groups: [
        {
          title: 'Виды изделий',
          links: [
            { label: 'Автоматические штампы', href: '/pechati-shtampy/avtomaticheskie/' },
            { label: 'Карманные печати', href: '/pechati-shtampy/karmannye/' },
            { label: 'Факсимиле', href: '/pechati-shtampy/faksimile/' },
            { label: 'Пломбираторы', href: '/pechati-shtampy/plombiratory/' },
          ],
        },
        {
          title: 'По назначению',
          links: [
            { label: 'Печать для ООО и ИП', href: '/pechati-shtampy/' },
            { label: 'Штампы «ОПЛАЧЕНО», «ВХОДЯЩИЙ», «КОПИЯ ВЕРНА»', href: '/pechati-shtampy/avtomaticheskie/' },
            { label: 'Корпоративные штампы', href: '/pechati-shtampy/avtomaticheskie/' },
          ],
        },
        {
          title: 'Помощь',
          links: [
            { label: 'Требования к макету', href: '/trebovaniya-k-maketam/' },
            { label: 'Образцы оттисков', href: '/pechati-shtampy/' },
            { label: '→ Все виды печатей', href: '/pechati-shtampy/' },
          ],
        },
      ],
      promo: {
        text: 'Изготовим за 1 рабочий день. Введите текст прямо на сайте.',
        ctaLabel: 'Заказать штамп →',
        ctaHref: '/pechati-shtampy/avtomaticheskie/',
      },
    },
  },
  {
    id: 'suveniry',
    label: 'Сувениры',
    href: '/suveniry/',
    mega: {
      heading: 'Сувениры и текстиль с логотипом — подарки для бизнеса и частных лиц',
      groups: [
        {
          title: 'Текстиль',
          links: [
            { label: 'Печать на футболках', href: '/suveniry/futbolki/' },
            { label: 'Шопперы с логотипом', href: '/suveniry/shoppery/' },
          ],
        },
        {
          title: 'Посуда и аксессуары',
          links: [
            { label: 'Печать на кружках', href: '/suveniry/kruzhki/' },
            { label: 'Ланъярды и бейджи', href: '/suveniry/lanyardy-bejdzi/' },
          ],
        },
        {
          title: 'Корпоративное',
          links: [
            { label: 'Брендированные подарки', href: '/suveniry/' },
            { label: 'Сувениры для мероприятий', href: '/suveniry/' },
            { label: '→ Все сувениры', href: '/suveniry/' },
          ],
        },
      ],
      promo: {
        text: 'Корпоративные подарки с логотипом. Тираж от 1 штуки.',
        ctaLabel: 'Выбрать сувенир →',
        ctaHref: '/suveniry/',
      },
    },
  },
  {
    id: 'dlya-biznesa',
    label: 'Для бизнеса',
    href: '/dlya-biznesa-b2b/',
    featured: true,
    mega: {
      heading: 'Корпоративная полиграфия — НДС, ЭДО, персональный менеджер',
      groups: [
        {
          title: 'Корпоративные услуги',
          links: [
            { label: 'Корпоративная полиграфия', href: '/dlya-biznesa-b2b/korporativnaya-poligrafiya/' },
            { label: 'Полиграфия для выставок', href: '/dlya-biznesa-b2b/dlya-vystavok/' },
            { label: 'POS-материалы и брендирование', href: '/dlya-biznesa-b2b/pos-materialy/' },
          ],
        },
        {
          title: 'Условия работы',
          links: [
            { label: 'Работа с НДС и документами', href: '/dlya-biznesa-b2b/nds-i-dokumenty/' },
            { label: 'Электронный документооборот (ЭДО)', href: '/dlya-biznesa-b2b/nds-i-dokumenty/' },
            { label: 'Отсрочка платежа', href: '/dlya-biznesa-b2b/nds-i-dokumenty/' },
          ],
        },
        {
          title: 'Партнёрство',
          links: [
            { label: 'Оптовые заказы', href: '/dlya-biznesa-b2b/partnership/' },
            { label: 'Стать партнёром', href: '/dlya-biznesa-b2b/partnership/' },
            { label: '→ Все условия для бизнеса', href: '/dlya-biznesa-b2b/' },
          ],
        },
      ],
      promo: {
        text: 'Договор, счёт-фактура, акт. ЭДО. Персональный менеджер. Скидки от объёма.',
        ctaLabel: 'Запросить КП →',
        ctaHref: '/dlya-biznesa-b2b/#request',
      },
    },
  },
];
