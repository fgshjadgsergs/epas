import Link from 'next/link';
import {
  Banknote,
  BookOpen,
  Boxes,
  Building2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  FileCheck2,
  FileText,
  FolderOpen,
  Gift,
  LayoutPanelTop,
  FileSignature,
  MessagesSquare,
  PackageCheck,
  Percent,
  Phone,
  Printer,
  Quote,
  Send,
  Star,
  Tag,
  UserRound,
  UtensilsCrossed,
  Wallet,
  Zap,
} from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Section, SectionHeading } from '@/components/ui/section';
import { Button } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Faq } from '@/components/faq';
import { FaqJsonLd } from '@/components/seo/json-ld';
import { Reveal } from '@/components/reveal';
import { site } from '@/lib/site';
import { faqItems, type SeoPage } from '@/data/seo';
import { getBreadcrumbs, type CatalogNode } from '@/data/catalog';

/** Мини-преимущества под hero. */
const heroPerks = [
  { icon: UserRound, title: 'Персональный менеджер', text: 'Один контакт для всех вопросов.' },
  { icon: CalendarClock, title: 'Постоянным клиентам', text: 'Накопительные скидки и приоритет.' },
  { icon: Boxes, title: 'Оптовые цены', text: 'Выгодно от 10 шт.' },
];

/** Что мы печатаем для бизнеса. */
const products = [
  {
    icon: CreditCard,
    title: 'Фирменные визитки',
    text: 'Стандарт и премиум: ламинация, тиснение, скругление углов.',
    href: '/vizitki/',
  },
  {
    icon: FolderOpen,
    title: 'Брендированные папки и бланки',
    text: 'С логотипом и фирменными цветами по вашему брендбуку.',
    href: '/birki-bejdzi-blanki/',
  },
  {
    icon: Gift,
    title: 'Печать на сувенирах',
    text: 'Кружки, футболки, шопперы, ежедневники, ручки.',
    href: '/suveniry/',
  },
  {
    icon: BookOpen,
    title: 'Корпоративные буклеты и каталоги',
    text: 'Многополосные, на скрепку или пружину, любой тираж.',
    href: '/buklety/',
  },
  {
    icon: Tag,
    title: 'POS-материалы',
    text: 'Воблеры, ценники, шелфтокеры, хардпостеры для точек продаж.',
    href: '/poligrafiya/',
  },
  {
    icon: UtensilsCrossed,
    title: 'Меню для HoReCa',
    text: 'Ламинированные и влагостойкие, с обновлением тиража.',
    href: '/menyu/',
  },
  {
    icon: FileText,
    title: 'Листовки и флаеры для акций',
    text: 'От 100 до 100 000 экземпляров в короткий срок.',
    href: '/listovki/',
  },
  {
    icon: LayoutPanelTop,
    title: 'Выставочные конструкции',
    text: 'Roll-up, press wall, стенды и мобильные стойки.',
    href: '/shirokoformat/',
  },
  {
    icon: CalendarDays,
    title: 'Календари',
    text: 'Карманные, настенные, квартальные и домики.',
    href: '/kalendari/',
  },
];

/** Почему нас выбирает бизнес. */
const whyUs = [
  {
    icon: UserRound,
    title: 'Персональный менеджер',
    text: 'Один менеджер ведёт все ваши заказы и отвечает в рабочее время.',
  },
  {
    icon: FileCheck2,
    title: 'Полный пакет документов',
    text: 'Договор, счёт-фактура и акт. Работаем с НДС 20%.',
  },
  {
    icon: Zap,
    title: 'Срочное производство',
    text: 'Корпоративные заказы в приоритете. Изготовление от 1 часа.',
  },
  {
    icon: Percent,
    title: 'Оптовые цены',
    text: 'Скидки от объёма и накопительные программы для постоянных клиентов.',
  },
];

/** Документы. */
const documents = [
  { title: 'Договор на оказание услуг', text: 'Подписываем рамочный или разовый договор.' },
  { title: 'Счёт на оплату', text: 'Выставляем счёт в течение 15 минут после согласования заказа.' },
  { title: 'Акт выполненных работ и УПД', text: 'Закрывающие документы по завершении заказа.' },
  { title: 'НДС 20%', text: 'Работаем на ОСНО. НДС выделяем отдельной строкой.' },
  { title: 'Электронный документооборот', text: 'Диадок, СБИС или бумажные оригиналы — на ваш выбор.' },
];

