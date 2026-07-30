import type { Metadata } from "next";
import { EstateCard } from "@/components/public/estate-card";
import { Pagination } from "@/components/public/pagination";
import { getMainPageData } from "@/lib/public-api";
import { getSingleValue, SearchParamsRecord } from "@/lib/public-query";
import FiltersPanel from "@/components/public/filters-panel";

export const metadata: Metadata = {
  title: "Аренда и продажа недвижимости",
};

interface HomePageProps {
  searchParams?: Promise<SearchParamsRecord>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const data = await getMainPageData(getSingleValue(resolvedSearchParams.page));

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

      <section id="listing-1" className="section pt-5 pb-6">
        <div className="bg bg-img position-absolute" data-bg-img=".img" />

        <div className="container-xl position-relative">
          {data.items.length > 0 ? (
            <div className="listing-grid mb-5">
              {data.items.map((estate) => (
                <EstateCard key={estate.dbId} estate={estate} variant="main" />
              ))}
            </div>
          ) : (
            <div className="section-content text-center py-5">
              <h2 className="fs-3 mb-3">Объекты пока не найдены</h2>
              <p className="mb-0">
                Публичная витрина подключена, но для главной страницы пока нет карточек.
              </p>
            </div>
          )}

          <Pagination
            page={data.page}
            perPage={data.perPage}
            totalCount={data.totalCount}
            createHref={(page) => `/?page=${page}`}
          />
        </div>
      </section>
    </main>
  );
}