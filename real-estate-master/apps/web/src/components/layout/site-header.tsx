import Link from "next/link";

function createListingHref(dealType: string, title: string): string {
  const params = new URLSearchParams({
    deal_type: dealType,
    title,
  });

  return `/listing?${params.toString()}`;
}

/**
 * Шапка сайта. Бургер-меню убрано: на мобильных навигацию и действия
 * закрывает нижняя панель приложения, в шапке остаются логотип и «Заявка».
 */
export function SiteHeader() {
  return (
    <header className="header">
      <div className="header__inner container-xl">
        <Link href="/" className="header__logo">
          <span className="header__logo-mark">Эпас</span>
          <span className="header__logo-text">Девелопмент</span>
        </Link>

        <nav className="header__nav" aria-label="Навигация">
          <Link className="header__link" href={createListingHref("аренда", "Аренда")}>
            Аренда
          </Link>
          <Link className="header__link" href={createListingHref("продажа", "Продажа")}>
            Продажа
          </Link>
          <Link className="header__link" href={createListingHref("арендный бизнес", "Арендный бизнес")}>
            Арендный бизнес
          </Link>
        </nav>

        <div className="header__actions">
          <a href="tel:+79990016588" className="header__phone">
            +7 (999) 001-65-88
          </a>
          <a href="#callback" className="btn btn--ghost" data-bs-toggle="modal" data-bs-target="#userSignInModal">
            Заявка
          </a>
        </div>
      </div>
    </header>
  );
}
