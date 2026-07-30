import type { Metadata } from 'next';
import { Container } from '@/components/ui/container';
import { Button } from '@/components/ui/button';
import { SearchForm } from '@/components/navigation/search-form';

// Кастомная 404 с навигацией и поиском, БЕЗ noindex (ТЗ требований, п.4).
export const metadata: Metadata = { title: 'Страница не найдена — КИДС-ПРИНТ' };

export default function NotFound() {
  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="text-7xl font-extrabold text-primary">404</p>
      <h1 className="mt-4 text-2xl font-bold">Страница не найдена</h1>
      <p className="mt-2 max-w-md text-muted">
        Возможно, страница была перемещена или удалена. Попробуйте найти нужное через поиск или вернитесь на
        главную.
      </p>
      <div className="mt-6 w-full max-w-md">
        <SearchForm id="search-404" />
      </div>
      <div className="mt-5 flex gap-3">
        <Button href="/">На главную</Button>
        <Button href="/poligrafiya/" variant="outline">
          Каталог услуг
        </Button>
      </div>
    </Container>
  );
}
