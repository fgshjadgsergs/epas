import Link from 'next/link';
import { ArrowRight, Phone } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { Button } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Reveal } from '@/components/reveal';
import { PortfolioGallery } from '@/components/portfolio/portfolio-gallery';
import { site } from '@/lib/site';
import { type SeoPage } from '@/data/seo';
import { getBreadcrumbs, type CatalogNode } from '@/data/catalog';

const STRIP = [
  'Визитки',
  'Листовки',
  'Баннеры',
  'Фотокниги',
  'Наклейки',
  'Календари',
  'Буклеты',
  'Каталоги',
  'Упаковка',
  'Сувениры',
  'Таблички',
  'Этикетки',
];

export function PortfolioPage({ node, seo }: { node: CatalogNode; seo?: SeoPage }) {
  const h1 = seo?.h1 ?? 'Портфолио наших работ';

  return (
    <>
      <div className="relative overflow-hidden">
        <div aria-hidden className="halftone pointer-events-none absolute inset-0" />
        <div
          aria-hidden
          className="aurora-b pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgb(var(--accent)/0.14),transparent_70%)] blur-2xl"
        />
        <Container className="relative">
          <Breadcrumbs crumbs={getBreadcrumbs(node.slug)} />
          <Reveal className="py-6">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{h1}</h1>
            <p className="mt-3 max-w-2xl text-muted">
              {seo?.description ??
                'Примеры выполненных заказов: полиграфия, широкоформат, фотокниги и сувениры. Наведите на работу — увеличьте по клику.'}
            </p>
          </Reveal>
        </Container>
      </div>

      {/* Бегущая лента категорий — чистый CSS, пауза по наведению. */}
      <div className="marquee border-y border-border bg-bg-2 py-3" aria-hidden>
        <div className="marquee-track gap-3">
          {[...STRIP, ...STRIP].map((s, i) => (
            <span
              key={i}
              className="whitespace-nowrap rounded-full border border-border bg-surface px-4 py-1.5 text-sm text-muted"
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      <Section>
        <PortfolioGallery />
      </Section>

      {/* Pre-footer CTA */}
      <section className="border-t border-border">
        <Container className="flex flex-col items-center gap-5 py-14 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">Хотите так же?</h2>
          <p className="max-w-xl text-muted">
            Рассчитайте стоимость онлайн или закажите дизайн — соберём макет и согласуем перед печатью.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button href="/poligrafiya/" size="lg">
              Перейти в каталог <ArrowRight size={18} />
            </Button>
            <Button href={site.phone.href} size="lg" variant="outline">
              <Phone size={18} /> Позвонить
            </Button>
          </div>
          <Link href="/blog/" className="text-sm text-muted hover:text-primary">
            Читать статьи о подготовке макетов →
          </Link>
        </Container>
      </section>
    </>
  );
}
