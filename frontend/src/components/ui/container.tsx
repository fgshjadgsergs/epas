import { cn } from '@/lib/utils';
import type { ElementType, ReactNode } from 'react';

/** Центрированный контейнер, макс. ширина 1400px (ТЗ навигации, п.2). */
export function Container({
  as: Tag = 'div',
  className,
  children,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  return <Tag className={cn('mx-auto w-full max-w-container px-4 sm:px-6', className)}>{children}</Tag>;
}
