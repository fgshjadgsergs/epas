'use client';

import Script from 'next/script';
import { useEffect } from 'react';
import { trackGoal } from '@/lib/analytics/yandex-metrika';
import { site } from '@/lib/site';

const COUNTER_ID =
  Number(process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID ?? '') || site.yandexMetrikaId || 0;

/**
 * Загрузчик Яндекс.Метрики + цели по кликам (ТЗ «Общие технические
 * требования», аналитика): phone_click — клик по любой ссылке tel:,
 * whatsapp_click — по ссылке на WhatsApp. Без счётчика (env не задан)
 * скрипт не подключается, слушатель работает как no-op через trackGoal.
 */
export function Metrika() {
  // Один делегированный слушатель на документ — ловит и ссылки,
  // добавленные после гидратации.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const a = target?.closest?.('a[href]');
      if (!a) return;
      const href = a.getAttribute('href') ?? '';
      if (href.startsWith('tel:')) trackGoal('phone_click');
      else if (/wa\.me|whatsapp/i.test(href)) trackGoal('whatsapp_click');
    };
    document.addEventListener('click', onClick, { capture: true, passive: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);

  if (!COUNTER_ID) return null;

  return (
    <Script id="yandex-metrika" strategy="afterInteractive">
      {`(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
m[i].l=1*new Date();
for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
ym(${COUNTER_ID}, "init", {clickmap:true, trackLinks:true, accurateTrackBounce:true});`}
    </Script>
  );
}
