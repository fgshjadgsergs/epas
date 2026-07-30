import type { CalcConfig, Selection } from './types';
import { businessCards } from './configs/business-cards';
import { leaflets } from './configs/leaflets';
import { banner } from './configs/banner';
import {
  booklets,
  calendarPocket,
  calendarWall,
  canvasPrint,
  certificates,
  documentCopy,
  documentPrint,
  facsimile,
  foamBoard,
  labels,
  lamination,
  menu,
  mug,
  photoPrint,
  postcards,
  posterPrint,
  shopper,
  stampAuto,
  stampPocket,
  stickers,
  tshirt,
} from './configs/more';
import { idPhoto } from './configs/id-photo';
import {
  badges,
  binding,
  calendarDesk,
  hardcoverBinding,
  interiorPrint,
  lanyards,
  photoCalendar,
  photobook,
  planner,
  plombir,
  presswall,
  rollup,
} from './configs/more2';

export interface RegistryEntry {
  config: CalcConfig;
  /** Предвыбранные параметры при заходе со страницы-варианта. */
  preset?: Selection;
  /**
   * Статический calculator binding (переходный слой, пока привязка страниц
   * не перенесена в БД): backend-slug услуги, чей CalculatorDefinition
   * обслуживает эту страницу. Несколько страниц-вариантов указывают на один
   * slug и различаются только preset. Без этого поля страница работает на
   * локальном демо-фолбэке (в production — «расчёт недоступен»).
   * Slug НЕ выводится из pathname — только явная привязка.
   */
  calculatorServiceSlug?: string;
}

