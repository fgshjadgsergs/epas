import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/lib/auth/auth-context';
import { Header } from '@/components/navigation/header';
import { Footer } from '@/components/navigation/footer';
import { mainNav } from '@/data/navigation';
import { fetchCategories, overlayNav } from '@/lib/catalog/remote';
import { CursorFX } from '@/components/fx/cursor-fx';
import { Metrika } from '@/components/analytics/metrika';
import { SiteJsonLd } from '@/components/seo/json-ld';
import { site } from '@/lib/site';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: `${site.tagline} ${site.name} — печать с доставкой по России`,
  description: site.description,
  applicationName: site.name,
  formatDetection: { telephone: true },
  openGraph: { siteName: site.name, locale: site.locale, type: 'website' },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Этап 3: названия каталожных пунктов навигации — из backend-категорий
  // (ISR 5 мин); структура меню и мегапанели остаются статическими.
  const nav = overlayNav(mainNav, await fetchCategories());
  return (
    <html lang="ru" suppressHydrationWarning className={inter.variable}>
      <body className="flex min-h-screen flex-col">
        <ThemeProvider>
          <AuthProvider>
          {/* Полоса прогресса прокрутки — чистый CSS (scroll-driven), без JS. */}
          <div className="scroll-progress" aria-hidden />
          {/* Курсор-реактивные эффекты (.spotlight/.tilt) — один passive-слушатель. */}
          <CursorFX />
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:font-medium focus:text-primary-fg"
          >
            К основному содержимому
          </a>
          <SiteJsonLd />
          <Metrika />
          <Header nav={nav} />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
