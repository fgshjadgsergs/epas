'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * «Поделиться расчётом» (ТЗ «URL-адреса в калькуляторах»).
 * Копирует актуальный URL конфигурации: getUrl() сериализует состояние
 * немедленно (не ждёт debounce-pushState). Fallback для сред без
 * Clipboard API — скрытый textarea + execCommand('copy').
 * Статус объявляется через aria-live (доступно с клавиатуры и для SR).
 */
export function ShareButton({ getUrl, className }: { getUrl?: () => string; className?: string }) {
  const [status, setStatus] = useState<'idle' | 'ok' | 'fail'>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  const copy = async () => {
    const url = getUrl?.() ?? window.location.href;
    const absolute = url.startsWith('http') ? url : window.location.origin + url;
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(absolute);
        ok = true;
      }
    } catch {
      /* переходим к fallback */
    }
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = absolute;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    setStatus(ok ? 'ok' : 'fail');
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setStatus('idle'), 2500);
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        type="button"
        onClick={copy}
        data-share
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-3.5 text-sm font-medium text-fg transition-colors hover:border-primary/50 hover:text-primary"
      >
        Поделиться расчётом
      </button>
      <span aria-live="polite" className="text-xs text-muted">
        {status === 'ok' && 'Ссылка скопирована'}
        {status === 'fail' && 'Не удалось скопировать — скопируйте адрес из строки браузера'}
      </span>
    </div>
  );
}
