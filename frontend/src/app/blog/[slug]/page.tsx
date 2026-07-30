import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Calendar, Clock } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Button } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { buildMetadata } from '@/lib/seo';
import { OrganizationJsonLd } from '@/components/seo/json-ld';
import { serializeJsonLd } from '@/lib/seo/json-ld';
import { Reveal } from '@/components/reveal';
import { site } from '@/lib/site';
import { blogPosts, getPost } from '@/data/blog';

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return blogPosts.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: Params }): Metadata {
  const post = getPost(params.slug);
  if (!post) return {};
  return buildMetadata({ title: post.title, description: post.excerpt, path: `/blog/${post.slug}/` });
}

export default function Article({ params }: { params: Params }) {
  const post = getPost(params.slug);
  if (!post) notFound();
  const related = blogPosts.filter((p) => p.slug !== post.slug).slice(0, 2);

  return (
    <>
      <OrganizationJsonLd />
      {/* Article Schema.org (ТЗ SEO, п.8) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: post.title,
            description: post.excerpt,
            author: { '@type': 'Organization', name: site.name },
            datePublished: post.isoDate,
            dateModified: post.isoDate,
          }),
        }}
      />
      <Container>
        <Breadcrumbs
          crumbs={[
            { name: 'Главная', item: '/' },
            { name: 'Блог', item: '/blog/' },
            { name: post.title, item: `/blog/${post.slug}/` },
          ]}
        />
      </Container>

      <Container className="pb-14">
        <Reveal as="article" className="mx-auto max-w-2xl">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {post.tag}
          </span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{post.title}</h1>
          <div className="mt-3 flex items-center gap-4 text-sm text-subtle">
            <span className="inline-flex items-center gap-1">
              <Calendar size={14} /> {post.date}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock size={14} /> {post.readingTime}
            </span>
          </div>
          <div
            className="mt-5 aspect-[16/8] rounded-2xl bg-gradient-to-br from-surface-2 to-bg-2"
            aria-hidden
          />

          <div className="mt-7 space-y-4">
            {post.content.map((b, i) =>
              b.type === 'h2' ? (
                <h2 key={i} className="pt-2 text-xl font-bold">
                  {b.text}
                </h2>
              ) : (
                <p key={i} className="leading-relaxed text-muted">
                  {b.text}
                </p>
              ),
            )}
          </div>

          <div className="mt-8 rounded-2xl border border-border bg-surface p-6 text-center">
            <p className="font-semibold">Готовы заказать печать?</p>
            <p className="mt-1 text-sm text-muted">Рассчитайте стоимость онлайн за минуту.</p>
            <Button href="/poligrafiya/" className="mt-4">
              Перейти в каталог <ArrowRight size={16} />
            </Button>
          </div>
        </Reveal>

        {/* Похожие статьи */}
        <div className="mx-auto mt-12 max-w-2xl">
          <h2 className="mb-4 text-lg font-bold">Читайте также</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {related.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}/`}
                className="lift rounded-2xl border border-border bg-surface p-4 hover:border-primary"
              >
                <span className="text-xs font-medium text-primary">{p.tag}</span>
                <p className="mt-1 font-medium">{p.title}</p>
              </Link>
            ))}
          </div>
        </div>
      </Container>
    </>
  );
}
