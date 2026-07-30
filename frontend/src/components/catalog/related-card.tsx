import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Camera,
  Clock,
  CreditCard,
  FileText,
  Gift,
  Image as ImageIcon,
  Mail,
  Presentation,
  Printer,
  Sparkles,
  Stamp,
  Sticker,
  Tag,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';

/** Иконка по разделу услуги (из href). */
const ICON_BY_SECTION: [string, LucideIcon][] = [
  ['vizitki', CreditCard],
  ['listovki', FileText],
  ['buklety', BookOpen],
  ['fotoknigi', BookOpen],
  ['foto-na-dokumenty', Camera],
  ['pechat-dokumentov', Printer],
  ['kalendari', CalendarDays],
  ['naklejki', Sticker],
  ['shirokoformat', Presentation],
  ['suveniry', Gift],
  ['pechati-shtampy', Stamp],
  ['fotopechat', ImageIcon],
  ['menyu', UtensilsCrossed],
  ['otkrytki', Mail],
  ['birki', Tag],
];

function iconFor(href: string): LucideIcon {
  const hit = ICON_BY_SECTION.find(([key]) => href.includes(key));
  return hit ? hit[1] : Sparkles;
}

/**
 * Карточка «Смотрите также» в ДНК «Популярных услуг» главной:
 * свечение в углу, водяная иконка, иконка-чип, цена крупно,
 * срок-чип и CTA со стрелкой в круге.
 */
export function RelatedCard({
  name,
  href,
  priceFrom,
  term,
  cta = 'Рассчитать',
  accent = false,
}: {
  name: string;
  href: string;
  priceFrom?: string;
  term?: string;
  cta?: string;
  accent?: boolean;
}) {
  const Icon = iconFor(href);
  return (
    <Link
      href={href}
      className="lift spotlight card-glow group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-surface p-5 hover:border-primary sm:p-6"
    >
      {/* Световое пятно в углу — оживает при наведении. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full ${accent ? 'bg-accent/15' : 'bg-primary/15'} opacity-60 blur-3xl transition-all duration-500 group-hover:scale-125 group-hover:opacity-100`}
      />
      {/* Водяная иконка — фон карточки. */}
      <Icon
        aria-hidden
        size={120}
        strokeWidth={0.75}
        className={`pointer-events-none absolute -bottom-8 -right-8 hidden -rotate-12 sm:block ${accent ? 'text-accent' : 'text-primary'} opacity-[0.07] transition-all duration-500 group-hover:-rotate-6 group-hover:scale-105 group-hover:opacity-[0.12]`}
      />

      <div
        className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-xl ${accent ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'} transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110`}
      >
        <Icon size={21} />
      </div>

      <div className="relative mt-6 sm:mt-8">
        <h3 className="text-lg font-bold leading-snug group-hover:text-primary">{name}</h3>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {priceFrom && <span className="text-xl font-extrabold tracking-tight">{priceFrom}</span>}
          {term && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted">
              <Clock size={12} className={accent ? 'text-accent' : 'text-primary'} /> {term}
            </span>
          )}
        </div>
        <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary sm:mt-5">
          {cta}
          <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 transition-all duration-300 group-hover:bg-primary group-hover:text-primary-fg">
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </span>
      </div>
    </Link>
  );
}
