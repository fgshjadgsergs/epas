'use client';

import { ThemeProvider as NextThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';

/** Две темы «Чернила и бумага»: маджента + циан (краски печатной машины)
 * на чернильном и тёпло-бумажном фоне. Тёмная — по умолчанию. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider
      attribute="data-theme"
      defaultTheme="dark"
      themes={['dark', 'light']}
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemeProvider>
  );
}