/** Способы оплаты. */
const payments = [
  { icon: Banknote, title: 'Безналичный расчёт', text: 'Расчётный счёт' },
  { icon: CreditCard, title: 'Корпоративная карта', text: 'Оплата онлайн' },
  { icon: Clock, title: 'Постоплата', text: 'Для постоянных клиентов' },
  { icon: Wallet, title: 'Наличные в офисе', text: 'С кассовым чеком' },
];

/** Как начать работу. */
const workflow = [
  { icon: Send, title: 'Оставьте заявку', text: 'Заполните форму или позвоните менеджеру.' },
  { icon: MessagesSquare, title: 'Согласуем условия', text: 'Обсудим сроки, тираж и документы.' },
  { icon: FileSignature, title: 'Подпишем договор', text: 'Договор или счёт-оферта, онлайн или в офисе.' },
  { icon: PackageCheck, title: 'Получите заказ', text: 'Доставка по городу и России или самовывоз.' },
];

/** Заявка — мини-преимущества. */
const requestPerks = [
  { icon: FileCheck2, text: 'Бесплатный расчёт' },
  { icon: Clock, text: 'Ответ за 15 минут' },
  { icon: UserRound, text: 'Персональный менеджер' },
];

/** Отзывы корпоративных клиентов. */
const reviews = [
  {
    company: 'ООО «Ромашка»',
    author: 'Иван Петров, маркетинг-директор',
    text: 'Регулярно заказываем визитки и буклеты. Всё строго по документам, НДС без вопросов. Работаем уже 2 года.',
  },
  {
    company: 'ЗАО «Стройгрупп»',
    author: 'Анна Козлова, PR-менеджер',
    text: 'Делали выставочный стенд и баннеры. Качество печати отличное, менеджер помог с макетами.',
  },
  {
    company: 'ИП Смирнов',
    author: 'Дмитрий Смирнов',
    text: 'Заказываем меню для сети кафе. Работаем по ЭДО через Диадок — удобно и быстро.',
  },
];

