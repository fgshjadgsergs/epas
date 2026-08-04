import Link from 'next/link';
import {
  ArrowRight,
  BadgePercent,
  Clock,
  Download,
  FileCheck2,
  Layers,
  MapPin,
  Package,
  Phone,
  Quote,
  Star,
  Truck,
  Wand2,
} from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Section, SectionHeading } from '@/components/ui/section';
import { Button } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Faq } from '@/components/faq';
import { FaqJsonLd } from '@/components/seo/json-ld';
import { serializeJsonLd } from '@/lib/seo/json-ld';
import { ReadMore } from '@/components/read-more';
import { CalculatorStub } from '@/components/calculator/calculator-stub';
import { Calculator } from '@/components/calculator/calculator';
import { getCalculator } from '@/lib/calc/registry';
import type { CalcConfig } from '@/lib/calc/types';
import { Reveal } from '@/components/reveal';
import { PortfolioTile } from '@/components/catalog/portfolio-tile';
import { RelatedCard } from '@/components/catalog/related-card';
import { plural } from '@/lib/utils';
import { site } from '@/lib/site';
import { faqItems, type SeoPage } from '@/data/seo';
import { getBreadcrumbs, getSiblings, type CatalogNode } from '@/data/catalog';

/**
 * Страница услуги — структура по эталонной посадочной из SEO-анализа
 * («Эталонная посадочная», раздел 2) и макету «Макет страницы услуги»:
 * 1) H1-зона: цена «от» + срок + скидка за онлайн-заказ, CTA;
 * 2) калькулятор с динамической ценой — первый экран;
 * 3) «Как заказать» (3 шага);
 * 4) характеристики и материалы (+ карточки готовности/тиража/проверки);
 * 5) примеры работ; 6) отзывы; 7) FAQ;
 * 8) требования к макету + помощь с дизайном;
 * 9) перелинковка на смежные услуги; 10) CTA.
 */

const steps = [
  { icon: FileCheck2, title: 'Рассчитайте цену', text: 'Выберите параметры в калькуляторе — цена и дата готовности обновляются сразу' },
  { icon: Download, title: 'Загрузите макет', text: 'PDF/AI/CDR с вылетами 3 мм — или закажите дизайн от 500 ₽' },
  { icon: Truck, title: 'Получите заказ', text: 'Курьер, СДЭК, Почта России или самовывоз' },
];

function priceNumber(node: CatalogNode): number {
  const m = node.priceFrom?.match(/\d[\d\s]*/);
  return m ? Number(m[0].replace(/\s/g, '')) : 990;
}

/** Характеристики из конфига калькулятора — реальные параметры услуги по ТЗ. */
function configCharacteristics(config?: CalcConfig): [string, string][] {
  if (!config) {
    return [
      ['Размер', 'стандартные форматы и произвольный'],
      ['Бумага / материал', 'мелованная, дизайнерская и др.'],
      ['Покрытие', 'без, матовое, глянцевое, Soft Touch'],
      ['Мин. тираж', 'от 1 шт.'],
      ['Срок', 'стандарт 1–2 дня / экспресс от 1 часа'],
      ['Доставка', 'курьер, СДЭК, Почта России, самовывоз'],
    ];
  }
  const rows: [string, string][] = [];
  // Служебные группы калькулятора — не характеристики продукта:
  // «Срочность» дублирует строку «Срок», «Макет» — способ передачи файла.
  const skip = new Set(['urgency', 'maket']);
  for (const g of config.groups) {
    if (!g.options || g.options.length < 2 || skip.has(g.id)) continue;
    if (rows.length >= 6) break;
    rows.push([g.label, g.options.map((o) => o.label).join(', ')]);
  }
  const minQty = config.qtyTiers?.[0]?.qty ?? config.qtyRange?.min ?? 1;
  rows.push(['Мин. тираж', `от ${minQty.toLocaleString('ru-RU')} шт.`]);
  rows.push([
    'Срок',
    config.express
      ? `стандарт ${config.productionDays} дн. / экспресс ${config.express.label ?? '1 день'}`
      : `${config.productionDays} раб. дн.`,
  ]);
  rows.push(['Доставка', 'курьер, СДЭК, Почта России, самовывоз']);
  return rows;
}

