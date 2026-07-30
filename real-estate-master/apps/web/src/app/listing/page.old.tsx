import type { Metadata } from "next";
import { EstateCard } from "@/components/public/estate-card";
import { ListingToolbar } from "@/components/public/listing-toolbar";
import { Pagination } from "@/components/public/pagination";
import { getListingData } from "@/lib/public-api";
import { buildPathWithSearchParams, SearchParamsRecord } from "@/lib/public-query";

export const metadata: Metadata = {
  title: "Недвижимость в Москве",
};

interface ListingPageProps {
  searchParams?: Promise<SearchParamsRecord>;
}

/**
 * Экран каталога. Большого блока фильтров здесь больше нет — на десктопе
 * доступ через липкий тулбар (поиск + кнопка «Фильтры»), на мобильных —
 * через нижнюю панель приложения. Полный блок открывается шторкой.
 */
export default async function ListingPage({ searchParams }: ListingPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const data = await getListingData(resolvedSearchParams);

  return (
    <main className="listing-app">
      <ListingToolbar
        searchParams={resolvedSearchParams}
        totalCount={data.totalCount}
        perPage={data.perPage}
      />

      <section className="listing-app__content container-xl">
        <h1 className="listing-app__title">{data.title}</h1>

        {data.items.length > 0 ? (
          <div className="listing-grid mb-5">
            {data.items.map((estate) => (
              <EstateCard key={estate.dbId} estate={estate} variant="listing" />
            ))}
          </div>
        ) : (
          <div className="listing-app__empty">
            <h2>Объекты не найдены</h2>
            <p>Попробуйте изменить параметры поиска или сбросить фильтры.</p>
          </div>
        )}

        <Pagination
          page={data.page}
          perPage={data.perPage}
          totalCount={data.totalCount}
          createHref={(page) =>
            buildPathWithSearchParams("/listing", resolvedSearchParams, {
              page,
              "per-page": data.perPage,
            })
          }
        />
      </section>
    </main>
  );
}
