"use client";

import { Building2, Home, Phone, Search, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { FiltersSheet } from "./filters-sheet";
import { SearchSheet } from "./search-sheet";

const PHONE_HREF = "tel:+79990016588";

/**
 * Нижняя панель как в мобильном приложении. Видна только на мобильных,
 * на всех публичных страницах: главная и каталог — навигация, поиск и
 * фильтры — шторки, звонок — сразу набор номера.
 */
export function MobileActionBar() {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const isHome = pathname === "/";
  const isListing = pathname.startsWith("/listing");

  return (
    <>
      <nav className="app-bottom-bar" aria-label="Быстрые действия">
        <Link href="/" className={`app-bottom-bar__item${isHome ? " is-active" : ""}`}>
          <Home aria-hidden="true" />
          <span>Главная</span>
        </Link>

        <Link href="/listing" className={`app-bottom-bar__item${isListing ? " is-active" : ""}`}>
          <Building2 aria-hidden="true" />
          <span>Каталог</span>
        </Link>

        <button type="button" className="app-bottom-bar__item" onClick={() => setSearchOpen(true)}>
          <Search aria-hidden="true" />
          <span>Поиск</span>
        </button>

        <button type="button" className="app-bottom-bar__item" onClick={() => setFiltersOpen(true)}>
          <Settings aria-hidden="true" />
          <span>Фильтры</span>
        </button>

        <a href={PHONE_HREF} className="app-bottom-bar__item app-bottom-bar__item--call">
          <Phone aria-hidden="true" />
          <span>Звонок</span>
        </a>
      </nav>

      <SearchSheet open={searchOpen} onClose={() => setSearchOpen(false)} />
      <FiltersSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </>
  );
}
