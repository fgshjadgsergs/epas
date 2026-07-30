'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

/** Сворачивает длинный контент, раскрывается по кнопке (ТЗ: «Читать далее»). */
export function ReadMore({
  children,
  collapsedHeight = 120,
}: {
  children: React.ReactNode;
  collapsedHeight?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div
        className={cn('relative overflow-hidden transition-[max-height] duration-300')}
        style={{ maxHeight: open ? 2000 : collapsedHeight }}
      >
        {children}
        {!open && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-bg to-transparent" />
        )}
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-3 text-sm font-medium text-primary hover:underline"
      >
        {open ? 'Свернуть' : 'Читать далее'}
      </button>
    </div>
  );
}
