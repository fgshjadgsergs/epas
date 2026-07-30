import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui/container';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { buildMetadata } from '@/lib/seo';
import { Reveal } from '@/components/reveal';
import { getSeo } from '@/data/seo';
import { blogPosts } from '@/data/blog';
import { OrganizationJsonLd } from '@/components/seo/json-ld';

const seo = getSeo('/blog/');
export const metadata: Metadata = buildMetadata({
  title: seo?.title ?? 'Блог',
  description: seo?.description ?? 'Статьи о печати, материалах и подготовке макетов.',
  path: '/blog/',
});

export default function BlogList() {
  return (
    <>
      <OrganizationJsonLd />
      <Container>
        <Breadcrumbs
          crumbs={[
            { name: 'Главная', item: '/' },
            { name: 'Блог', item: '/blog/' },
          ]}
        />
      </Container>
      <Container className="pb-14">
        <Reveal as="h1" className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          {seo?.h1 ?? 'Блог'}
        </Reveal>
        <Reveal as="p" delay={80} className="mt-3 max-w-2xl text-muted">
          Полезные статьи о печати, материалах и подготовке макетов.
        </Reveal>

        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {blogPosts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}/`}
              className="lift group overflow-hidden rounded-2xl border border-border bg-surface hover:border-primary"
            >
              <div className="aspect-[16/9] bg-gradient-to-br from-surface-2 to-bg-2" aria-hidden />
              <div className="p-5">
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                    {post.tag}
                  </span>
                  <span className="text-subtle">
                    {post.date} · {post.readingTime}
                  </span>
                </div>
                <h2 className="mt-2 font-semibold group-hover:text-primary">{post.title}</h2>
                <p className="mt-2 text-sm text-muted">{post.excerpt}</p>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </>
  );
}
