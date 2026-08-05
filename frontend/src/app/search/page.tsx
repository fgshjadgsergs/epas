import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SearchResults } from '@/components/search/search-results';

// Результаты поиска не индексируются.
export const metadata: Metadata = {
  title: 'Поиск по сайту — ПРИНТЕРА',
  robots: { index: false, follow: true },
};

export default function SearchPage() {
  return (
    <Suspense>
      <SearchResults />
    </Suspense>
  );
}
