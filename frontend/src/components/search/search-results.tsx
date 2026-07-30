'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Container } from '@/components/ui/container';
import { Reveal } from '@/components/reveal';
import { SearchForm } from '@/components/navigation/search-form';
import { allSeoPages } from '@/data/seo';
import { getNode } from '@/data/catalog';

export function SearchResults() {
  const q = (useSearchParams().get('q') ?? '').trim();
  const results = q
    ? allSeoPages.filter(
        (p) =>
          p.url !== '/' &&
          getNode(p.url) &&
          (p.name.toLowerCase().includes(q.toLowerCase()) || p.h1.toLowerCase().includes(q.toLowerCase())),
      )
    : [];

  return (
    <Container className="py-10">
      <Reveal as="h1" className="text-3xl font-extrabold tracking-tight">
        Поиск по сайту
      </Reveal>
      <Reveal delay={60} className="mt-5 max-w-xl">
        <SearchForm id="search-page" />
      </Reveal>

      {q && (
        <p className="mt-6 text-muted">
          {results.length > 0
            ? `Найдено по запросу «${q}»: ${results.length}`
            : `По запросу «${q}» ничего не найдено. Попробуйте другой запрос или загляните в каталог.`}
        </p>
      )}

      <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {results.map((r) => (
          <li key={r.url}>
            <Link href={r.url} className="block px-5 py-4 hover:bg-surface-2">
              <span className="font-medium">{r.name}</span>
              <span className="mt-0.5 block text-sm text-muted">{r.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}
