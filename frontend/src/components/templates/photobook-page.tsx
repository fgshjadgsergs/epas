import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Images,
  LayoutGrid,
  ShoppingCart,
  Sparkles,
  Star,
  Upload,
} from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Section, SectionHeading } from '@/components/ui/section';
import { Button } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Faq } from '@/components/faq';
import { FaqJsonLd } from '@/components/seo/json-ld';
import { ReadMore } from '@/components/read-more';
import { Reveal } from '@/components/reveal';
import { RelatedCard } from '@/components/catalog/related-card';
import { PhotobookConfigurator } from '@/components/photobook/configurator';
import { OccasionTabs } from '@/components/photobook/occasion-tabs';
import { PhotobookExamples } from '@/components/photobook/examples-filter';
import { site } from '@/lib/site';
import { faqItems, type SeoPage } from '@/data/seo';
import { getBreadcrumbs, type CatalogNode } from '@/data/catalog';

const KONSTRUKTOR = '/fotoknigi/konstruktor/';

/** Типы фотокниг (макет: «Выберите тип фотокниги»). */
const types = [
  {
    id: 'layflat',
    name: 'LayFlat',
    priceFrom: 'от 4 800 ₽',
    text: 'Разворот раскрывается плоско, без шва по центру — панорамные фото на всю ширину.',
  },
  {
    id: 'softcover',
    name: 'Softcover',
    priceFrom: 'от 2 400 ₽',
    text: 'Мягкая обложка, лёгкая и недорогая — для повседневных альбомов и подарков.',
  },
  {
    id: 'hardcover',
    name: 'Hardcover',
    priceFrom: 'от 3 400 ₽',
    text: 'Твёрдая обложка с фотопечатью, кожзамом или тканью — премиальный вид.',
  },
];

/** Как создать фотокнигу онлайн (макет: 4 шага). */
const steps = [
  { icon: BookOpen, title: 'Выберите формат и переплёт', text: 'LayFlat, Hardcover или Softcover, размер и бумага.' },
  { icon: Upload, title: 'Загрузите фотографии', text: 'JPG, PNG, HEIC — прямо в браузере, с проверкой качества.' },
  { icon: LayoutGrid, title: 'Расставьте фото по страницам', text: '9 готовых раскладок разворота, фон и подписи.' },
  { icon: ShoppingCart, title: 'Оформите заказ', text: 'Доставка курьером, СДЭК и Почтой России по всей стране.' },
];

/** Сравнение типов страниц (ТЗ страницы фотокниги, блок 8). */
const pageTypes: { rows: [string, string, string, string][] } = {
  rows: [
    ['', 'Мелованная 170 г', 'Дизайнерская 200 г', 'Lay-flat'],
    ['Шов посередине', 'Есть', 'Есть', 'Нет'],
    ['Разворот', 'С лёгким сгибом', 'С лёгким сгибом', 'Плоский, панорама'],
    ['Для чего', 'Обычные альбомы', 'Подарки', 'Свадьба, панорамы'],
  ],
};

const reviews = [
  { name: 'Елена К.', date: '12 июня 2026', text: 'Заказали свадебную фотокнигу LayFlat — развороты плоские, фото на всю ширину. Печать отличная, рекомендую.' },
  { name: 'Михаил Р.', date: '3 июня 2026', text: 'Делал книгу в подарок родителям. Конструктор удобный, расставил фото за вечер. Голубой Hardcover — супер.' },
  { name: 'Анна Н.', date: '24 мая 2026', text: 'Для выпускного альбома брали большой формат. Качество на уровне, всё по документам с НДС.' },
];

const related = [
  { name: 'Печать фотографий', href: '/fotopechat/pechat-fotografij/', priceFrom: 'от 18 ₽' },
  { name: 'Печать на холсте', href: '/fotopechat/pechat-na-holste/', priceFrom: 'от 1 400 ₽' },
  { name: 'Фотокалендари', href: '/kalendari/foto/', priceFrom: 'от 450 ₽' },
  { name: 'Постеры и плакаты', href: '/fotopechat/postery-i-plakaty/', priceFrom: 'от 500 ₽' },
  { name: 'Печать на кружках', href: '/suveniry/kruzhki/', priceFrom: 'от 450 ₽' },
];

