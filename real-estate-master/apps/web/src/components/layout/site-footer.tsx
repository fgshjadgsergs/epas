import Link from "next/link";

/**
 * Футер с реальным содержимым: навигация, контакты, копирайт.
 * TODO: e-mail и адрес офиса — заглушки, подставьте реальные данные.
 */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container-xl">
        <div className="site-footer__grid">
          <div className="site-footer__brand">
            <p className="site-footer__logo">ЭПАС Девелопмент</p>
            <p className="site-footer__about">
              Агентство коммерческой недвижимости: аренда, продажа и готовый
              арендный бизнес в Москве и Московской области.
            </p>
          </div>

          <nav className="site-footer__col" aria-label="Каталог">
            <p className="site-footer__title">Каталог</p>
            <Link href="/listing?deal_type=%D0%90%D1%80%D0%B5%D0%BD%D0%B4%D0%B0&title=%D0%90%D1%80%D0%B5%D0%BD%D0%B4%D0%B0">
              Аренда
            </Link>
            <Link href="/listing?deal_type=%D0%9F%D1%80%D0%BE%D0%B4%D0%B0%D0%B6%D0%B0&title=%D0%9F%D1%80%D0%BE%D0%B4%D0%B0%D0%B6%D0%B0">
              Продажа
            </Link>
            <Link href="/listing?deal_type=%D0%90%D1%80%D0%B5%D0%BD%D0%B4%D0%BD%D1%8B%D0%B9+%D0%B1%D0%B8%D0%B7%D0%BD%D0%B5%D1%81&title=%D0%90%D1%80%D0%B5%D0%BD%D0%B4%D0%BD%D1%8B%D0%B9+%D0%B1%D0%B8%D0%B7%D0%BD%D0%B5%D1%81">
              Арендный бизнес
            </Link>
            <Link href="/listing">Все объекты</Link>
          </nav>

          <div className="site-footer__col">
            <p className="site-footer__title">Контакты</p>
            <a href="tel:+79990016588">+7 (999) 001-65-88</a>
            <a href="mailto:info@epas.agency">info@epas.agency</a>
            <p>Москва, адрес офиса</p>
          </div>
        </div>

        <div className="site-footer__bottom">
          <p>&copy; {new Date().getFullYear()} EPAS Development. Все права защищены.</p>
        </div>
      </div>
    </footer>
  );
}
