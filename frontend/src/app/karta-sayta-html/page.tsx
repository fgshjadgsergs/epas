import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui/container';
import { Reveal } from '@/components/reveal';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { buildMetadata } from '@/lib/seo';
import { mainNav } from '@/data/navigation';
import { footerColumns, legalLinks } from '@/data/footer';
import { getChildren, getNode } from '@/data/catalog';
import { OrganizationJsonLd } from '@/components/seo/json-ld';

// HTML-карта сайта (ТЗ «Общие технические требования», п.10). Индексируется.
export const metadata: Metadata = buildMetadata({
  title: 'Карта сайта',
  description: 'Полный каталог ссылок на все разделы, категории и услуги КИДС-ПРИНТ.',
  path: '/karta-sayta-html/',
});

const sections = [...mainNav.map((n) => n.href), '/poligrafiya/'];

export default function HtmlMap() {
  return (
    <>
      <OrganizationJsonLd />
      <Container>
        <Breadcrumbs
          crumbs={[
            { name: 'Главная', item: '/' },
            { name: 'Карта сайта', item: '/karta-sayta-html/' },
          ]}
        />
      </Container>
      <Container className="pb-14">
        <Reveal as="h1" className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Карта ссылок
        </Reveal>

        <Reveal delay={60} className="mt-8 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {sections.map((slug) => {
            const node = getNode(slug);
            const children = getChildren(slug);
            if (!node) return null;
            return (
              <section key={slug}>
                <h2 className="mb-2 font-bold">
                  <Link href={slug} className="hover:text-primary">
                    {node.name}
                  </Link>
                </h2>
                <ul className="space-y-1.5 text-sm">
                  {children.map((c) => {
                    const sub = getChildren(c.slug);
                    return (
                      <li key={c.slug}>
                        <Link href={c.slug} className="text-muted hover:text-primary">
                          {c.name}
                        </Link>
                        {sub.length > 0 && (
                          <ul className="ml-3 mt-1 space-y-1 border-l border-border pl-3">
                            {sub.map((s) => (
                              <li key={s.slug}>
                                <Link href={s.slug} className="text-subtle hover:text-primary">
                                  {s.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}

          {/* Информационные разделы */}
          {footerColumns.slice(1).map((col) => (
            <section key={col.title}>
              <h2 className="mb-2 font-bold">{col.title}</h2>
              <ul className="space-y-1.5 text-sm">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-muted hover:text-primary">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section>
            <h2 className="mb-2 font-bold">Документы</h2>
            <ul className="space-y-1.5 text-sm">
              {legalLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-muted hover:text-primary">
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/blog/" className="text-muted hover:text-primary">
                  Блог
                </Link>
              </li>
            </ul>
          </section>
        </Reveal>
      </Container>
    </>
  );
}
