import { Container } from '@/components/ui/container';
import { Section, SectionHeading } from '@/components/ui/section';
import { Button } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Faq } from '@/components/faq';
import { AboutPageJsonLd, ContactPageJsonLd, FaqJsonLd } from '@/components/seo/json-ld';
import { Reveal } from '@/components/reveal';
import { Phone } from 'lucide-react';
import { site } from '@/lib/site';
import { faqItems, type SeoPage } from '@/data/seo';
import { getBreadcrumbs, type CatalogNode } from '@/data/catalog';

export function InfoPage({ node, seo }: { node: CatalogNode; seo?: SeoPage }) {
  const h1 = seo?.h1 ?? node.name;
  const faq = seo?.faq?.length ? faqItems(seo.faq) : [];
  const paragraphs = seo?.seoText ? seo.seoText.split(/(?<=\.)\s+(?=[А-ЯA-Z])/) : [];

  return (
    <>
      {faq.length > 0 && <FaqJsonLd items={faq} />}
      {/* Типовая разметка страниц контактов и «О компании» (ТЗ SEO, п.8). */}
      {node.slug === '/kontakty/' && <ContactPageJsonLd />}
      {node.slug === '/o-kompanii/' && <AboutPageJsonLd />}
      <Container>
        <Breadcrumbs crumbs={getBreadcrumbs(node.slug)} />
        <Reveal className="py-6">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{h1}</h1>
          {seo?.description && <p className="mt-4 max-w-2xl text-muted">{seo.description}</p>}
        </Reveal>
      </Container>

      <Section className="pt-0">
        <div className="mx-auto max-w-3xl">
          {paragraphs.length > 0 ? (
            <div className="space-y-6">
              {seo?.h2?.map((h, i) => (
                <div key={h}>
                  <h2 className="mb-2 text-xl font-bold">{h}</h2>
                  <p className="text-muted">{paragraphs[i] ?? paragraphs[paragraphs.length - 1]}</p>
                </div>
              ))}
              {(!seo?.h2 || seo.h2.length === 0) &&
                paragraphs.map((p, i) => (
                  <p key={i} className="text-muted">
                    {p}
                  </p>
                ))}
            </div>
          ) : (
            // Заглушка для разделов, реализуемых позже (корзина, ЛК, оформление — фаза 5).
            <div className="rounded-2xl border border-border bg-surface p-8 text-center">
              <p className="text-lg font-semibold">Раздел «{node.name}» в разработке</p>
              <p className="mt-2 text-muted">
                Этот раздел появится на следующем этапе. Сейчас можно перейти в каталог услуг или связаться с
                нами.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Button href="/poligrafiya/">Каталог услуг</Button>
                <Button href={site.phone.href} variant="outline">
                  <Phone size={18} /> Позвонить
                </Button>
              </div>
            </div>
          )}
        </div>
      </Section>

      {faq.length > 0 && (
        <Section className="bg-bg-2 pt-0">
          <SectionHeading title="Частые вопросы" />
          <div className="mx-auto max-w-3xl">
            <Faq items={faq} />
          </div>
        </Section>
      )}
    </>
  );
}
