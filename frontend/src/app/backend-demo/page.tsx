'use client';

import { useEffect, useState } from 'react';
import { Container } from '@/components/ui/container';
import { Section, SectionHeading } from '@/components/ui/section';
import { ApiError } from '@/lib/api/client';
import { getCategories } from '@/lib/api/categories';
import { getServices } from '@/lib/api/services';
import type { Category, Service } from '@/lib/api/types';

/**
 * Временная demo-страница: показывает живые данные из backend (/categories,
 * /services), не трогая статический catalog.ts. Не индексируется, не
 * линкуется из навигации — только для проверки интеграции на демо.
 */
export default function BackendDemoPage() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [services, setServices] = useState<Service[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [categoriesRes, servicesRes] = await Promise.all([
          getCategories({ limit: 50 }),
          getServices({ limit: 50 }),
        ]);
        if (cancelled) return;
        setCategories(categoriesRes.items);
        setServices(servicesRes.items);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Не удалось загрузить данные с backend.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Container className="py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">Demo</h1>
      <p className="mt-2 text-muted">
        Данные из API ({process.env.NEXT_PUBLIC_API_URL ?? 'NEXT_PUBLIC_API_URL не задан'}
        ). Временная страница, не связанная с каталогом.
      </p>

      {loading && <p className="mt-8 text-muted">Загрузка…</p>}

      {error && (
        <p role="alert" className="mt-8 rounded-lg bg-danger/10 px-4 py-3 text-danger">
          {error}
        </p>
      )}

      {!loading && !error && (
        <>
          <Section className="px-0" reveal={false}>
            <SectionHeading title={`Категории (${categories?.length ?? 0})`} />
            {categories && categories.length > 0 ? (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((c) => (
                  <li key={c.id} className="rounded-2xl border border-border bg-surface p-5">
                    <p className="font-semibold">{c.title}</p>
                    <p className="mt-1 text-sm text-muted">slug: {c.slug}</p>
                    {c.description && <p className="mt-2 text-sm text-muted">{c.description}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">Категорий пока нет.</p>
            )}
          </Section>

          <Section className="px-0" reveal={false}>
            <SectionHeading title={`Услуги (${services?.length ?? 0})`} />
            {services && services.length > 0 ? (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {services.map((s) => (
                  <li key={s.id} className="rounded-2xl border border-border bg-surface p-5">
                    <p className="font-semibold">{s.title}</p>
                    <p className="mt-1 text-sm text-muted">slug: {s.slug}</p>
                    {s.priceFrom && <p className="mt-2 text-sm text-fg">от {s.priceFrom} ₽</p>}
                    {s.shortDescription && (
                      <p className="mt-2 text-sm text-muted">{s.shortDescription}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">Услуг пока нет.</p>
            )}
          </Section>
        </>
      )}
    </Container>
  );
}
