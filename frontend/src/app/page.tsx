import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Building2,
  Camera,
  Clock,
  CreditCard,
  FileText,
  Handshake,
  PackageCheck,
  Phone,
  Presentation,
  Printer,
  Quote,
  SlidersHorizontal,
  Sparkles,
  Star,
  Upload,
  Zap,
} from 'lucide-react';
import type { Metadata } from 'next';
import { Section, SectionHeading } from '@/components/ui/section';
import { Container } from '@/components/ui/container';
import { Button } from '@/components/ui/button';
import { MobileCarousel } from '@/components/ui/mobile-carousel';
import { SearchForm } from '@/components/navigation/search-form';
import { Faq } from '@/components/faq';
import { MiniCalc } from '@/components/home/mini-calc';
import { ExamplesGallery } from '@/components/home/examples-gallery';
import { Reveal, StatCounter } from '@/components/reveal';
import { FaqJsonLd, LocalBusinessJsonLd, OrganizationJsonLd } from '@/components/seo/json-ld';
import { buildMetadata } from '@/lib/seo';
import { site } from '@/lib/site';
import {
  b2bPerks,
  blogPosts,
  homeFaq,
  howItWorks,
  popularConfigs,
  quickServices,
  reviews,
  whyUs,
  whyUsStats,
} from '@/data/home';

export const metadata: Metadata = buildMetadata({
  title: `${site.tagline} в ${site.city}`,
  description: site.description,
  path: '/',
});

/** Иконки шагов «Как это работает». */
const howItWorksIcons = [SlidersHorizontal, Upload, PackageCheck];

/** Иконки обложек статей блога (по темам постов). */
const blogCoverIcons = [CreditCard, FileText, BookOpen];

/** Иконки и акцентные оттенки карточек «Популярные услуги» (bento-сетка). */
const quickCardMeta = [
  { icon: Camera, tint: 'text-primary', chip: 'bg-primary/10', glow: 'bg-primary/15' },
  { icon: Printer, tint: 'text-accent', chip: 'bg-accent/10', glow: 'bg-accent/15' },
  { icon: BookOpen, tint: 'text-primary', chip: 'bg-primary/10', glow: 'bg-primary/15' },
  { icon: CreditCard, tint: 'text-accent', chip: 'bg-accent/10', glow: 'bg-accent/15' },
  { icon: Presentation, tint: 'text-primary', chip: 'bg-primary/10', glow: 'bg-primary/15' },
];