/** Карта «URL страницы услуги → конфиг калькулятора» (+ пресет варианта). */
export const calcRegistry: Record<string, RegistryEntry> = {
  // Визитки: все страницы-варианты используют definition услуги «vizitki».
  '/vizitki/': { config: businessCards, calculatorServiceSlug: 'vizitki' },
  '/vizitki/standartnye/': {
    config: businessCards,
    calculatorServiceSlug: 'vizitki',
    preset: { subtype: 'standard' },
  },
  '/vizitki/s-lakirovkoy/': {
    config: businessCards,
    calculatorServiceSlug: 'vizitki',
    preset: { subtype: 'lacquer' },
  },
  '/vizitki/s-tisneniem/': {
    config: businessCards,
    calculatorServiceSlug: 'vizitki',
    preset: { subtype: 'foil' },
  },
  '/vizitki/plastikovye/': {
    config: businessCards,
    calculatorServiceSlug: 'vizitki',
    preset: { subtype: 'plastic' },
  },
  // Листовки: страницы-варианты форматов → definition услуги «listovki».
  '/listovki/': { config: leaflets, calculatorServiceSlug: 'listovki' },
  '/listovki/a4/': { config: leaflets, calculatorServiceSlug: 'listovki', preset: { format: 'A4' } },
  '/listovki/a5/': { config: leaflets, calculatorServiceSlug: 'listovki', preset: { format: 'A5' } },
  '/listovki/a6-flyery/': { config: leaflets, calculatorServiceSlug: 'listovki', preset: { format: 'A6' } },
  // Полиграфия
  '/buklety/': { config: booklets, calculatorServiceSlug: 'buklety' },
  '/buklety/evroformat/': { config: booklets, calculatorServiceSlug: 'buklety', preset: { format: 'dl-trifold' } },
  '/otkrytki/': { config: postcards, calculatorServiceSlug: 'otkrytki' },
  '/sertifikaty/': { config: certificates, calculatorServiceSlug: 'sertifikaty' },
  '/menyu/': { config: menu, calculatorServiceSlug: 'menyu' },
  // Документы (партия C4 — общий серверный Pricing Engine)
  '/pechat-dokumentov/pechat-a4-a3/': { config: documentPrint, calculatorServiceSlug: 'pechat-a4-a3' },
  // Копирование — отдельный калькулятор: оригиналы × копии (ТЗ п.2.2).
  '/pechat-dokumentov/kopirovanie-a4-a3/': { config: documentCopy, calculatorServiceSlug: 'kopirovanie-a4-a3' },
  '/pechat-dokumentov/prezentacii/': { config: documentPrint, calculatorServiceSlug: 'pechat-a4-a3' },
  '/pechat-dokumentov/avtoreferaty/': { config: documentPrint, calculatorServiceSlug: 'pechat-a4-a3', preset: { color: 'bw' } },
  '/pechat-dokumentov/chertezhi/': { config: posterPrint, calculatorServiceSlug: 'postery-i-plakaty' },
  '/pechat-dokumentov/laminirovanie/': { config: lamination, calculatorServiceSlug: 'laminirovanie' },
  // Фотопечать: мультиформатный расчёт → definition услуги «fotopechat-na-bumage».
  '/fotopechat/pechat-fotografij/': { config: photoPrint, calculatorServiceSlug: 'fotopechat-na-bumage' },
  '/fotopechat/postery-i-plakaty/': { config: posterPrint, calculatorServiceSlug: 'postery-i-plakaty' },
  '/fotopechat/pechat-na-holste/': { config: canvasPrint, calculatorServiceSlug: 'pechat-na-holste' },
  // Накатка — постер + толщина основы + петля (ТЗ п.3.6).
  '/fotopechat/nakatka-na-penokarton/': { config: foamBoard, calculatorServiceSlug: 'nakatka-na-penokarton' },
  // Широкоформат: баннеры → definition услуги «bannery».
  '/shirokoformat/bannery/': { config: banner, calculatorServiceSlug: 'bannery' },
  // Наклейки
  '/naklejki/pechat/': { config: stickers, calculatorServiceSlug: 'pechat' },
  '/naklejki/stikerpaki/': { config: stickers, calculatorServiceSlug: 'pechat', preset: { type: 'sticker-pack' } },
  '/naklejki/etiketki/': { config: labels, calculatorServiceSlug: 'etiketki' },
  '/naklejki/birki-dlya-odezhdy/': { config: labels, calculatorServiceSlug: 'etiketki', preset: { type: 'clothing-tag' } },
  // Календари
  '/kalendari/nastennye/': { config: calendarWall, calculatorServiceSlug: 'nastennye' },
  '/kalendari/karmannye/': { config: calendarPocket, calculatorServiceSlug: 'karmannye' },
  // Печати и штампы: карманные и факсимиле — отдельные калькуляторы (ТЗ п.7.2).
  '/pechati-shtampy/avtomaticheskie/': { config: stampAuto, calculatorServiceSlug: 'shtampy-avtomaticheskie' },
  '/pechati-shtampy/karmannye/': { config: stampPocket, calculatorServiceSlug: 'pechati-karmannye' },
  '/pechati-shtampy/faksimile/': { config: facsimile, calculatorServiceSlug: 'faksimile' },
  // Сувениры (партия C5). Ланьярды/бейджи — нет раздела в ТЗ (TZ_ABSENT):
  // остаётся на локальном демо-фолбэке, серверная привязка не добавляется.
  '/suveniry/futbolki/': { config: tshirt, calculatorServiceSlug: 'futbolki' },
  '/suveniry/kruzhki/': { config: mug, calculatorServiceSlug: 'kruzhki' },
  '/suveniry/shoppery/': { config: shopper, calculatorServiceSlug: 'shoppery' },
  '/suveniry/lanyardy-bejdzi/': { config: lanyards },
  // Фото на документы (селектор документа с фикс-ценой) — один Definition,
  // тип документа = пресет варианта (ТЗ п.3.3).
  '/foto-na-dokumenty/pasport-rf/': { config: idPhoto, calculatorServiceSlug: 'foto-na-dokumenty', preset: { document: 'passport-rf' } },
  '/foto-na-dokumenty/zagranpasport/': { config: idPhoto, calculatorServiceSlug: 'foto-na-dokumenty', preset: { document: 'zagranpasport' } },
  '/foto-na-dokumenty/voditelskoe-udostoverenie/': { config: idPhoto, calculatorServiceSlug: 'foto-na-dokumenty', preset: { document: 'driver' } },
  '/foto-na-dokumenty/medicinskaya-knizhka/': { config: idPhoto, calculatorServiceSlug: 'foto-na-dokumenty', preset: { document: 'medbook' } },
  '/foto-na-dokumenty/snils/': { config: idPhoto, calculatorServiceSlug: 'foto-na-dokumenty', preset: { document: 'snils' } },
  '/foto-na-dokumenty/detskie-dokumenty/': { config: idPhoto, calculatorServiceSlug: 'foto-na-dokumenty', preset: { document: 'kids' } },
  '/foto-na-dokumenty/viza/': { config: idPhoto, calculatorServiceSlug: 'foto-na-dokumenty', preset: { document: 'visa-shengen' } },
  // Переплёт: брошюровка и твёрдый переплёт — разные калькуляторы (ТЗ п.2.3/2.4).
  '/pechat-dokumentov/broshyurovka/': { config: binding, calculatorServiceSlug: 'broshyurovka' },
  '/pechat-dokumentov/tvyordyj-pereplet/': { config: hardcoverBinding, calculatorServiceSlug: 'tvyordyj-pereplet', preset: { type: 'book' } },
  '/pechat-dokumentov/diplomnye-raboty/': { config: hardcoverBinding, calculatorServiceSlug: 'tvyordyj-pereplet', preset: { type: 'diploma' } },
  // Календари (остальные)
  '/kalendari/nastolnye/': { config: calendarDesk, calculatorServiceSlug: 'nastolnye' },
  '/kalendari/foto/': { config: photoCalendar },
  '/kalendari/planingi/': { config: planner },
  // Широкоформат (остальное)
  '/shirokoformat/roll-up/': { config: rollup, calculatorServiceSlug: 'roll-up' },
  '/shirokoformat/press-wall/': { config: presswall, calculatorServiceSlug: 'press-wall' },
  '/shirokoformat/interyernaya-pechat/': { config: interiorPrint, calculatorServiceSlug: 'interyernaya-pechat' },
  '/shirokoformat/afishi-postery/': { config: posterPrint, calculatorServiceSlug: 'postery-i-plakaty' },
  // Печати и штампы (пломбираторы)
  '/pechati-shtampy/plombiratory/': { config: plombir },
  // Бирки, бейджи, бланки
  '/birki-bejdzi-blanki/': { config: badges, calculatorServiceSlug: 'birki-bejdzi-blanki' },
  // Фотокниги (партия C5) — один Definition, подтип = пресет варианта (ТЗ 3.2).
  // Калькулятор цены; онлайн-конструктор разворотов — отдельная фаза, не здесь.
  '/fotoknigi/layflat/': { config: photobook, calculatorServiceSlug: 'fotoknigi', preset: { subtype: 'layflat' } },
  '/fotoknigi/hardcover/': { config: photobook, calculatorServiceSlug: 'fotoknigi', preset: { subtype: 'hardcover' } },
  '/fotoknigi/softcover/': { config: photobook, calculatorServiceSlug: 'fotoknigi', preset: { subtype: 'softcover' } },
  '/fotoknigi/svadebnye/': { config: photobook, calculatorServiceSlug: 'fotoknigi', preset: { subtype: 'hardcover' } },
  '/fotoknigi/detskie/': { config: photobook, calculatorServiceSlug: 'fotoknigi', preset: { subtype: 'softcover' } },
  '/fotoknigi/vypusknye-albomy/': { config: photobook, calculatorServiceSlug: 'fotoknigi', preset: { subtype: 'hardcover' } },
};

export function getCalculator(slug: string): RegistryEntry | undefined {
  return calcRegistry[slug];
}
