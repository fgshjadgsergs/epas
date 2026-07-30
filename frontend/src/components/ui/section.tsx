import { cn } from '@/lib/utils';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Container } from './container';
import { Reveal } from '@/components/reveal';

/** Секция страницы с вертикальными отступами и появлением при скролле. */
export function Section({
  className,
  children,
  id,
  reveal = true,
}: {
  className?: string;
  children: ReactNode;
  id?: string;
  reveal?: boolean;
}) {
  return (
    <section id={id} className={cn('py-12 lg:py-16', className)}>
      <Container>{reveal ? <Reveal>{children}</Reveal> : children}</Container>
    </section>
  );
}

/** Заголовок секции + опциональная ссылка «смотреть все». */
export function SectionHeading({
  title,
  link,
  className,
}: {
  title: string;
  link?: { label: string; href: string };
  className?: string;
}) {
  return (
    <div className={cn('mb-8 flex items-end justify-between gap-4', className)}>
      <h2 className="relative text-2xl font-bold tracking-tight sm:text-3xl">
        {/* Градиентный акцент-штрих слева от заголовка. */}
        <span
          aria-hidden
          className="mr-3 inline-block h-6 w-1.5 translate-y-0.5 rounded-full bg-gradient-to-b from-primary to-accent align-middle sm:h-7"
        />
        {title}
      </h2>
      {link && (
        <Link
          href={link.href}
          className="group shrink-0 text-sm font-medium text-primary hover:underline"
        >
          {link.label}{' '}
          <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
        </Link>
      )}
    </div>
  );
}
