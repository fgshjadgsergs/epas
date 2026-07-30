import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

/**
 * Кликабельная плитка «Всё портфолио» для сетки примеров работ.
 * Три крупных шеврона «бегут» по кругу (окно из двух горящих),
 * вся плитка — ссылка в портфолио.
 */
export function PortfolioTile({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/portfolio/"
      aria-label="Смотреть всё портфолио"
      className={`lift group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-accent p-6 text-primary-fg shadow-[0_24px_56px_-24px_rgb(var(--primary)/0.6)] ${className}`}
    >
      {/* Растр печати — фактура плитки. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.12)_1px,transparent_1.4px)] [background-size:16px_16px] [mask-image:radial-gradient(80%_80%_at_30%_0%,#000,transparent_75%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -right-12 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgb(255_255_255/0.18),transparent_70%)] blur-2xl"
      />
      <span aria-hidden className="relative flex items-center -space-x-6">
        <ChevronRight size={64} strokeWidth={2.25} className="chev-run" />
        <ChevronRight size={64} strokeWidth={2.25} className="chev-run chev-run-2" />
        <ChevronRight size={64} strokeWidth={2.25} className="chev-run chev-run-3" />
      </span>
      <span className="relative mt-4 text-lg font-bold">Всё портфолио</span>
      <span className="relative mt-0.5 text-sm text-primary-fg/75 transition-transform duration-300 group-hover:translate-x-0.5">
        Смотреть все работы
      </span>
    </Link>
  );
}
