'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Phone } from 'lucide-react';
import { mainNav, type NavItem } from '@/data/navigation';
import { site } from '@/lib/site';
import { cn } from '@/lib/utils';
import { Container } from '@/components/ui/container';

/**
 * Десктопный навбар + мегаменю (ТЗ навигации, п.4.1).
 * - Открытие: только клик / Enter / Space по пункту (наведение не открывает).
 * - Закрытие: повторный клик, клик по ссылке панели, клик вне, Escape.
 * - Одновременно открыто не более одного.
 * - Все ссылки всегда в DOM; видимость — через CSS (требование SEO).
 *
 * nav приходит из layout (этап 3): названия пунктов — из backend-категорий,
 * когда те есть в БД; статический mainNav — фолбэк.
 */
export function DesktopNav({ nav = mainNav }: { nav?: NavItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  const close = useCallback(() => setOpenId(null), []);

  // Клик вне хедера и Escape — закрывают мегаменю.
  useEffect(() => {
    if (!openId) return;
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenId(null);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [openId]);

  return (
    <nav
      ref={navRef}
      aria-label="Основная навигация"
      className="relative hidden border-t border-border bg-bg lg:block"
    >
      <Container>
        <ul className="flex items-stretch gap-1">
          {nav.map((item) => (
            <NavBarItem
              key={item.id}
              item={item}
              isOpen={openId === item.id}
              onToggle={() => setOpenId((cur) => (cur === item.id ? null : item.id))}
            />
          ))}
        </ul>
      </Container>

      {/* Панели мегаменю — все в DOM, активная показывается через CSS. */}
      {nav.map((item) =>
        item.mega ? (
          <MegaPanel key={item.id} item={item} isOpen={openId === item.id} onNavigate={close} />
        ) : null,
      )}
    </nav>
  );
}

function NavBarItem({
  item,
  isOpen,
  onToggle,
}: {
  item: NavItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const featured = item.featured;

  if (!item.mega) {
    return (
      <li>
        <Link
          href={item.href}
          className={cn(
            'flex h-12 items-center px-3 text-sm font-medium text-fg/90 hover:text-fg',
            featured && 'text-accent',
          )}
        >
          {item.label}
        </Link>
      </li>
    );
  }

  // aria-expanded — только на кнопке-триггере: роль listitem его не поддерживает.
  return (
    <li className="flex">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls={`mega-${item.id}`}
        onClick={onToggle}
        className={cn(
          'flex h-12 items-center gap-1 px-3 text-sm font-medium transition-colors',
          isOpen ? 'text-primary' : 'text-fg/90 hover:text-fg',
          featured && 'my-2 ml-1 rounded-lg bg-accent/15 px-3 text-accent hover:bg-accent/25',
        )}
      >
        {item.label}
        <ChevronDown aria-hidden size={15} className={cn('transition-transform', isOpen && 'rotate-180')} />
      </button>
    </li>
  );
}

function MegaPanel({
  item,
  isOpen,
  onNavigate,
}: {
  item: NavItem;
  isOpen: boolean;
  /** Закрыть панель при переходе по ссылке (хедер не размонтируется при навигации). */
  onNavigate: () => void;
}) {
  const mega = item.mega!;
  return (
    <div
      id={`mega-${item.id}`}
      role="region"
      aria-label={item.label}
      aria-hidden={!isOpen}
      className={cn(
        'absolute left-0 right-0 top-full z-40 border-b border-border bg-bg-2 shadow-pop transition-[opacity,transform] duration-150',
        isOpen ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-1 opacity-0',
      )}
    >
      <Container className="py-6">
        <p className="mb-5 text-sm font-medium text-muted">{mega.heading}</p>
        <div className="grid grid-cols-4 gap-6">
          {mega.groups.map((group) => (
            <div key={group.title}>
              <h3 className="mb-3 text-sm font-semibold text-fg">{group.title}</h3>
              <ul className="space-y-2">
                {group.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      tabIndex={isOpen ? undefined : -1}
                      onClick={onNavigate}
                      className={cn(
                        'text-sm text-muted transition-colors hover:text-primary',
                        link.label.startsWith('→') && 'font-medium text-primary/90',
                        link.highlight && 'font-semibold text-accent hover:text-accent',
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Промо-блок (правая колонка). */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <p className="mb-4 text-sm text-fg">{mega.promo.text}</p>
            <Link
              href={mega.promo.ctaHref}
              tabIndex={isOpen ? undefined : -1}
              onClick={onNavigate}
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
              {mega.promo.ctaLabel}
            </Link>
          </div>
        </div>

        {/* Нижняя строка-подсказка. */}
        <div className="mt-5 border-t border-border pt-4 text-sm text-muted">
          Не нашли нужное?{' '}
          <a
            href={site.phone.href}
            className="inline-flex items-center gap-1 font-medium text-fg hover:text-primary"
          >
            <Phone aria-hidden size={14} /> {site.phone.display}
          </a>
        </div>
      </Container>
    </div>
  );
}
