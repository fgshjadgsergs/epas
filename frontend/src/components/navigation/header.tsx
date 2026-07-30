import Link from 'next/link';
import { Heart, User } from 'lucide-react';
import { CartButton } from './cart-button';
import { Container } from '@/components/ui/container';
import { Logo } from './logo';
import { SearchForm } from './search-form';
import { DesktopNav } from './mega-menu';
import { MobileMenu } from './mobile-menu';
import { utilityNav, type NavItem } from '@/data/navigation';
import { site } from '@/lib/site';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';

/** Хедер сайта — 3 слоя (ТЗ навигации, п.2, 3.1).
 * Sticky на самом <header> с отрицательным top: утилитарная полоска (h-9)
 * уезжает за экран, основная шапка и навбар остаются закреплёнными.
 * nav — пункты каталога с названиями из backend (см. layout). */
export function Header({ nav }: { nav?: NavItem[] }) {
  return (
    <header role="banner" className="sticky top-0 z-40 lg:-top-9">
      {/* Слой 1 — утилитарная полоска (десктоп). Прокручивается за счёт -top-9. */}
      <div className="hidden border-b border-border bg-bg-2 lg:block">
        <Container className="flex h-9 items-center justify-between text-xs text-muted">
          <span>
            Бесплатная доставка от {site.freeDeliveryFrom.toLocaleString('ru-RU')} ₽ | Самовывоз бесплатно
          </span>
          <span className="hidden xl:block">Изготовление от 1 часа | {site.workHours}</span>
          <nav aria-label="Вспомогательная навигация" className="flex items-center gap-4">
            {utilityNav.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-fg">
                {l.label}
              </Link>
            ))}
          </nav>
        </Container>
      </div>

      {/* Главная шапка + навбар (закреплены вместе с header). */}
      <div className="border-b border-border bg-bg/90 backdrop-blur-md">
        <Container>
          <div className="flex h-16 items-center gap-3 lg:gap-5">
            <MobileMenu nav={nav} />
            <Logo className="shrink-0" />

            <SearchForm className="mx-2 hidden max-w-xl flex-1 md:block" />

            <div className="ml-auto flex items-center gap-1 lg:gap-2">
              <HeaderAction
                href="/programma-loyalnosti/"
                label="Программа лояльности"
                icon={<Heart size={20} />}
                desktopOnly
              />
              <HeaderAction href="/lichnyy-kabinet/" label="Личный кабинет" icon={<User size={20} />} />
              <CartButton />
              <ThemeToggle className="rounded-lg text-fg hover:bg-surface-2" />

              <div className="ml-1 hidden flex-col items-end leading-tight xl:flex">
                <a href={site.phone.href} className="text-sm font-semibold text-fg hover:text-primary">
                  {site.phone.display}
                </a>
                <span className="text-[11px] text-subtle">{site.workHours}</span>
              </div>

              <Button href="/oformlenie-zakaza/" size="md" className="ml-1 hidden lg:inline-flex">
                Заказать сейчас
              </Button>
            </div>
          </div>

          {/* Поиск на мобиле — отдельной строкой. */}
          <div className="pb-3 md:hidden">
            <SearchForm id="header-search-mobile" />
          </div>
        </Container>

        <DesktopNav nav={nav} />
      </div>
    </header>
  );
}

function HeaderAction({
  href,
  label,
  icon,
  desktopOnly,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  desktopOnly?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={`grid h-11 w-11 place-items-center rounded-lg text-fg hover:bg-surface-2 ${desktopOnly ? 'hidden lg:grid' : ''}`}
    >
      {icon}
    </Link>
  );
}