export default function HomePage() {
  return (
    <>
      {/* Organization (все страницы кроме услуг) + LocalBusiness (только главная) — ТЗ SEO, п.8. */}
      <OrganizationJsonLd />
      <LocalBusinessJsonLd />
      <FaqJsonLd items={homeFaq} />

      {/* Блок 1 — Hero: фирменное фото (флэтлей типографии) фоном.
          Файл public/hero.jpg — сейчас временная подложка в тон фото,
          подменяется настоящим снимком без правок кода. */}
      <section className="relative overflow-hidden border-b border-border">
        <div aria-hidden className="absolute inset-0">
          <Image
            src="/hero.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-[72%_center]"
          />
          {/* Тонировка в цвет активной темы (токен --bg): плотная только под
              текстом слева, правая половина фото остаётся открытой. */}
          <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/70 via-50% to-transparent" />
          {/* Нижняя кромка растворяется в фоне страницы. */}
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-bg to-transparent" />
        </div>
        {/* Лёгкая фирменная тонировка поверх фото. */}
        <div
          aria-hidden
          className="glow-pulse pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_70%_-10%,rgb(var(--primary)/0.14),transparent),radial-gradient(40%_40%_at_10%_10%,rgb(var(--accent)/0.10),transparent)]"
        />
        <Container className="relative py-16 lg:py-24">
          <div className="max-w-3xl">
            <Reveal
              as="span"
              delay={0}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted"
            >
              <Zap size={13} className="text-primary" /> Платформа нового поколения для печати
            </Reveal>
            <Reveal
              as="h1"
              delay={80}
              className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl"
            >
              Типография в {site.city} — печать полиграфии с{' '}
              <span className="text-gradient">доставкой по России</span>
            </Reveal>
            <Reveal as="p" delay={160} className="mt-5 max-w-2xl text-lg text-muted">
              Визитки, листовки, фотокниги, баннеры и фото на документы. Тираж от 1 шт., срок от 3 часов.
              Рассчитайте стоимость онлайн и закажите без поездок в офис.
            </Reveal>

            <Reveal delay={240} className="mt-7 max-w-xl">
              <SearchForm id="hero-search" />
            </Reveal>

            <Reveal delay={320} className="mt-5 flex flex-wrap gap-3">
              <Button href="/poligrafiya/" size="lg">
                Рассчитать стоимость <ArrowRight size={18} />
              </Button>
              <Button href="/poligrafiya/" size="lg" variant="outline">
                <Zap size={18} /> Срочная печать
              </Button>
              <Button href={site.phone.href} size="lg" variant="ghost">
                <Phone size={18} /> Позвонить
              </Button>
            </Reveal>

            {/* Строка доверия (ТЗ hero): рейтинг, количество заказов, годы работы. */}
            <Reveal delay={400} className="mt-9 flex flex-wrap gap-x-6 gap-y-3">
              {[
                { icon: Star, text: `${site.rating.value} · ${site.rating.count} отзывов` },
                { icon: PackageCheck, text: '50 000+ выполненных заказов' },
                { icon: BadgeCheck, text: '12 лет на рынке' },
                { icon: Zap, text: 'Изготовление от 1 часа' },
              ].map((c) => (
                <span key={c.text} className="inline-flex items-center gap-2 text-sm text-muted">
                  <c.icon size={15} className="text-primary" /> {c.text}
                </span>
              ))}
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Блок 2 — Быстрый доступ к услугам. */}
      <Section>
        <SectionHeading title="Популярные услуги" link={{ label: 'Все услуги', href: '/poligrafiya/' }} />
        {/* Мобила: карусель с автопрокруткой (до первого взаимодействия) — узкие
            высокие карточки, следующая выглядывает из-за края.
            С планшета: bento-сетка — первая карточка витринная (2×2). */}
        <Reveal>
          <MobileCarousel className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 no-scrollbar sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
            {quickServices.map((s, i) => {
              const meta = quickCardMeta[i] ?? quickCardMeta[0];
              const featured = i === 0;
              return (
                <Link
                  key={s.href}
                  href={s.href}
                  className={`lift spotlight card-glow group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-surface p-5 hover:border-primary max-sm:w-[68%] max-sm:shrink-0 max-sm:snap-start sm:p-6 ${
                    featured ? 'sm:col-span-2 lg:row-span-2 lg:p-8' : ''
                  }`}
                >
                  {/* Световое пятно в углу — оживает при наведении. */}
                  <div
                    aria-hidden
                    className={`pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full ${meta.glow} opacity-60 blur-3xl transition-all duration-500 group-hover:scale-125 group-hover:opacity-100`}
                  />
                  {/* Крупная иконка-«водяной знак» — дизайнерский фон карточки. */}
                  <meta.icon
                    aria-hidden
                    size={featured ? 200 : 120}
                    strokeWidth={0.75}
                    className={`pointer-events-none absolute -bottom-8 -right-8 -rotate-12 ${meta.tint} opacity-[0.07] transition-all duration-500 group-hover:-rotate-6 group-hover:scale-105 group-hover:opacity-[0.12]`}
                  />

                  <div className="relative flex items-start justify-between gap-3">
                    <div
                      className={`grid shrink-0 place-items-center rounded-xl ${featured ? 'h-12 w-12 sm:h-14 sm:w-14 sm:rounded-2xl' : 'h-12 w-12'} ${meta.chip} ${meta.tint} transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110`}
                    >
                      <meta.icon size={featured ? 24 : 21} />
                    </div>
                    {featured && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-3 py-1 text-xs font-semibold text-white">
                        <Sparkles size={12} /> Хит
                      </span>
                    )}
                  </div>

                  <div className={`relative mt-6 min-w-0 flex-1 ${featured ? 'sm:mt-auto sm:flex-none sm:pt-14 lg:pt-24' : 'sm:mt-8 sm:flex-none'}`}>
                    {featured && (
                      <div className="mb-4 hidden flex-wrap gap-2 sm:flex">
                        {['Паспорт РФ', 'Загранпаспорт', 'Шенгенская виза', 'СНИЛС'].map((c) => (
                          <span
                            key={c}
                            className="rounded-full border border-border bg-surface-2/80 px-3 py-1 text-xs text-muted"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                    <h3 className={`font-bold group-hover:text-primary ${featured ? 'text-lg sm:text-2xl' : 'text-base sm:text-lg'}`}>
                      {s.title}
                    </h3>
                    <p className={`mt-1 line-clamp-2 text-xs text-muted sm:text-sm ${featured ? 'sm:max-w-md sm:text-base' : ''}`}>
                      {s.desc}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 sm:mt-4 sm:gap-x-4">
                      <span
                        className={`font-extrabold tracking-tight ${featured ? 'text-xl sm:text-3xl' : 'text-lg sm:text-xl'}`}
                      >
                        {s.price}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted">
                        <Clock size={12} className={meta.tint} /> {s.term}
                      </span>
                    </div>
                    <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary sm:mt-5">
                      Рассчитать
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 transition-all duration-300 group-hover:bg-primary group-hover:text-primary-fg">
                        <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </MobileCarousel>
        </Reveal>
      </Section>

      {/* Блок 3 — Как это работает: открытая композиция, призрачные номера,
          линия маршрута прочерчивается при скролле. */}
      <Section className="bg-bg-2">
        <SectionHeading title="Как это работает" />
        <div className="relative">
          {/* Линия маршрута между шагами (desktop, scroll-driven).
              Геометрия привязана к иконкам: top-8 — центр иконки (pt-2 + h-12/2),
              left-10 — центр первой (px-4 + 24), right — центр последней
              (треть сетки с gap-6 минус те же 40px). */}
          <div
            aria-hidden
            className="step-line absolute left-10 right-[calc(33.333%-56px)] top-8 hidden h-px bg-gradient-to-r from-primary via-accent to-primary md:block"
          />
          {/* Мобила: компактный вертикальный таймлайн — линия сквозь иконки. */}
          <div
            aria-hidden
            className="absolute bottom-6 left-6 top-6 w-px bg-gradient-to-b from-primary via-accent to-primary md:hidden"
          />
          <Reveal as="ol" stagger className="grid gap-6 md:grid-cols-3">
            {howItWorks.map((step, i) => {
              const StepIcon = howItWorksIcons[i];
              return (
                <li key={i} className="group relative flex items-start gap-4 md:block md:px-4 md:pt-2">
                  <div className="relative z-10 grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-fg shadow-[0_12px_28px_-12px_rgb(var(--primary)/0.7)] transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110">
                    <StepIcon size={22} />
                  </div>
                  <div className="min-w-0 pt-1 md:pt-0">
                    <h3 className="text-lg font-semibold md:mt-5">{step.title}</h3>
                    <p className="mt-1 max-w-xs text-sm text-muted md:mt-2">{step.text}</p>
                  </div>
                </li>
              );
            })}
          </Reveal>
        </div>
      </Section>

      {/* Блок 4 — Почему выбирают нас (макет): крупные номера 01–03 с пунктами
          + полоса статистики со счётчиками. */}
      <Section>
        <SectionHeading title="Почему выбирают нас" />
        {/* Мобила: карусель с автопрокруткой до первого взаимодействия. */}
        <Reveal>
          <MobileCarousel className="-mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-px-4 px-4 pb-2 no-scrollbar md:mx-0 md:grid md:snap-none md:grid-cols-3 md:gap-8 md:overflow-visible md:px-0 md:pb-0">
          {whyUs.map((w, i) => (
            <div key={w.title} className="group relative max-md:w-[78%] max-md:shrink-0 max-md:snap-start">
              <span
                aria-hidden
                className="block bg-gradient-to-br from-primary to-accent bg-clip-text text-6xl font-extrabold leading-none tracking-tighter text-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-100 sm:text-7xl"
              >
                0{i + 1}
              </span>
              <div
                aria-hidden
                className="mt-4 h-px w-14 bg-gradient-to-r from-primary to-accent transition-all duration-500 group-hover:w-24"
              />
              <h3 className="mt-4 text-xl font-bold">{w.title}</h3>
              <ul className="mt-3 space-y-2">
                {w.points.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-sm text-muted">
                    <BadgeCheck size={16} className="mt-0.5 shrink-0 text-success" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          </MobileCarousel>
        </Reveal>

        {/* Полоса статистики (макет): счётчики оживают при появлении. */}
        <Reveal
          delay={150}
          className="relative mt-12 overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-primary/10 via-surface to-accent/10"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgb(var(--fg)/0.05)_1px,transparent_1.4px)] [background-size:18px_18px] [mask-image:radial-gradient(70%_100%_at_50%_0%,#000,transparent)]"
          />
          <dl className="relative grid grid-cols-2 divide-border lg:grid-cols-4 lg:divide-x">
            {whyUsStats.map((s) => (
              <div key={s.label} className="px-6 py-6 text-center lg:py-8">
                {/* tabnum — цифры фиксированной ширины: пересчёт не дёргает вёрстку (CLS). */}
                <dt className="tabnum text-3xl font-extrabold tracking-tight sm:text-4xl">
                  <StatCounter value={s.value} suffix={s.suffix} decimals={s.decimals} />
                </dt>
                <dd className="mt-1 text-sm text-muted">{s.label}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </Section>

      {/* Блок 5 — Примеры работ (макет): фильтр-чипы + коллаж работ. */}
      <Section className="bg-bg-2">
        <SectionHeading title="Примеры наших работ" link={{ label: 'Все работы', href: '/portfolio/' }} />
        <ExamplesGallery />
      </Section>

      {/* Блок 6 — Рассчитайте стоимость (макет: после примеров, чиповый мини-калькулятор).
          Градиентный фон — на всю ширину экрана. */}
      <section className="relative overflow-hidden border-y border-border bg-gradient-to-br from-primary via-primary to-accent">
        {/* Растр печати и свечение — фактура панели. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.14)_1px,transparent_1.4px)] [background-size:18px_18px] [mask-image:radial-gradient(80%_80%_at_20%_0%,#000,transparent_75%)]"
        />
        <div
          aria-hidden
          className="aurora-b pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgb(255_255_255/0.2),transparent_70%)] blur-2xl"
        />
        <div
          aria-hidden
          className="aurora-a pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgb(255_255_255/0.12),transparent_70%)] blur-2xl"
        />
        <Container className="relative py-12 lg:py-16">
          <Reveal>
            <MiniCalc />
          </Reveal>
          {/* Популярные конфигурации — «стеклянные» чипы на градиенте. */}
          <Reveal as="div" stagger delay={120} className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {popularConfigs.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="group flex items-center justify-between gap-3 rounded-xl border border-primary-fg/20 bg-primary-fg/10 px-4 py-3 text-sm text-primary-fg transition-colors hover:bg-primary-fg/20"
              >
                <span className="min-w-0 truncate">{c.title}</span>
                <span className="flex shrink-0 items-center gap-1.5 font-semibold">
                  {c.price}
                  <ArrowRight
                    size={14}
                    className="-translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                  />
                </span>
              </Link>
            ))}
          </Reveal>
        </Container>
      </section>

      {/* Блок 7 — Отзывы. */}
      <Section className="bg-bg-2">
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold sm:text-3xl">Отзывы клиентов</h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1 text-sm">
            <Star size={15} className="fill-warning text-warning" />
            <strong>{site.rating.value}</strong>
            <span className="text-muted">
              · {site.rating.count} отзывов · {site.rating.source}
            </span>
          </span>
        </div>
        {/* Мобила: карусель с автопрокруткой до первого взаимодействия. */}
        <Reveal>
          <MobileCarousel className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 no-scrollbar md:mx-0 md:grid md:snap-none md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0">
          {reviews.map((r) => (
            <figure
              key={r.name}
              className="lift card-glow relative overflow-hidden rounded-2xl border border-border bg-surface p-5 max-md:w-[82%] max-md:shrink-0 max-md:snap-start"
            >
              {/* Декоративная кавычка. */}
              <Quote
                aria-hidden
                size={72}
                strokeWidth={1}
                className="pointer-events-none absolute -right-3 -top-3 rotate-180 text-primary opacity-[0.08]"
              />
              <div className="relative flex items-center gap-3">
                {/* Аватар с градиентным кольцом. */}
                <span className="rounded-full bg-gradient-to-br from-primary to-accent p-[2px]">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-surface text-sm font-bold text-primary">
                    {r.initials}
                  </span>
                </span>
                <div>
                  <figcaption className="text-sm font-semibold">{r.name}</figcaption>
                  <p className="text-xs text-subtle">{r.date}</p>
                </div>
              </div>
              <div className="relative mt-3 flex gap-0.5 text-warning" aria-label="5 из 5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={14} className="fill-warning" />
                ))}
              </div>
              <blockquote className="relative mt-2 text-sm leading-relaxed text-muted">{r.text}</blockquote>
            </figure>
          ))}
          </MobileCarousel>
        </Reveal>
        {/* Внешняя ссылка на все отзывы (ТЗ главной, блок 7). */}
        <Reveal delay={120} className="mt-8 text-center">
          <a
            href={site.reviewsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-5 text-sm font-semibold text-fg hover:bg-surface-2"
          >
            <Star size={16} className="fill-warning text-warning" /> Читать все отзывы на Яндекс.Картах
          </a>
        </Reveal>
      </Section>

      {/* Блок 9 — Блог: обложки с дуотоном и тематическим водяным знаком. */}
      <Section className="bg-bg-2">
        <SectionHeading title="Полезные статьи" link={{ label: 'Все статьи', href: '/blog/' }} />
        {/* Мобила: карусель БЕЗ автопрокрутки. */}
        <Reveal>
          <MobileCarousel auto={false} className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 no-scrollbar md:mx-0 md:grid md:snap-none md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0">
          {blogPosts.map((post, i) => {
            const CoverIcon = blogCoverIcons[i] ?? FileText;
            const accent = i % 2 === 1;
            return (
              <Link
                key={post.href}
                href={post.href}
                className="lift spotlight card-glow group overflow-hidden rounded-2xl border border-border bg-surface hover:border-primary max-md:w-[78%] max-md:shrink-0 max-md:snap-start"
              >
                <div
                  className={`relative aspect-[16/9] overflow-hidden bg-gradient-to-br ${
                    accent ? 'from-accent/15 via-surface-2 to-bg-2' : 'from-primary/15 via-surface-2 to-bg-2'
                  }`}
                  aria-hidden
                >
                  <CoverIcon
                    size={96}
                    strokeWidth={0.8}
                    className={`absolute -bottom-5 -right-4 -rotate-12 ${accent ? 'text-accent' : 'text-primary'} opacity-20 transition-all duration-500 group-hover:-rotate-6 group-hover:scale-110 group-hover:opacity-30`}
                  />
                  <span
                    className={`absolute left-4 top-4 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      accent ? 'bg-accent/15 text-accent' : 'bg-primary/15 text-primary'
                    }`}
                  >
                    {post.tag}
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="font-semibold group-hover:text-primary">{post.title}</h3>
                  <p className="mt-2 flex items-center justify-between text-xs text-subtle">
                    {post.date}
                    <ArrowRight
                      size={14}
                      className="-translate-x-1 text-primary opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                    />
                  </p>
                </div>
              </Link>
            );
          })}
          </MobileCarousel>
        </Reveal>
      </Section>

      {/* Блок 10 — Для бизнеса (макет): полноширинная тёмная секция с кнопками
          «Оставить заявку» и «Узнать условия». Цвета фиксированы для обеих тем. */}
      <section className="relative overflow-hidden border-y border-border bg-[rgb(10_14_24)] text-[rgb(244_247_250)]">
        <div
          aria-hidden
          className="aurora-b pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgb(var(--accent)/0.22),transparent_70%)] blur-2xl"
        />
        <div
          aria-hidden
          className="aurora-a pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgb(var(--primary)/0.18),transparent_70%)] blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.05)_1px,transparent_1.4px)] [background-size:20px_20px] [mask-image:radial-gradient(70%_90%_at_80%_10%,#000,transparent_75%)]"
        />
        <Container className="relative py-14 lg:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-wide text-accent">
                <Building2 size={14} /> Для бизнеса
              </span>
              <h2 className="mt-4 text-2xl font-bold sm:text-3xl lg:text-4xl">
                Корпоративная печать и работа с{' '}
                <span className="text-gradient">юридическими лицами</span>
              </h2>
              <p className="mt-3 max-w-xl text-[rgb(154_167_189)]">
                Выставляем счёт, работаем с НДС 20%, закрывающие документы — Диадок и СБИС. Персональный
                менеджер и оптовые цены от 10 шт.
              </p>
              <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                {b2bPerks.map((p) => (
                  <li key={p} className="flex items-center gap-2 text-sm text-[rgb(154_167_189)]">
                    <BadgeCheck size={16} className="shrink-0 text-success" /> {p}
                  </li>
                ))}
              </ul>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button href="/dlya-biznesa-b2b/#request" size="lg">
                  Оставить заявку <ArrowRight size={18} />
                </Button>
                <Button
                  href="/dlya-biznesa-b2b/"
                  size="lg"
                  variant="outline"
                  className="border-white/25 text-[rgb(244_247_250)] hover:bg-white/10"
                >
                  Узнать условия
                </Button>
              </div>
            </Reveal>

            {/* CSS-иллюстрация: договор с печатью и закрывающие документы. */}
            <Reveal delay={150} aria-hidden className="relative mx-auto hidden h-72 w-full max-w-sm lg:block">
              <Handshake
                size={220}
                strokeWidth={0.6}
                className="absolute -bottom-6 -right-4 -rotate-6 text-accent opacity-[0.08]"
              />
              <div className="float-b absolute left-4 top-10 h-56 w-44 -rotate-6 rounded-xl border border-white/10 bg-[rgb(19_25_38)] p-4 shadow-[0_32px_64px_-24px_rgb(0_0_0/0.8)]">
                <div className="h-2 w-16 rounded-full bg-[rgb(42_52_71)]" />
                <div className="mt-2.5 space-y-1.5">
                  {[24, 28, 20, 26, 16].map((w, j) => (
                    <div key={j} className="h-1.5 rounded-full bg-[rgb(42_52_71)]" style={{ width: `${w * 4}px` }} />
                  ))}
                </div>
                <div className="mt-4 h-1.5 w-20 rounded-full bg-[rgb(42_52_71)]" />
              </div>
              <div className="float-a absolute right-2 top-0 h-60 w-48 rotate-3 rounded-xl border border-white/10 bg-[rgb(26_34_51)] p-4 shadow-[0_32px_64px_-24px_rgb(0_0_0/0.8)]">
                <div className="h-2 w-24 rounded-full bg-gradient-to-r from-primary to-accent" />
                <div className="mt-3 space-y-1.5">
                  {[30, 24, 28, 18, 26, 22].map((w, j) => (
                    <div key={j} className="h-1.5 rounded-full bg-[rgb(42_52_71)]" style={{ width: `${w * 4}px` }} />
                  ))}
                </div>
                {/* Печать организации */}
                <div className="absolute bottom-4 right-4 grid h-16 w-16 -rotate-12 place-items-center rounded-full border-2 border-accent/50">
                  <div className="grid h-11 w-11 place-items-center rounded-full border border-accent/40 text-[8px] font-bold uppercase tracking-widest text-accent/70">
                    НДС
                  </div>
                </div>
                <div className="absolute bottom-6 left-4 h-1.5 w-16 rounded-full bg-[rgb(42_52_71)]" />
              </div>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Блок 11 — FAQ: две колонки — липкая шапка с мини-CTA + аккордеон. */}
      <Section>
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <SectionHeading title="Частые вопросы" className="mb-3" />
            <p className="max-w-sm text-sm text-muted">
              Собрали ответы о сроках, макетах, доставке и оплате. Не нашли свой — спросите нас напрямую.
            </p>
            <div className="card-glow relative mt-6 overflow-hidden rounded-2xl border border-border bg-surface p-5">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl"
              />
              <p className="relative font-semibold">Остались вопросы?</p>
              <p className="relative mt-1 text-sm text-muted">Ответим за пару минут в рабочее время.</p>
              <div className="relative mt-4 flex flex-wrap gap-2">
                <Button href={site.phone.href} size="sm">
                  <Phone size={15} /> Позвонить
                </Button>
                <Button href="/kontakty/" size="sm" variant="outline">
                  Контакты
                </Button>
              </div>
            </div>
          </div>
          <Faq items={homeFaq} />
        </div>
      </Section>

      {/* Блок 11 — Pre-footer CTA (ТЗ главной). */}
      <section className="border-t border-border bg-bg-2">
        <Container className="flex flex-col items-center gap-5 py-14 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">Рассчитайте стоимость за минуту</h2>
          <p className="max-w-xl text-muted">
            Выберите услугу, укажите параметры — калькулятор сразу покажет цену и дату готовности.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button href="/poligrafiya/" size="lg">
              Рассчитать стоимость <ArrowRight size={18} />
            </Button>
            <Button href={site.phone.href} size="lg" variant="outline">
              <Phone size={18} /> Позвонить
            </Button>
          </div>
        </Container>
      </section>
    </>
  );
}