export function PhotobookPage({ node, seo }: { node: CatalogNode; seo?: SeoPage }) {
  const h1 = seo?.h1 ?? 'Фотокниги на заказ — создайте онлайн и закажите печать';
  const faq = seo?.faq?.length
    ? faqItems(seo.faq)
    : faqItems([
        'Какое минимальное количество разворотов?',
        'В каком формате загружать фото в конструктор?',
        'Можно ли заказать несколько экземпляров?',
        'Работаете ли с юридическими лицами?',
      ]);
  const paragraphs = seo?.seoText ? seo.seoText.split(/(?<=\.)\s+(?=[А-ЯA-Z])/) : [];

  return (
    <>
      <FaqJsonLd items={faq} />
      <Container>
        <Breadcrumbs crumbs={getBreadcrumbs(node.slug)} />
      </Container>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-bg-2">
        <div
          aria-hidden
          className="aurora-b pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_85%_-10%,rgb(var(--accent)/0.16),transparent)]"
        />
        <div aria-hidden className="halftone pointer-events-none absolute inset-0" />
        <div aria-hidden className="hero-grid pointer-events-none absolute inset-x-[-10%] bottom-[-25%] h-[70%]" />
        <Container className="relative py-12 lg:py-16">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <Reveal as="span" className="inline-flex items-center gap-2 text-accent">
                <Sparkles size={20} /> Онлайн-конструктор
              </Reveal>
              <Reveal
                as="h1"
                delay={80}
                className="mt-3 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl"
              >
                {h1}
              </Reveal>
              <Reveal as="p" delay={160} className="mt-4 max-w-xl text-muted">
                {seo?.description ??
                  'Загрузите фото, расставьте на страницах в конструкторе, выберите формат и переплёт. Доставка по России.'}
              </Reveal>
              <Reveal delay={240} className="mt-6 flex flex-wrap gap-3">
                <Button href={KONSTRUKTOR} size="lg">
                  Создать фотокнигу <ArrowRight size={18} />
                </Button>
                <Button href="#calculator" size="lg" variant="outline">
                  Рассчитать стоимость
                </Button>
              </Reveal>
            </div>
            <Reveal
              delay={200}
              aria-hidden
              className="relative hidden aspect-[4/3] rounded-3xl border border-border bg-gradient-to-br from-surface to-bg-2 lg:block"
            >
              <div className="absolute inset-0 grid place-items-center">
                <BookOpen size={112} className="text-accent/70" strokeWidth={1.2} />
              </div>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Калькулятор — сразу после hero (ТЗ страницы фотокниги, блок 3, анкор id="calculator"). */}
      <Section id="calculator" className="scroll-mt-28">
        <SectionHeading title="Рассчитайте стоимость" />
        <PhotobookConfigurator />
      </Section>

      {/* Выберите тип фотокниги */}
      <Section>
        <SectionHeading title="Выберите тип фотокниги" />
        <Reveal as="div" stagger className="grid gap-4 md:grid-cols-3">
          {types.map((t, ti) => (
            <div key={t.id} className="card-glow lift group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface">
              {/* Обложка-сцена: раскрытая книга в перспективе. */}
              <div
                className={`relative aspect-[16/10] overflow-hidden bg-gradient-to-br ${ti % 2 ? 'from-accent/15 via-surface-2 to-bg-2' : 'from-primary/15 via-surface-2 to-bg-2'}`}
                aria-hidden
              >
                <div className="absolute inset-0 grid place-items-center">
                  <div className="grid h-1/2 w-2/3 grid-cols-2 gap-[2%] rounded-md bg-surface p-[3%] shadow-xl [transform:perspective(400px)_rotateX(18deg)] transition-transform duration-500 group-hover:[transform:perspective(400px)_rotateX(10deg)]">
                    <div className={`rounded-sm bg-gradient-to-br ${ti % 2 ? 'from-accent/40 to-primary/30' : 'from-primary/40 to-accent/30'}`} />
                    <div className="space-y-[8%] pt-[4%]">
                      <div className="h-[16%] w-4/5 rounded-full bg-border" />
                      <div className="h-[16%] w-3/5 rounded-full bg-border" />
                      <div className={`mt-[10%] h-1/3 rounded-sm bg-gradient-to-br ${ti % 2 ? 'from-primary/30 to-accent/20' : 'from-accent/30 to-primary/20'}`} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="font-semibold">{t.name}</h3>
                <p className="mt-1 flex-1 text-sm text-muted">{t.text}</p>
                <p className="mt-3 font-semibold">{t.priceFrom}</p>
                <Button href={KONSTRUKTOR} size="md" className="mt-3 self-start">
                  Выбрать
                </Button>
              </div>
            </div>
          ))}
        </Reveal>
      </Section>

      {/* Превью конструктора */}
      <Section className="bg-bg-2">
        <div className="overflow-hidden rounded-3xl border border-border bg-surface">
          <div className="grid gap-0 lg:grid-cols-[220px_1fr_200px]">
            {/* левая панель — фото */}
            <div className="hidden border-r border-border p-4 lg:block" aria-hidden>
              <div className="grid h-24 place-items-center rounded-xl border border-dashed border-border text-xs text-subtle">
                <Upload size={20} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-lg bg-gradient-to-br from-surface-2 to-bg-2" />
                ))}
              </div>
            </div>
            {/* центр — разворот */}
            <div className="grid place-items-center bg-bg-2 p-6" aria-hidden>
              <div className="grid aspect-[2/1] w-full max-w-xl grid-cols-2 gap-1 rounded-lg bg-white p-2 shadow-[0_24px_48px_-20px_rgba(0,0,0,.4)]">
                <div className="rounded bg-gradient-to-br from-slate-200 to-slate-300" />
                <div className="grid grid-rows-2 gap-1">
                  <div className="rounded bg-gradient-to-br from-slate-200 to-slate-300" />
                  <div className="rounded bg-gradient-to-br from-slate-200 to-slate-300" />
                </div>
              </div>
            </div>
            {/* правая панель — раскладки */}
            <div className="hidden border-l border-border p-4 lg:block" aria-hidden>
              <p className="text-xs font-medium text-muted">Раскладки</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-lg border border-border bg-surface-2" />
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-5">
            <div className="flex items-center gap-2 text-sm text-muted">
              <Images size={18} className="text-primary" /> Соберите разворот из готовых раскладок, фона и подписей
            </div>
            <Button href={KONSTRUKTOR} size="md">
              Открыть конструктор <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      </Section>

      {/* Виды фотокниг по поводу (ТЗ страницы фотокниги, блок 5). */}
      <Section>
        <SectionHeading title="Фотокнига по поводу" />
        <OccasionTabs constructorHref={KONSTRUKTOR} />
      </Section>

      {/* Как создать фотокнигу онлайн */}
      <Section className="bg-bg-2">
        <SectionHeading title="Как создать фотокнигу онлайн" />
        <Reveal as="ol" stagger className="grid gap-8 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={i} className="group relative pt-2">
              <div className="relative z-10 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-fg shadow-[0_12px_28px_-12px_rgb(var(--primary)/0.7)] transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110">
                <s.icon size={22} />
              </div>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </li>
          ))}
        </Reveal>
      </Section>

      {/* Примеры наших фотокниг — 8 работ с фильтром по тематике (ТЗ, блок 7). */}
      <Section className="bg-bg-2">
        <SectionHeading title="Примеры наших фотокниг" link={{ label: 'Всё портфолио', href: '/portfolio/' }} />
        <Reveal>
          <PhotobookExamples />
        </Reveal>
      </Section>

      {/* Сравнение типов страниц (ТЗ, блок 8). */}
      <Section>
        <SectionHeading title="Сравнение типов страниц" />
        <Reveal>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="bg-surface-2 text-left">
                  {pageTypes.rows[0].map((h, i) => (
                    <th key={i} className="px-4 py-3 font-semibold sm:px-6">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageTypes.rows.slice(1).map((row) => (
                  <tr key={row[0]} className="row-hover bg-surface">
                    {row.map((cell, i) => (
                      <td
                        key={i}
                        className={`px-4 py-3.5 sm:px-6 ${i === 0 ? 'font-medium text-muted' : ''}`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </Section>

      {/* Отзывы о фотокнигах */}
      <Section>
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold sm:text-3xl">Отзывы о фотокнигах</h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1 text-sm">
            <Star size={15} className="fill-warning text-warning" />
            <strong>{site.rating.value}</strong>
            <span className="text-muted">· {site.rating.count}</span>
          </span>
        </div>
        <Reveal as="div" stagger className="grid gap-4 md:grid-cols-3">
          {reviews.map((r) => (
            <figure key={r.name} className="card-glow lift flex flex-col rounded-2xl border border-border bg-surface p-6">
              <div className="flex gap-0.5 text-warning" aria-label="5 из 5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={14} className="fill-warning" />
                ))}
              </div>
              <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-muted">{r.text}</blockquote>
              <figcaption className="mt-4 border-t border-border pt-3 text-sm">
                <span className="font-semibold">{r.name}</span>
                <span className="text-subtle"> · {r.date}</span>
              </figcaption>
            </figure>
          ))}
        </Reveal>
      </Section>

      {/* Смотрите также */}
      <Section className="bg-bg-2">
        <SectionHeading title="Смотрите также" />
        <Reveal as="div" stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((r, i) => (
            <RelatedCard
              key={r.href}
              name={r.name}
              href={r.href}
              priceFrom={r.priceFrom}
              cta="Подробнее"
              accent={i % 2 === 1}
            />
          ))}
        </Reveal>
      </Section>

      {/* SEO-текст + FAQ */}
      {(paragraphs.length > 0 || faq.length > 0) && (
        <Section>
          <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
            {paragraphs.length > 0 && (
              <div>
                <h2 className="mb-4 text-2xl font-bold">{seo?.h2?.[0] ?? 'О печати фотокниг'}</h2>
                <ReadMore>
                  <div className="space-y-3 text-muted">
                    {paragraphs.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                </ReadMore>
              </div>
            )}
            <div>
              <h2 className="mb-4 text-2xl font-bold">Частые вопросы</h2>
              <Faq items={faq} />
            </div>
          </div>
        </Section>
      )}
    </>
  );
}
