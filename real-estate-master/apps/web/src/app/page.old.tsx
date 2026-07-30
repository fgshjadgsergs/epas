import type { Metadata } from "next";
import {
  BadgePercent,
  Building2,
  CalendarCheck,
  FileSignature,
  KeyRound,
  Landmark,
  LayoutGrid,
  Phone,
  PhoneCall,
  Store,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { EstateCard } from "@/components/public/estate-card";
import FiltersPanel from "@/components/public/filters-panel";
import { getMainPageData } from "@/lib/public-api";
import { getSingleValue, SearchParamsRecord } from "@/lib/public-query";

export const metadata: Metadata = {
  title: "Аренда и продажа недвижимости",
};

interface HomePageProps {
  searchParams?: Promise<SearchParamsRecord>;
}

const CATEGORIES = [
  {
    label: "Офисы",
    href: "/listing?estate_type=%D0%9E%D1%84%D0%B8%D1%81&title=%D0%9E%D1%84%D0%B8%D1%81%D1%8B",
    Icon: Building2,
  },
  {
    label: "Торговые площади",
    href: "/listing?estate_type=%D0%A2%D0%BE%D1%80%D0%B3%D0%BE%D0%B2%D0%B0%D1%8F+%D0%BF%D0%BB%D0%BE%D1%89%D0%B0%D0%B4%D1%8C&title=%D0%A2%D0%BE%D1%80%D0%B3%D0%BE%D0%B2%D1%8B%D0%B5+%D0%BF%D0%BB%D0%BE%D1%89%D0%B0%D0%B4%D0%B8",
    Icon: Store,
  },
  {
    label: "Склады",
    href: "/listing?estate_type=%D0%A1%D0%BA%D0%BB%D0%B0%D0%B4&title=%D0%A1%D0%BA%D0%BB%D0%B0%D0%B4%D1%8B",
    Icon: Warehouse,
  },
  {
    label: "Здания и особняки",
    href: "/listing?estate_type=%D0%97%D0%B4%D0%B0%D0%BD%D0%B8%D0%B5&title=%D0%97%D0%B4%D0%B0%D0%BD%D0%B8%D1%8F+%D0%B8+%D0%BE%D1%81%D0%BE%D0%B1%D0%BD%D1%8F%D0%BA%D0%B8",
    Icon: Landmark,
  },
  {
    label: "ПСН",
    href: "/listing?estate_type=%D0%9E%D0%B1%D1%8A%D0%B5%D0%BA%D1%82+%D1%81%D0%B2%D0%BE%D0%B1%D0%BE%D0%B4%D0%BD%D0%BE%D0%B3%D0%BE+%D0%BD%D0%B0%D0%B7%D0%BD%D0%B0%D1%87%D0%B5%D0%BD%D0%B8%D1%8F&title=%D0%9F%D0%BE%D0%BC%D0%B5%D1%89%D0%B5%D0%BD%D0%B8%D1%8F+%D1%81%D0%B2%D0%BE%D0%B1%D0%BE%D0%B4%D0%BD%D0%BE%D0%B3%D0%BE+%D0%BD%D0%B0%D0%B7%D0%BD%D0%B0%D1%87%D0%B5%D0%BD%D0%B8%D1%8F",
    Icon: LayoutGrid,
  },
  {
    label: "Арендный бизнес",
    href: "/listing?deal_type=%D0%90%D1%80%D0%B5%D0%BD%D0%B4%D0%BD%D1%8B%D0%B9+%D0%B1%D0%B8%D0%B7%D0%BD%D0%B5%D1%81&title=%D0%90%D1%80%D0%B5%D0%BD%D0%B4%D0%BD%D1%8B%D0%B9+%D0%B1%D0%B8%D0%B7%D0%BD%D0%B5%D1%81",
    Icon: BadgePercent,
  },
] as const;

const STEPS = [
  {
    Icon: PhoneCall,
    title: "Заявка или звонок",
    text: "Расскажите, какой объект нужен: назначение, площадь, бюджет, сроки.",
  },
  {
    Icon: CalendarCheck,
    title: "Подборка и показы",
    text: "Пришлём подходящие варианты и покажем объекты в удобное время.",
  },
  {
    Icon: FileSignature,
    title: "Переговоры и договор",
    text: "Согласуем условия с собственником и сопроводим сделку до подписания.",
  },
  {
    Icon: KeyRound,
    title: "Передача помещения",
    text: "Передадим объект по акту и останемся на связи после заезда.",
  },
] as const;

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const data = await getMainPageData(getSingleValue(resolvedSearchParams.page));
  const freshEstates = data.items.slice(0, 6);

  return (
    <main>
      <section
        id="searchbox-hero-1"
        className="section section__inverse justify-content-center pt-6 pb-4 pb-lg-5 pb-xl-6 vh-75 h-lg-640px min-h-330px"
      >
        <div className="hero__bg position-absolute" />
        <div className="hero__overlay position-absolute" />

        <div className="container-xl position-relative h-100">
          <div className="row justify-content-center align-items-center h-100">
            <div id="searchbox-hero-1Searchbox" className="searchbox col-12 col-lg-9 col-xl-8 py-4 my-5">
              <div className="hero-layout">
                <div className="hero-left">
                  <h1 className="text-center text-white display-5 position-relative">
                    Аренда коммерческой недвижимости в Москве
                  </h1>

                  <p className="hero-subtitle">
                    Офисы, склады, торговые площади и готовый арендный бизнес.
                    Подберём объект под задачу и покажем в удобное время.
                  </p>
                </div>
              </div>

              <FiltersPanel searchParams={resolvedSearchParams} submitPath="/listing" />

              {/* TODO: цифры во втором и третьем пункте — заглушки,
                  замените на реальные показатели агентства. */}
              <ul className="hero-trust">
                <li>
                  <b>{data.totalCount}</b>
                  <span>объектов в базе</span>
                </li>
                <li>
                  <b>Москва и МО</b>
                  <span>вся территория</span>
                </li>
                <li>
                  <b>Подбор и показ</b>
                  <span>работаем под задачу</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ---- категории ---- */}
      <section className="home-section">
        <div className="container-xl">
          <div className="home-section__head">
            <h2>Что ищете?</h2>
            <p>Выберите категорию — покажем только подходящие объекты.</p>
          </div>

          <div className="cat-grid">
            {CATEGORIES.map(({ label, href, Icon }) => (
              <Link key={label} href={href} className="cat-tile">
                <span className="cat-tile__icon" aria-hidden="true">
                  <Icon />
                </span>
                <span className="cat-tile__label">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---- свежие объекты ---- */}
      <section className="home-section">
        <div className="container-xl">
          <div className="home-section__head home-section__head--row">
            <div>
              <h2>Актуальные предложения</h2>
              <p>Сначала — приоритетные объекты нашей базы.</p>
            </div>

            <Link href="/listing" className="home-section__more">
              Весь каталог ({data.totalCount})
            </Link>
          </div>

          {freshEstates.length > 0 ? (
            <div className="listing-grid">
              {freshEstates.map((estate) => (
                <EstateCard key={estate.dbId} estate={estate} variant="main" />
              ))}
            </div>
          ) : (
            <p className="home-section__empty">Объекты скоро появятся.</p>
          )}

          <div className="home-section__footer">
            <Link href="/listing" className="home-more-btn">
              Смотреть весь каталог
            </Link>
          </div>
        </div>
      </section>

      {/* ---- как мы работаем ---- */}
      <section className="home-section">
        <div className="container-xl">
          <div className="home-section__head">
            <h2>Как мы работаем</h2>
            <p>Четыре шага от заявки до передачи ключей.</p>
          </div>

          <ol className="steps">
            {STEPS.map(({ Icon, title, text }, index) => (
              <li key={title} className="steps__item">
                <span className="steps__number" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="steps__icon" aria-hidden="true">
                  <Icon />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---- CTA ---- */}
      <section className="home-section home-section--cta">
        <div className="container-xl">
          <div className="cta-banner">
            <div className="cta-banner__text">
              <h2>Не нашли подходящий объект?</h2>
              <p>
                Расскажите о задаче — подберём варианты из базы и закрытых
                предложений и организуем показы.
              </p>
            </div>

            <div className="cta-banner__actions">
              <a href="tel:+79990016588" className="cta-banner__call">
                <Phone aria-hidden="true" />
                +7 (999) 001-65-88
              </a>

              <button
                type="button"
                className="cta-banner__request"
                data-bs-toggle="modal"
                data-bs-target="#userSignInModal"
              >
                Оставить заявку
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
