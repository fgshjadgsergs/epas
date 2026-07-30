'use client';

import { ThemeProvider as NextThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';

/** Тёмная тема (PrintOS) — по умолчанию; светлая — равноправный вариант.
 * «gold» и «gold-light» — временные экспериментальные темы
 * (шампанское золото на чёрном и на тёплом светлом). */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider
      attribute="data-theme"
      defaultTheme="dark"
      themes={['dark', 'light', 'gold', 'gold-light']}
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemeProvider>
  );
}
