import Link from 'next/link';
import { cn } from '@/lib/utils';
import { site } from '@/lib/site';

/**
 * Текстовый вордмарк: «ПРИНТ» + акцентное «ЕРА» (SVG-лого подставится позже).
 * Вынесен отдельно, чтобы шапка и мобильное меню писали название одинаково.
 */
export function Wordmark({ className, white }: { className?: string; white?: boolean }) {
  return (
    <span className={cn(className, white && 'text-white')}>
      ПРИНТ<span className="text-primary">ЕРА</span>
    </span>
  );
}

/** Текстовый логотип ПРИНТЕРА (SVG-лого подставится позже). */
export function Logo({ className, white }: { className?: string; white?: boolean }) {
  return (
    <Link
      href="/"
      aria-label={`${site.name} — на главную`}
      className={cn('inline-flex items-center gap-2 font-bold tracking-tight', className)}
    >
      <span
        aria-hidden
        className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-fg text-sm font-black"
      >
        П
      </span>
      <Wordmark className="text-lg" white={white} />
    </Link>
  );
}
