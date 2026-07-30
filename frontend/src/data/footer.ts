/** Структура футера — 5 колонок (ТЗ навигации для дизайнера, п.4.2). */
import type { MegaLink } from './navigation';

export interface FooterColumn {
  title: string;
  links: MegaLink[];
}

export const footerColumns: FooterColumn[] = [
  {
    title: 'Услуги',
    links: [
      { label: 'Фото на документы', href: '/foto-na-dokumenty/' },
      { label: 'Копирование и печать', href: '/pechat-dokumentov/' },
      { label: 'Фотопечать', href: '/fotopechat/' },
      { label: 'Фотокниги', href: '/fotoknigi/' },
      { label: 'Полиграфия', href: '/poligrafiya/' },
      { label: 'Наклейки', href: '/naklejki/' },
      { label: 'Широкоформат', href: '/shirokoformat/' },
      { label: 'Печати и штампы', href: '/pechati-shtampy/' },
      { label: 'Сувениры', href: '/suveniry/' },
    ],
  },
  {
    title: 'Клиентам',
    links: [
      { label: 'Доставка и самовывоз', href: '/dostavka-i-samovyvoz/' },
      { label: 'Оплата', href: '/oplata/' },
      { label: 'Требования к макетам', href: '/trebovaniya-k-maketam/' },
      { label: 'Портфолио', href: '/portfolio/' },
      { label: 'Блог', href: '/blog/' },
      { label: 'Программа лояльности', href: '/programma-loyalnosti/' },
      { label: 'Личный кабинет', href: '/lichnyy-kabinet/' },
    ],
  },
  {
    title: 'О компании',
    links: [
      { label: 'О компании', href: '/o-kompanii/' },
      { label: 'Наши офисы', href: '/nashi-ofisy/' },
      { label: 'Вакансии', href: '/vakansii/' },
      { label: 'Контакты', href: '/kontakty/' },
      { label: 'Для бизнеса', href: '/dlya-biznesa-b2b/' },
    ],
  },
];

/** Способы оплаты и доставки — для колонки контактов. */
export const paymentMethods = ['Visa', 'Mastercard', 'МИР', 'СБП'];
export const deliveryMethods = ['СДЭК', 'Почта России'];

/** Нижняя строка футера — юридические ссылки. */
export const legalLinks: MegaLink[] = [
  { label: 'Политика конфиденциальности', href: '/politika-konfidencialnosti/' },
  { label: 'Договор оферты', href: '/dogovor-oferty/' },
];
