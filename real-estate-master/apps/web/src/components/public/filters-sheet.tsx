"use client";

import { AppSheet } from "./app-sheet";
import FiltersPanel from "./filters-panel";
import { useSearchParamsRecord } from "@/lib/use-search-params-record";

interface FiltersSheetProps {
  open: boolean;
  onClose: () => void;
}

/** Полный блок фильтров в шторке — тот же FiltersPanel, что и на главной. */
export function FiltersSheet({ open, onClose }: FiltersSheetProps) {
  const searchParams = useSearchParamsRecord();

  return (
    <AppSheet open={open} onClose={onClose} title="Фильтры">
      <FiltersPanel searchParams={searchParams} submitPath="/listing" variant="sheet" onSubmitted={onClose} />
    </AppSheet>
  );
}
