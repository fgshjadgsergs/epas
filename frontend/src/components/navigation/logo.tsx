import Link from 'next/link';
import { cn } from '@/lib/utils';
import { site } from '@/lib/site';

/** Текстовый логотип КИДС-ПРИНТ (SVG-лого подставится позже). */
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
        К
      </span>
      <span className={cn('text-lg', white && 'text-white')}>
        КИДС<span className="text-primary">-ПРИНТ</span>
      </span>
    </Link>
  );
}