export function B2BPage({ node, seo }: { node: CatalogNode; seo?: SeoPage }) {
  const h1 = seo?.h1 ?? 'Корпоративная полиграфия и печать для бизнеса';
  const faq = seo?.faq?.length
    ? faqItems(seo.faq)
    : faqItems([
        'Работаете ли по безналичному расчёту?',
        'Можно ли работать без договора?',
        'Как получить документы с НДС?',
        'Есть ли скидки для постоянных клиентов?',
        'Работаете ли по ЭДО?',
        'Какой минимальный заказ для корпоративных клиентов?',
      ]);

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
              <Reveal
                as="span"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium uppercase tracking-wide text-accent"
              >
                <Building2 size={14} /> Для юридических лиц и ИП
              </Reveal>
              <Reveal
                as="h1"
                delay={80}
                className="mt-4 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl"
              >
                {h1}
              </Reveal>
              <Reveal as="p" delay={160} className="mt-4 max-w-xl text-muted">
                {seo?.description ??
                  'Работаем по договору. Счета и закрывающие документы, НДС 20%, ЭДО — Диадок, СБИС, Контур.'}
              </Reveal>
              <Reveal delay={240} className="mt-6 flex flex-wrap gap-3">
                <Button href="#request" size="lg">
                  Оставить заявку
                </Button>
                <Button href="#" size="lg" variant="outline">
                  <Download size={18} /> Скачать прайс-лист
                </Button>
              </Reveal>
            </div>

            {/* Декоративная иллюстрация */}
            <Reveal
              delay={200}
              aria-hidden
              className="relative hidden aspect-[4/3] rounded-3xl border border-border bg-gradient-to-br from-surface to-bg-2 lg:block"
            >
              <div className="absolute inset-0 grid place-items-center">
                <Printer size={112} className="text-accent/70" strokeWidth={1.2} />
              </div>
              <span className="absolute left-6 top-6 inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-xs font-medium shadow-sm">
                <FileCheck2 size={14} className="text-success" /> НДС · ЭДО
              </span>
              <span className="absolute bottom-6 right-6 inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-xs font-medium shadow-sm">
                <Percent size={14} className="text-accent" /> Оптовые цены
              </span>
            </Reveal>
          </div>

          {/* Мини-преимущества */}
          <Reveal delay={320} className="mt-10 grid gap-4 sm:grid-cols-3">
            {heroPerks.map((p) => (
              <div key={p.title} className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
                  <p.icon size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{p.title}</h3>
                  <p className="mt-0.5 text-sm text-muted">{p.text}</p>
                </div>
              </div>
            ))}
          </Reveal>
        </Container>
      </section>

      {/* Что мы печатаем для бизнеса */}
      <Section>
        <SectionHeading title="Что мы печатаем для бизнеса" />
        <Reveal as="div" stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Link
              key={p.title}
              href={p.href}
              className="lift card-glow group flex flex-col rounded-2xl border border-border bg-surface p-5 hover:border-primary"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                <p.icon size={20} />
              </div>
              <h3 className="mt-4 font-semibold group-hover:text-primary">{p.title}</h3>
              <p className="mt-1 flex-1 text-sm text-muted">{p.text}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                Рассчитать <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
              </span>
            </Link>
          ))}
        </Reveal>
        <div className="mt-8 flex justify-center">
          <Button href="/poligrafiya/" size="lg" variant="outline">
            Все услуги для бизнеса
          </Button>
        </div>
      </Section>

      {/* Почему нас выбирает бизнес */}
      <Section className="bg-bg-2">
        <SectionHeading title="Почему нас выбирает бизнес" />
        <Reveal as="div" stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {whyUs.map((w, i) => {
            const accent = i % 2 === 0;
            return (
              <div
                key={w.title}
                className="lift card-glow group relative overflow-hidden rounded-3xl border border-border bg-surface p-6"
              >
                <div
                  aria-hidden
                  className={`pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full ${accent ? 'bg-accent/15' : 'bg-primary/15'} opacity-60 blur-3xl transition-all duration-500 group-hover:scale-125 group-hover:opacity-100`}
                />
                <w.icon
                  aria-hidden
                  size={110}
                  strokeWidth={0.75}
                  className={`pointer-events-none absolute -bottom-7 -right-7 -rotate-12 ${accent ? 'text-accent' : 'text-primary'} opacity-[0.07] transition-all duration-500 group-hover:-rotate-6 group-hover:scale-105 group-hover:opacity-[0.12]`}
                />
                <div className="relative">
                  <span
                    className={`grid h-12 w-12 place-items-center rounded-xl ${accent ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'} transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110`}
                  >
                    <w.icon size={22} />
                  </span>
                  <h3 className="mt-4 font-bold">{w.title}</h3>
                  <p className="mt-1.5 text-sm text-muted">{w.text}</p>
                </div>
              </div>
            );
          })}
        </Reveal>
      </Section>

      {/* Документы и оплата */}
      <Section>
        <SectionHeading title="Документы и оплата" />
        <div className="grid gap-6 lg:grid-cols-2">
          <ul className="space-y-3">
            {documents.map((d) => (
              <li key={d.title} className="flex gap-3 rounded-2xl border border-border bg-surface p-5">
                <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-success" />
                <div>
                  <h3 className="font-semibold">{d.title}</h3>
                  <p className="mt-1 text-sm text-muted">{d.text}</p>
                </div>
              </li>
            ))}
          </ul>

          <aside className="h-fit rounded-2xl border border-border bg-gradient-to-br from-surface to-bg-2 p-6">
            <h3 className="text-lg font-bold">Способы оплаты</h3>
            <ul className="mt-5 space-y-3">
              {payments.map((p) => (
                <li key={p.title} className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <p.icon size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{p.title}</p>
                    <p className="text-xs text-muted">{p.text}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-5 border-t border-border pt-4 text-xs text-muted">
              Реквизиты для оплаты пришлём вместе со счётом от ООО или ИП.
            </p>
          </aside>
        </div>
      </Section>

      {/* Как начать работу */}
      <Section className="bg-bg-2">
        <SectionHeading title="Как начать работу" />
        <Reveal as="ol" stagger className="grid gap-8 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          {workflow.map((s) => (
            <li key={s.title} className="group relative pt-2">
              <span className="relative z-10 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-accent to-primary text-white shadow-[0_12px_28px_-12px_rgb(var(--accent)/0.7)] transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110">
                <s.icon size={22} />
              </span>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{s.text}</p>
            </li>
          ))}
        </Reveal>
        <div className="mt-8 flex justify-center">
          <Button href="#request" size="lg">
            Оставить заявку
          </Button>
        </div>
      </Section>

      {/* Заявка — тёмный CTA с формой */}
      <section id="request" className="scroll-mt-24 border-y border-border bg-[rgb(13_17_28)] text-[rgb(244_247_250)]">
        <Container className="py-14 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <Reveal>
              <h2 className="text-2xl font-bold sm:text-3xl">
                Оставьте заявку — свяжемся в течение 15 минут
              </h2>
              <p className="mt-4 max-w-md text-[rgb(154_167_189)]">
                Опишите, что нужно напечатать. Менеджер рассчитает стоимость и подготовит коммерческое
                предложение с учётом тиража и сроков.
              </p>
              <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-4">
                {requestPerks.map((p) => (
                  <li key={p.text} className="flex items-center gap-2 text-sm">
                    <p.icon size={18} className="text-accent" /> {p.text}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={120}>
              <form
                className="rounded-2xl border border-[rgb(42_52_71)] bg-[rgb(19_25_38)] p-6 lg:p-8"
                aria-label="Заявка на коммерческое предложение"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <DarkField label="Ваше имя" required />
                  <DarkField label="Компания" />
                  <DarkField label="Телефон" required type="tel" />
                  <DarkField label="E-mail" type="email" />
                </div>
                <label className="mt-4 block text-sm">
                  <span className="mb-1.5 block text-[rgb(154_167_189)]">Что нужно напечатать</span>
                  <textarea
                    rows={3}
                    className="w-full rounded-xl border border-[rgb(42_52_71)] bg-[rgb(13_17_28)] px-3 py-2 text-[rgb(244_247_250)] outline-none focus:border-accent"
                  />
                </label>
                <label className="mt-3 flex items-start gap-2 text-sm text-[rgb(154_167_189)]">
                  <input type="checkbox" className="mt-1" />
                  Согласен на обработку персональных данных
                </label>
                {/* Заглушка: реальная отправка + валидация + CSRF — фаза 5. */}
                <Button href="#" className="mt-5 w-full">
                  <Send size={17} /> Отправить заявку
                </Button>
              </form>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Нам доверяют компании */}
      <Section>
        <SectionHeading title="Нам доверяют компании" link={{ label: 'Все отзывы', href: '/portfolio/' }} />
        <Reveal as="div" stagger className="grid gap-4 md:grid-cols-3">
          {reviews.map((r) => (
            <figure
              key={r.company}
              className="card-glow lift relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface p-6"
            >
              <Quote
                aria-hidden
                size={72}
                strokeWidth={1}
                className="pointer-events-none absolute -right-3 -top-3 rotate-180 text-accent opacity-[0.08]"
              />
              <div className="relative flex gap-0.5 text-warning" aria-label="5 из 5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={15} className="fill-warning" />
                ))}
              </div>
              <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-muted">{r.text}</blockquote>
              <figcaption className="mt-4 border-t border-border pt-4">
                <p className="text-sm font-semibold">{r.company}</p>
                <p className="text-xs text-subtle">{r.author}</p>
              </figcaption>
            </figure>
          ))}
        </Reveal>
      </Section>

      {/* FAQ */}
      <Section className="bg-bg-2">
        <SectionHeading title="Вопросы о работе с юридическими лицами" />
        <div className="mx-auto max-w-3xl">
          <Faq items={faq} />
          <div className="mt-8 flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-muted">Не нашли ответ? Задайте вопрос менеджеру.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button href="#request" size="md">
                Задать вопрос менеджеру
              </Button>
              <Button href={site.phone.href} size="md" variant="outline">
                <Phone size={17} /> {site.phone.display}
              </Button>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}

function DarkField({ label, required, type = 'text' }: { label: string; required?: boolean; type?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-[rgb(154_167_189)]">
        {label} {required && '*'}
      </span>
      <input
        type={type}
        className="h-11 w-full rounded-xl border border-[rgb(42_52_71)] bg-[rgb(13_17_28)] px-3 text-[rgb(244_247_250)] outline-none focus:border-accent"
      />
    </label>
  );
}
