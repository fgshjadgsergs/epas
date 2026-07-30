import Link from 'next/link';
import { ArrowRight, Calculator, Download, LayoutGrid, Phone, Upload } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Section, SectionHeading } from '@/components/ui/section';
import { Button } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Faq } from '@/components/faq';
import { FaqJsonLd, ItemListJsonLd } from '@/components/seo/json-ld';
import { ReadMore } from '@/components/read-more';
import { Reveal } from '@/components/reveal';
import { CategoryListing } from '@/components/catalog/category-listing';
import { WhyUsShowcase } from '@/components/catalog/why-us-showcase';
import { PortfolioTile } from '@/components/catalog/portfolio-tile';
import { RelatedCard } from '@/components/catalog/related-card';
import { deriveFacets } from '@/lib/catalog/facets';
import { site } from '@/lib/site';
import { faqItems, type SeoPage } from '@/data/seo';
import { getBreadcrumbs, getRelatedSections, type CatalogNode } from '@/data/catalog';

export function CategoryPage({
  node,
  seo,
  items,
}: {
  node: CatalogNode;
  seo?: SeoPage;
  items: CatalogNode[];
}) {
  const h1 = seo?.h1 ?? node.name;
  const intro = seo?.description ?? `${node.name} — онлайн-расчёт и заказ с доставкой по России.`;
  const faq = seo?.faq?.length ? faqItems(seo.faq) : [];
  const nameLower = node.name.toLowerCase();
  const related = getRelatedSections(node.slug);
  const paragraphs = seo?.seoText ? seo.seoText.split(/(?<=\.)\s+(?=[А-ЯA-Z])/) : [];

  const steps = [
    { icon: LayoutGrid, title: 'Выберите вид', text: `Подберите подходящий вид: ${nameLower} — в каталоге выше.` },
    { icon: Calculator, title: 'Рассчитайте стоимость', text: 'Укажите тираж, бумагу, ламинацию и срок в калькуляторе.' },
    { icon: Upload, title: 'Загрузите макет и оплатите', text: 'PDF/AI/CDR, CMYK, вылеты 2 мм — или закажите дизайн.' },
  ];

  return (
    <>
      {faq.length > 0 && <FaqJsonLd items={faq} />}
      {/* ItemList — список услуг категории (ТЗ SEO, п.8). */}
      {items.length > 0 && (
        <ItemListJsonLd
          name={node.name}
          items={items.map((c) => ({
            name: c.name,
            url: c.slug,
            price: c.priceFrom?.match(/\d[\d\s]*/)?.[0]?.replace(/\s/g, ''),
          }))}
        />
      )}
      <Container>
        <Breadcrumbs crumbs={getBreadcrumbs(node.slug)} />
      </Container>

      {/* Hero категории: растр печати, аврора и перспективная сетка — глубина сцены. */}
      <section className="relative overflow-hidden border-b border-border bg-bg-2">
        <div aria-hidden className="halftone pointer-events-none absolute inset-0" />
        <div
          aria-hidden
          className="aurora-b pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgb(var(--accent)/0.14),transparent_70%)] blur-2xl"
        />
        <div aria-hidden className="hero-grid pointer-events-none absolute inset-x-[-10%] bottom-[-30%] h-[80%]" />
        <Container className="relative py-10 lg:py-14">
          <Reveal as="h1" className="max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl">
            {h1}
          </Reveal>
          <Reveal as="p" delay={80} className="mt-4 max-w-2xl text-muted">
            {intro}
          </Reveal>
          <Reveal delay={160} className="mt-6 flex flex-wrap gap-3">
            <Button href="#services" size="lg">
              Выбрать услугу <ArrowRight size={18} />
            </Button>
            <Button href={site.phone.href} size="lg" variant="outline">
              <Phone size={18} /> Позвонить
            </Button>
          </Reveal>
        </Container>
      </section>

      {/* Виды — карточки подтипов (макет: ряд карточек под hero). */}
      {items.length > 0 && (
        <Section>
          <SectionHeading title={seo?.h2?.[0] ?? `Виды: ${nameLower}`} />
          <Reveal as="div" stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((c) => (
              <Link
                key={c.slug}
                href={c.slug}
                className="lift card-glow group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface hover:border-primary"
              >
                <div className="aspect-[4/3] bg-gradient-to-br from-surface-2 to-bg-2" aria-hidden />
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="font-semibold group-hover:text-primary">{c.name}</h3>
                  {c.priceFrom && <p className="mt-1 text-sm font-semibold text-fg">{c.priceFrom}</p>}
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Рассчитать
                    <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            ))}
          </Reveal>
        </Section>
      )}

      {/* Листинг с фильтром (Тираж/Бумага/Ламинация/Срок) и сортировкой. */}
      <Section id="services" className="scroll-mt-24 bg-bg-2">
        <SectionHeading title="Все услуги раздела" />
        {items.length > 0 ? (
          <CategoryListing items={items.map(deriveFacets)} />
        ) : (
          <p className="text-muted">Услуги раздела скоро появятся. Позвоните — подберём решение.</p>
        )}
      </Section>

      {/* Почему заказывают … у нас — интерактивная витрина: панель активного
          преимущества + список с автопереключением и прогресс-баром. */}
      <Section>
        <SectionHeading title={`Почему заказывают ${nameLower} у нас`} />
        <WhyUsShowcase />
      </Section>

      {/* Примеры наших работ: крупные карточки под реальные фото + кликабельная
          плитка «Всё портфолио» справа с бегущими шевронами. */}
      <Section className="bg-bg-2">
        <SectionHeading title="Примеры наших работ" />
        <Reveal as="div" stagger className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="lift aspect-square rounded-2xl border border-border bg-gradient-to-br from-surface-2 to-bg-2"
              aria-hidden
            />
          ))}
          <PortfolioTile className="row-span-2 md:col-start-4" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={`b-${i}`}
              className="lift aspect-square rounded-2xl border border-border bg-gradient-to-br from-surface-2 to-bg-2"
              aria-hidden
            />
          ))}
        </Reveal>
      </Section>

      {/* Как заказать онлайн + требования к макету. */}
      <Section>
        <SectionHeading title={`Как заказать ${nameLower} онлайн`} />
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <Reveal as="ol" stagger className="grid gap-8 sm:grid-cols-3 sm:gap-4">
            {steps.map((s, i) => (
              <li key={i} className="group relative pt-2">
                <span className="relative z-10 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-fg shadow-[0_12px_28px_-12px_rgb(var(--primary)/0.7)] transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110">
                  <s.icon size={22} />
                </span>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted">{s.text}</p>
              </li>
            ))}
          </Reveal>
          <aside className="rounded-2xl border border-border bg-surface p-6">
            <h3 className="font-bold">Требования к макету</h3>
            <ul className="mt-3 space-y-1.5 text-sm text-muted">
              <li>• Цветовая модель CMYK</li>
              <li>• Разрешение 300 dpi</li>
              <li>• Вылеты 2 мм с каждой стороны</li>
              <li>• Шрифты в кривых</li>
            </ul>
            <Button href="/trebovaniya-k-maketam/" size="sm" variant="outline" className="mt-4">
              <Download size={15} /> Скачать шаблон
            </Button>
          </aside>
        </div>
      </Section>

      {/* SEO-текст + FAQ (макет: две колонки). */}
      {(paragraphs.length > 0 || faq.length > 0) && (
        <Section className="bg-bg-2">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
            {paragraphs.length > 0 && (
              <div>
                <h2 className="mb-4 text-2xl font-bold">Подробнее о разделе</h2>
                <ReadMore>
                  <div className="space-y-3 text-muted">
                    {paragraphs.map((p, i) => (
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

      {/* Смотрите также — смежные разделы (крупные карточки). */}
      {related.length > 0 && (
        <Section>
          <SectionHeading title="Смотрите также" />
          <Reveal as="div" stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r, i) => (
              <RelatedCard key={r.slug} name={r.name} href={r.slug} priceFrom={r.priceFrom} term={r.term} accent={i % 2 === 1} />
            ))}
          </Reveal>
        </Section>
      )}
    </>
  );
}
