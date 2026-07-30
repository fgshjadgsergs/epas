"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { FiltersSheet } from "./filters-sheet";
import {
  PUBLIC_DEAL_TYPES,
  PUBLIC_LOCATIONS,
  buildPublicFiltersDraft,
  formatNumberRu,
} from "@/lib/public-filters";
import { SearchParamsRecord, buildPathWithSearchParams } from "@/lib/public-query";

interface ListingToolbarProps {
  searchParams: SearchParamsRecord;
  totalCount: number;
  perPage: number;
}

interface FilterChip {
  key: string;
  label: string;
  /** query-ключи, которые нужно сбросить при снятии чипа */
  clears: string[];
}

const ALL_FILTER_KEYS = [
  "search_by_address",
  "deal_type",
  "is_moscow",
  "is_region",
  "price_from",
  "price_to",
  "area_from",
  "area_to",
];

function formatRangeLabel(prefix: string, from: string, to: string, unit: string): string {
  if (from && to) {
    return `${prefix}: ${formatNumberRu(from)} – ${formatNumberRu(to)} ${unit}`;
  }

  if (from) {
    return `${prefix}: от ${formatNumberRu(from)} ${unit}`;
  }

  return `${prefix}: до ${formatNumberRu(to)} ${unit}`;
}

/**
 * Липкий тулбар каталога: поиск, чипы активных фильтров, кнопка полного
 * блока фильтров и количество найденного. На мобильных поиск и фильтры
 * живут в нижней панели, тулбар показывает только чипы и счётчик.
 */
export function ListingToolbar({ searchParams, totalCount, perPage }: ListingToolbarProps) {
  const router = useRouter();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const searchParamsKey = useMemo(() => JSON.stringify(searchParams), [searchParams]);
  const draft = useMemo(() => buildPublicFiltersDraft(searchParams), [searchParamsKey]);

  const [query, setQuery] = useState(draft.searchByAddress);

  useEffect(() => {
    setQuery(draft.searchByAddress);
  }, [draft.searchByAddress]);

  const chips = useMemo<FilterChip[]>(() => {
    const result: FilterChip[] = [];

    if (draft.dealType) {
      result.push({
        key: "deal",
        label: PUBLIC_DEAL_TYPES[draft.dealType].label,
        clears: ["deal_type"],
      });
    }

    if (draft.location) {
      result.push({
        key: "location",
        label: PUBLIC_LOCATIONS[draft.location].label,
        clears: ["is_moscow", "is_region"],
      });
    }

    if (draft.priceFrom || draft.priceTo) {
      result.push({
        key: "price",
        label: formatRangeLabel("Цена", draft.priceFrom, draft.priceTo, "₽"),
        clears: ["price_from", "price_to"],
      });
    }

    if (draft.areaFrom || draft.areaTo) {
      result.push({
        key: "area",
        label: formatRangeLabel("Площадь", draft.areaFrom, draft.areaTo, "м²"),
        clears: ["area_from", "area_to"],
      });
    }

    if (draft.searchByAddress) {
      result.push({
        key: "search",
        label: `«${draft.searchByAddress}»`,
        clears: ["search_by_address"],
      });
    }

    return result;
  }, [draft]);

  const navigate = (clears: string[]): void => {
    const updates: Record<string, null | number> = { page: 1 };
    for (const key of clears) {
      updates[key] = null;
    }

    router.push(buildPathWithSearchParams("/listing", searchParams, updates));
  };

  const handleSearchSubmit = (event: FormEvent): void => {
    event.preventDefault();
    router.push(
      buildPathWithSearchParams("/listing", searchParams, {
        search_by_address: query.trim() || null,
        page: 1,
      }),
    );
  };

  const handlePerPageChange = (value: string): void => {
    router.push(
      buildPathWithSearchParams("/listing", searchParams, {
        "per-page": Number(value),
        page: 1,
      }),
    );
  };

  return (
    <div className="listing-toolbar">
      <div className="container-xl">
        <div className="listing-toolbar__inner">
          <form className="listing-toolbar__search" onSubmit={handleSearchSubmit}>
            <Search className="listing-toolbar__search-icon" aria-hidden="true" />
            <input
              type="text"
              value={query}
              placeholder="Улица, метро, название объекта"
              onChange={(event) => setQuery(event.target.value)}
            />
          </form>

          <button type="button" className="listing-toolbar__filters" onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal aria-hidden="true" />
            <span>Фильтры</span>
            {chips.length > 0 ? <span className="listing-toolbar__badge">{chips.length}</span> : null}
          </button>

          {chips.length > 0 ? (
            <div className="listing-toolbar__chips">
              {chips.map((chip) => (
                <span key={chip.key} className="filter-chip">
                  {chip.label}
                  <button
                    type="button"
                    aria-label={`Убрать фильтр: ${chip.label}`}
                    onClick={() => navigate(chip.clears)}
                  >
                    <X aria-hidden="true" />
                  </button>
                </span>
              ))}

              <button type="button" className="filter-chip filter-chip--reset" onClick={() => navigate(ALL_FILTER_KEYS)}>
                Сбросить всё
              </button>
            </div>
          ) : null}

          <div className="listing-toolbar__meta">
            <span className="listing-toolbar__count">
              Найдено: <strong>{totalCount}</strong>
            </span>

            <label className="listing-toolbar__per-page">
              По
              <select value={perPage} onChange={(event) => handlePerPageChange(event.target.value)}>
                {[10, 30, 50].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <FiltersSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </div>
  );
}