export function ServicePage({ node, seo }: { node: CatalogNode; seo?: SeoPage }) {
  const h1 = seo?.h1 ?? `${node.name} в ${site.city}`;
  const faq = seo?.faq?.length ? faqItems(seo.faq) : [];
  const siblings = getSiblings(node.slug);
  const price = priceNumber(node);
  const calc = getCalculator(node.slug);
  const characteristics = configCharacteristics(calc?.config);
  const minQty = calc?.config.qtyTiers?.[0]?.qty ?? calc?.config.qtyRange?.min ?? 1;

  // Анкор-навигация (ТЗ услуги, блок 1). Таб «FAQ» — только если секция
  // реально рендерится (без seo-данных её нет — иначе таб был бы битым якорем).
  const anchors = [
    { id: 'calculator', label: 'Калькулятор' },
    { id: 'description', label: 'Описание' },
    { id: 'examples', label: 'Примеры работ' },
    { id: 'reviews', label: 'Отзывы' },
    ...(seo?.seoText || faq.length > 0 ? [{ id: 'faq', label: 'FAQ' }] : []),
  ];

  return (
    <>
      {faq.length > 0 && <FaqJsonLd items={faq} />}
      {/* Product + Offer (ТЗ страницы услуги) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: node.name,
            description: seo?.description ?? node.name,
            offers: {
              '@type': 'Offer',
              price: String(price),
              priceCurrency: 'RUB',
              availability: 'https://schema.org/InStock',
            },
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: String(site.rating.value),
              reviewCount: String(site.rating.count),
            },
          }),
        }}
      />

      <Container>
        <Breadcrumbs crumbs={getBreadcrumbs(node.slug)} />
      </Container>

      {/* H1-зона: цена «от», срок, скидка за онлайн-заказ + CTA (макет услуги).
          Фон — растр печати и аврора, как на главной. */}
      <div className="relative overflow-hidden">
        <div aria-hidden className="halftone pointer-events-none absolute inset-0" />
        <div
          aria-hidden
          className="aurora-b pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgb(var(--primary)/0.14),transparent_70%)] blur-2xl"
        />
        <Container className="relative">
          <Reveal className="pb-6">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{h1}</h1>
          <p className="mt-2 text-muted">Онлайн-расчёт за 1 минуту{node.term ? `, готовность ${node.term}` : ''}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {node.priceFrom && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-semibold">
                {node.priceFrom}
              </span>
            )}
            {/* Порядок чипов по ТЗ (блок 2): цена, тираж, срок, доставка. */}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm">
              <Layers size={14} className="text-primary" /> тираж от {minQty.toLocaleString('ru-RU')} шт.
            </span>
            {node.term && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm">
                <Clock size={14} className="text-primary" /> срок {node.term}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm">
              <Truck size={14} className="text-primary" /> доставка по России
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-success">
              <BadgePercent size={14} /> скидка 5% за онлайн-заказ
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 text-sm">
              <Star size={14} className="fill-warning text-warning" />
              {site.rating.value} · {site.rating.count} {plural(site.rating.count, ['отзыв', 'отзыва', 'отзывов'])}
            </span>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button href="#calculator" size="lg">
              Рассчитать стоимость <ArrowRight size={18} />
            </Button>
            <Button href={site.phone.href} size="lg" variant="outline">
              <Phone size={18} /> Позвонить
            </Button>
          </div>
          </Reveal>
        </Container>
      </div>

      {/* Анкор-навигация (ТЗ услуги, блок 1): sticky ниже хедера,
          на мобиле — горизонтальный скролл без переноса. */}
      <div className="sticky top-[104px] z-30 border-y border-border bg-bg/95 backdrop-blur lg:top-[112px]">
        <Container>
          <nav aria-label="Разделы страницы" className="no-scrollbar flex gap-1 overflow-x-auto">
            {anchors.map((a) => (
              <a
                key={a.id}
                href={`#${a.id}`}
                className="whitespace-nowrap px-3 py-3 text-sm font-medium text-muted hover:text-fg"
              >
                {a.label}
              </a>
            ))}
          </nav>
        </Container>
      </div>

      {/* Калькулятор: конфиг-движок для подключённых услуг, иначе демо-заглушка. */}
      <Section id="calculator" className="scroll-mt-28">
        {calc ? <Calculator slug={node.slug} name={node.name} /> : <CalculatorStub basePrice={price} />}
      </Section>

      {/* Как заказать — 3 шага (эталонная посадочная, блок 3). */}
      <Section className="bg-bg-2">
        <SectionHeading title="Как заказать" />
        <div className="relative">
          {/* Линия маршрута между шагами (desktop, scroll-driven).
              Геометрия привязана к иконкам: top-8 — центр иконки (pt-2 + h-12/2),
              left-10 — центр первой (px-4 + 24), right — центр последней
              (треть сетки с gap-6 минус те же 40px). */}
          <div
            aria-hidden
            className="step-line absolute left-10 right-[calc(33.333%-56px)] top-8 hidden h-px bg-gradient-to-r from-primary via-accent to-primary md:block"
          />
          <Reveal as="ol" stagger className="grid gap-8 md:grid-cols-3 md:gap-6">
            {steps.map((s, i) => (
              <li key={i} className="group relative pt-2 md:px-4">
                <div className="relative z-10 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-fg shadow-[0_12px_28px_-12px_rgb(var(--primary)/0.7)] transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110">
                  <s.icon size={22} />
                </div>
                <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 max-w-xs text-sm text-muted">{s.text}</p>
              </li>
            ))}
          </Reveal>
        </div>
      </Section>

      {/* Характеристики и материалы + карточки готовности/тиража/проверки (макет). */}
      <Section id="description" className="scroll-mt-28">
        <SectionHeading title="Характеристики и материалы" />
        <div className="grid items-start gap-5 lg:grid-cols-[1.5fr_1fr]">
          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {characteristics.map(([k, v]) => (
                  <tr key={k} className="row-hover bg-surface">
                    <th scope="row" className="w-1/3 px-4 py-3 text-left align-top font-medium text-muted sm:px-5">
                      {k}
                    </th>
                    <td className="px-4 py-3 sm:px-5">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Reveal as="div" stagger className="grid gap-4">
            {[
              { icon: Clock, text: `Готовность ${node.term ?? 'от 1 дня'}` },
              { icon: Layers, text: `Минимальный тираж ${minQty.toLocaleString('ru-RU')} шт.` },
              { icon: FileCheck2, text: 'Бесплатная проверка макета перед печатью' },
            ].map((c) => (
              <div key={c.text} className="card-glow group flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                  <c.icon size={19} />
                </span>
                <p className="text-sm font-medium">{c.text}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </Section>

      {/* Примеры работ */}
      <Section id="examples" className="scroll-mt-28 bg-bg-2">
        <SectionHeading title="Примеры наших работ" />
        {/* Карточки под реальные фото с подписью «название + техника»
            (ТЗ услуги, блок 6) + плитка «Всё портфолио» с шевронами. */}
        {/* 6 работ (ТЗ: 4–6) + плитка «Всё портфолио» на два ряда. */}
        <Reveal as="div" stagger className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {['Цифровая печать', 'Офсетная печать', 'Премиум-отделка'].map((tech) => (
            <figure
              key={tech}
              className="lift relative aspect-square overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface-2 to-bg-2"
            >
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg/90 to-transparent p-3 pt-8 text-xs font-medium">
                {node.name} — {tech}
              </figcaption>
            </figure>
          ))}
          <PortfolioTile className="row-span-2 md:col-start-4" />
          {['Тиснение фольгой', 'Дизайнерская бумага', 'Срочный тираж'].map((tech) => (
            <figure
              key={tech}
              className="lift relative aspect-square overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface-2 to-bg-2"
            >
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg/90 to-transparent p-3 pt-8 text-xs font-medium">
                {node.name} — {tech}
              </figcaption>
            </figure>
          ))}
        </Reveal>
      </Section>

      {/* Отзывы */}
      <Section id="reviews" className="scroll-mt-28">
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold sm:text-3xl">Отзывы клиентов</h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1 text-sm">
            <Star size={15} className="fill-warning text-warning" />
            <strong>{site.rating.value}</strong>
            <span className="text-muted">
              · {site.rating.count} · {site.rating.source}
            </span>
          </span>
        </div>
        <Reveal as="div" stagger className="grid gap-4 md:grid-cols-3">
          {[
            { name: 'Ольга В.', text: 'Отличное качество и точные цвета, сделали в срок.' },
            { name: 'Дмитрий К.', text: 'Заказывал срочно — успели за несколько часов.' },
            { name: 'Ирина М.', text: 'Удобный расчёт онлайн, всё по документам с НДС.' },
          ].map((r, i) => (
            <figure
              key={i}
              className="card-glow lift relative overflow-hidden rounded-2xl border border-border bg-surface p-5"
            >
              <Quote
                aria-hidden
                size={64}
                strokeWidth={1}
                className="pointer-events-none absolute -right-2 -top-2 rotate-180 text-primary opacity-[0.08]"
              />
              <div className="relative flex items-center gap-3">
                <span className="rounded-full bg-gradient-to-br from-primary to-accent p-[2px]">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-surface text-xs font-bold text-primary">
                    {r.name.slice(0, 1)}
                  </span>
                </span>
                <figcaption className="text-sm font-semibold">{r.name}</figcaption>
              </div>
              <div className="relative mt-3 flex gap-0.5 text-warning" aria-label="5 из 5">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} size={14} className="fill-warning" />
                ))}
              </div>
              <blockquote className="relative mt-2 text-sm text-muted">{r.text}</blockquote>
            </figure>
          ))}
        </Reveal>
        {/* Внешняя ссылка на все отзывы (ТЗ услуги, блок 7). */}
        <div className="mt-8 text-center">
          <a
            href={site.reviewsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-5 text-sm font-semibold text-fg hover:bg-surface-2"
          >
            <Star size={16} className="fill-warning text-warning" /> Все отзывы на Яндекс.Картах
          </a>
        </div>
      </Section>

      {/* SEO-текст + FAQ — две колонки (макет страницы услуги). */}
      {(seo?.seoText || faq.length > 0) && (
        <Section id="faq" className="scroll-mt-28 bg-bg-2">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
            {seo?.seoText && (
              <div>
                <h2 className="mb-4 text-2xl font-bold">{seo.h2?.[0] ?? 'Подробнее об услуге'}</h2>
                <ReadMore>
                  <div className="space-y-3 text-muted">
                    {seo.seoText.split(/(?<=\.)\s+(?=[А-ЯA-Z])/).map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                </ReadMore>
              </div>
            )}
            {faq.length > 0 && (
              <div>
                <h2 className="mb-4 text-2xl font-bold">Частые вопросы</h2>
                <Faq items={faq} />
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Требования к макету + помощь с дизайном (эталонная посадочная, блок 7). */}
      <Section id="requirements" className="scroll-mt-28">
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-xl font-bold">Требования к макету</h2>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              <li>• Форматы: PDF, AI, CDR (кривые), TIFF</li>
              <li>• Вылеты 3 мм с каждой стороны, значимые элементы — отступ 3 мм от края</li>
              <li>• Цветовая модель CMYK, разрешение 300 dpi</li>
              <li>• Чёрный текст — composite black (0/0/0/100)</li>
            </ul>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button href="#" size="sm" variant="outline">
                <Download size={15} /> Шаблон PDF
              </Button>
              <Button href="#" size="sm" variant="outline">
                <Download size={15} /> Шаблон AI
              </Button>
              <Button href="/trebovaniya-k-maketam/" size="sm" variant="ghost">
                Подробная инструкция
              </Button>
            </div>
          </div>
          <div className="flex flex-col justify-center rounded-2xl border border-border bg-gradient-to-br from-surface to-bg-2 p-6">
            <Wand2 size={24} className="text-accent" />
            <h3 className="mt-3 font-semibold">Нет макета или не уверены в файле?</h3>
            <p className="mt-1 text-sm text-muted">
              Разработаем дизайн от 500 ₽ и согласуем с вами перед печатью. Технолог бесплатно
              проверит готовый файл.
            </p>
            <Button href="#" size="md" className="mt-4 self-start">
              Заказать дизайн
            </Button>
          </div>
        </div>
      </Section>

      {/* Доставка и самовывоз (макет страницы услуги). */}
      <Section className="scroll-mt-28 bg-bg-2">
        <SectionHeading title="Доставка и самовывоз" />
        <Reveal as="div" stagger className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: MapPin,
              title: 'Самовывоз',
              text: `${site.city}, ул. Примерная, 1. Готовим к выдаче — сообщим по SMS.`,
              badge: 'бесплатно',
            },
            { icon: Truck, title: 'Курьер по городу', text: 'Доставим в день готовности. Бесплатно от 3 000 ₽.' },
            {
              icon: Package,
              title: 'СДЭК и Почта России',
              text: 'Доставка по всей стране, стоимость — по тарифам служб.',
            },
          ].map((d) => (
            <div key={d.title} className="card-glow group rounded-2xl border border-border bg-surface p-6">
              <div className="flex items-center justify-between gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                  <d.icon size={20} />
                </span>
                {d.badge && (
                  <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
                    {d.badge}
                  </span>
                )}
              </div>
              <h3 className="mt-3 font-semibold">{d.title}</h3>
              <p className="mt-1 text-sm text-muted">{d.text}</p>
            </div>
          ))}
        </Reveal>
      </Section>

      {/* Смотрите также — перелинковка на смежные услуги (блок 8). */}
      {siblings.length > 0 && (
        <Section>
          <SectionHeading title="Смотрите также" />
          <Reveal as="div" stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {siblings.map((s, i) => (
              <RelatedCard key={s.slug} name={s.name} href={s.slug} priceFrom={s.priceFrom} term={s.term} accent={i % 2 === 1} />
            ))}
          </Reveal>
        </Section>
      )}

      {/* Pre-footer CTA. Отступ снизу на мобиле — под фикс-бар калькулятора. */}
      <section className="border-t border-border">
        <Container className="flex flex-col items-center gap-5 py-14 pb-28 text-center lg:pb-14">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Рассчитайте стоимость за минуту
          </h2>
          <p className="max-w-xl text-muted">
            Онлайн-расчёт со скидкой 5% за заказ на сайте. Точная цена и дата готовности — сразу.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button href="#calculator" size="lg">
              Рассчитать стоимость <ArrowRight size={18} />
            </Button>
            <Button href={site.phone.href} size="lg" variant="outline">
              <Phone size={18} /> {site.phone.display}
            </Button>
          </div>
        </Container>
      </section>
    </>
  );
}
