/**
 * «Популярные заказы» страниц категорий (ТЗ страницы категории, блок 5):
 * 4 готовые конфигурации с ценой и кнопкой «Заказать» на раздел.
 * Цены-заглушки в духе прайса META (data/catalog.ts); на проде — из CMS.
 */
export interface PopularOrder {
  /** Название конфигурации. */
  title: string;
  /** Строка параметров (тираж, материал, отделка). */
  params: string;
  price: string;
  href: string;
}

const BY_SECTION: Record<string, PopularOrder[]> = {
  '/vizitki/': [
    { title: 'Визитки стандарт', params: '100 шт · мелованная 350 г · без ламинации', price: '1 200 ₽', href: '/vizitki/standartnye/?qty=100' },
    { title: 'Визитки Soft Touch', params: '200 шт · 350 г · ламинация Soft Touch', price: '2 900 ₽', href: '/vizitki/s-lakirovkoy/?qty=200' },
    { title: 'Визитки с фольгой', params: '100 шт · тиснение золотом', price: '3 400 ₽', href: '/vizitki/s-tisneniem/?qty=100' },
    { title: 'Пластиковые визитки', params: '50 шт · пластик 0,5 мм', price: '3 900 ₽', href: '/vizitki/plastikovye/?qty=50' },
  ],
  '/listovki/': [
    { title: 'Листовки А5', params: '500 шт · 130 г · 4+4', price: '2 400 ₽', href: '/listovki/a5/?qty=500' },
    { title: 'Листовки А4', params: '500 шт · 130 г · 4+4', price: '3 900 ₽', href: '/listovki/a4/?qty=500' },
    { title: 'Флаеры Евро', params: '1 000 шт · 115 г · 4+4', price: '3 200 ₽', href: '/listovki/a6-flyery/?qty=1000' },
    { title: 'Листовки А6', params: '1 000 шт · 130 г · 4+0', price: '2 600 ₽', href: '/listovki/a6-flyery/?qty=1000' },
  ],
  '/foto-na-dokumenty/': [
    { title: 'Фото на паспорт РФ', params: '4 шт · 35×45 мм · матовая', price: '300 ₽', href: '/foto-na-dokumenty/pasport-rf/' },
    { title: 'Фото на загранпаспорт', params: '4 шт · по требованиям МИД', price: '350 ₽', href: '/foto-na-dokumenty/zagranpasport/' },
    { title: 'Фото на визу', params: '4 шт · Шенген 35×45 мм', price: '350 ₽', href: '/foto-na-dokumenty/viza/' },
    { title: 'Фото на права', params: '4 шт · 30×40 мм', price: '300 ₽', href: '/foto-na-dokumenty/voditelskoe-udostoverenie/' },
  ],
  '/pechat-dokumentov/': [
    { title: 'Печать А4 ч/б', params: '100 листов · 80 г', price: '800 ₽', href: '/pechat-dokumentov/pechat-a4-a3/?qty=100' },
    { title: 'Печать А4 цвет', params: '50 листов · 120 г', price: '1 250 ₽', href: '/pechat-dokumentov/pechat-a4-a3/?qty=50' },
    { title: 'Диплом с переплётом', params: '80 страниц · твёрдый переплёт', price: '1 400 ₽', href: '/pechat-dokumentov/diplomnye-raboty/' },
    { title: 'Презентация на пружине', params: '30 страниц · цвет · пружина', price: '900 ₽', href: '/pechat-dokumentov/prezentacii/' },
  ],
  '/fotopechat/': [
    { title: 'Фото 10×15', params: '100 шт · глянцевая бумага', price: '900 ₽', href: '/fotopechat/pechat-fotografij/?qty=100' },
    { title: 'Холст 40×60', params: 'галерейная натяжка · подрамник', price: '2 900 ₽', href: '/fotopechat/pechat-na-holste/' },
    { title: 'Постер А2', params: 'фотобумага 200 г', price: '650 ₽', href: '/fotopechat/postery-i-plakaty/' },
    { title: 'Пенокартон 50×70', params: 'накатка + ламинация', price: '1 900 ₽', href: '/fotopechat/nakatka-na-penokarton/' },
  ],
  '/kalendari/': [
    { title: 'Календарь-домик', params: '50 шт · перекидной', price: '4 500 ₽', href: '/kalendari/nastolnye/?qty=50' },
    { title: 'Настенный перекидной', params: '20 шт · А3 · пружина', price: '6 800 ₽', href: '/kalendari/nastennye/?qty=20' },
    { title: 'Карманные календари', params: '1 000 шт · ламинация', price: '3 900 ₽', href: '/kalendari/karmannye/?qty=1000' },
    { title: 'Фотокалендарь', params: '1 шт · ваши фото · А3', price: '890 ₽', href: '/kalendari/foto/' },
  ],
  '/shirokoformat/': [
    { title: 'Баннер 2×1 м', params: 'литой винил · люверсы', price: '1 400 ₽', href: '/shirokoformat/bannery/?w=2&h=1' },
    { title: 'Roll Up 85×200', params: 'стенд + печать + сумка', price: '5 900 ₽', href: '/shirokoformat/roll-up/' },
    { title: 'Афиша А1', params: '10 шт · 150 г', price: '1 900 ₽', href: '/shirokoformat/afishi-postery/?qty=10' },
    { title: 'Интерьерная печать', params: 'фотообои · 1 м²', price: '900 ₽', href: '/shirokoformat/interyernaya-pechat/' },
  ],
  '/naklejki/': [
    { title: 'Наклейки круглые 5 см', params: '100 шт · винил', price: '900 ₽', href: '/naklejki/pechat/?qty=100' },
    { title: 'Стикерпак', params: '10 листов А5 · контурная резка', price: '1 500 ₽', href: '/naklejki/stikerpaki/?qty=10' },
    { title: 'Этикетки на бутылку', params: '500 шт · самоклейка', price: '2 900 ₽', href: '/naklejki/etiketki/?qty=500' },
    { title: 'Бирки для одежды', params: '500 шт · картон + люверс', price: '2 400 ₽', href: '/naklejki/birki-dlya-odezhdy/?qty=500' },
  ],
  '/suveniry/': [
    { title: 'Кружка с фото', params: '1 шт · сублимация', price: '450 ₽', href: '/suveniry/kruzhki/' },
    { title: 'Футболка с принтом', params: '1 шт · DTF-печать', price: '900 ₽', href: '/suveniry/futbolki/' },
    { title: 'Шопперы с логотипом', params: '50 шт · шелкография', price: '9 500 ₽', href: '/suveniry/shoppery/?qty=50' },
    { title: 'Ланъярды', params: '100 шт · сублимация', price: '5 900 ₽', href: '/suveniry/lanyardy-bejdzi/?qty=100' },
  ],
  '/pechati-shtampy/': [
    { title: 'Печать ООО', params: 'автоматическая оснастка', price: '900 ₽', href: '/pechati-shtampy/avtomaticheskie/' },
    { title: 'Печать ИП', params: 'карманная оснастка', price: '700 ₽', href: '/pechati-shtampy/karmannye/' },
    { title: 'Факсимиле', params: 'подпись · оснастка', price: '1 200 ₽', href: '/pechati-shtampy/faksimile/' },
    { title: 'Штамп «Оплачено»', params: 'стандартный · 38×14 мм', price: '600 ₽', href: '/pechati-shtampy/avtomaticheskie/' },
  ],
  '/buklety/': [
    { title: 'Буклет евро', params: '500 шт · 2 фальца · 130 г', price: '4 900 ₽', href: '/buklety/evroformat/?qty=500' },
    { title: 'Буклет евро, мал. тираж', params: '100 шт · 2 фальца', price: '1 900 ₽', href: '/buklety/evroformat/?qty=100' },
    { title: 'Буклет А4 в А5', params: '500 шт · 1 фальц', price: '4 200 ₽', href: '/buklety/evroformat/?qty=500' },
    { title: 'Буклет премиум', params: '200 шт · 170 г · матовая ламинация', price: '4 800 ₽', href: '/buklety/evroformat/?qty=200' },
  ],
  '/fotoknigi/': [
    { title: 'LayFlat 20×20', params: '10 разворотов · твёрдая обложка', price: '4 800 ₽', href: '/fotoknigi/layflat/' },
    { title: 'Hardcover 25×25', params: '10 разворотов · фотообложка', price: '3 900 ₽', href: '/fotoknigi/hardcover/' },
    { title: 'Softcover 20×20', params: '10 разворотов · мягкая обложка', price: '2 400 ₽', href: '/fotoknigi/softcover/' },
    { title: 'Свадебная фотокнига', params: 'LayFlat 30×30 · кожзам', price: '8 900 ₽', href: '/fotoknigi/svadebnye/' },
  ],
};

/** Общий набор для разделов без собственного списка. */
const GENERIC: PopularOrder[] = [
  { title: 'Визитки стандарт', params: '100 шт · мелованная 350 г', price: '1 200 ₽', href: '/vizitki/standartnye/?qty=100' },
  { title: 'Листовки А5', params: '500 шт · 130 г · 4+4', price: '2 400 ₽', href: '/listovki/a5/?qty=500' },
  { title: 'Баннер 2×1 м', params: 'литой винил · люверсы', price: '1 400 ₽', href: '/shirokoformat/bannery/?w=2&h=1' },
  { title: 'Фото на паспорт РФ', params: '4 шт · 35×45 мм', price: '300 ₽', href: '/foto-na-dokumenty/pasport-rf/' },
];

export function getPopularOrders(slug: string): PopularOrder[] {
  return BY_SECTION[slug] ?? GENERIC;
}
