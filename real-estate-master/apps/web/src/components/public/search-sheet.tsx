"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AppSheet } from "./app-sheet";
import { buildPathWithSearchParams, getSingleValue } from "@/lib/public-query";
import { useSearchParamsRecord } from "@/lib/use-search-params-record";

interface SearchSheetProps {
  open: boolean;
  onClose: () => void;
}

/** Быстрый поиск по адресу и названию. Остальные фильтры сохраняются. */
export function SearchSheet({ open, onClose }: SearchSheetProps) {
  const router = useRouter();
  const searchParams = useSearchParamsRecord();
  const currentQuery = getSingleValue(searchParams.search_by_address) ?? "";
  const [query, setQuery] = useState(currentQuery);

  useEffect(() => {
    if (open) {
      setQuery(currentQuery);
    }
  }, [open, currentQuery]);

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    router.push(
      buildPathWithSearchParams("/listing", searchParams, {
        search_by_address: query.trim() || null,
        page: 1,
      }),
    );
    onClose();
  };

  return (
    <AppSheet open={open} onClose={onClose} title="Поиск">
      <form className="app-search" onSubmit={handleSubmit}>
        <div className="app-search__field">
          <Search className="app-search__icon" aria-hidden="true" />
          <input
            type="text"
            value={query}
            autoFocus
            placeholder="Улица, метро, название объекта"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <button type="submit" className="search-btn app-search__submit">
          Найти
        </button>

        <p className="app-search__hint">
          Например: «Ленинский проспект», «Павелецкая» или «склад».
        </p>
      </form>
    </AppSheet>
  );
}
