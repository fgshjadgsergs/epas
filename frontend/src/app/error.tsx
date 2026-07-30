'use client';

import { useEffect } from 'react';
import { Container } from '@/components/ui/container';
import { Button } from '@/components/ui/button';

// Глобальный обработчик ошибок рендера (страница 500).
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // На проде — отправка в Sentry (ТЗ инфраструктуры, п.17).
    console.error(error);
  }, [error]);

  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="text-7xl font-extrabold text-danger">500</p>
      <h1 className="mt-4 text-2xl font-bold">Что-то пошло не так</h1>
      <p className="mt-2 max-w-md text-muted">
        Произошла техническая ошибка. Мы уже знаем о ней. Попробуйте обновить страницу или вернитесь на
        главную.
      </p>
      <div className="mt-6 flex gap-3">
        <Button onClick={reset}>Обновить</Button>
        <Button href="/" variant="outline">
          На главную
        </Button>
      </div>
    </Container>
  );
}
