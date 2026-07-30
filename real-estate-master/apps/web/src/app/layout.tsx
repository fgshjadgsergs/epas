import type { Metadata } from "next";
import Script from "next/script";
import { ReactNode } from "react";
import { QueryProvider } from "@/components/providers/query-provider";
import "./globals.css";


export const metadata: Metadata = {
  title: {
    default: "EPAS Development",
    template: "%s - EPAS Development",
  },
  description: "Аренда и продажа коммерческой недвижимости в Москве",
  icons: {
    icon: "/static/img/site-favicon.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Палитра применяется до первой отрисовки — иначе страница
            мигает темой по умолчанию. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var t=localStorage.getItem("epas-theme");if(t&&t!=="night")document.documentElement.setAttribute("data-theme",t)}catch(e){}',
          }}
        />
        {/* Шрифты захостены локально: Google Fonts из РФ нестабилен и
            блокирует первый рендер, а DM Serif Display не имеет кириллицы. */}
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href="/static/fonts/local/inter-400-cyrillic.woff2"
          crossOrigin=""
        />
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href="/static/fonts/local/manrope-800-cyrillic.woff2"
          crossOrigin=""
        />
        <link rel="stylesheet" href="/static/css/fonts-local.css" />
        <link rel="stylesheet" href="/static/fonts/flaticon/flaticon.css" />
        <link rel="stylesheet" href="/static/css/swiper-bundle.min.css" />
        <link rel="stylesheet" href="/static/css/discoverize-default.css" />
        <link rel="stylesheet" href="/static/css/cards.css" />
        <link rel="stylesheet" href="/static/css/redesign.css" />
      </head>
      <body>
        <QueryProvider>{children}</QueryProvider>
        <Script src="/static/js/bootstrap.bundle.min.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}

