"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { SearchParamsRecord } from "@/lib/public-query";

/**
 * Текущие query-параметры в том же виде, в каком их получают серверные
 * страницы (SearchParamsRecord) — чтобы клиентские шторки могли
 * переиспользовать buildPublicFiltersDraft / buildPathWithSearchParams.
 */
export function useSearchParamsRecord(): SearchParamsRecord {
  const searchParams = useSearchParams();

  return useMemo(() => {
    const record: Record<string, string | string[]> = {};

    searchParams.forEach((value, key) => {
      const existing = record[key];

      if (existing === undefined) {
        record[key] = value;
      } else if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        record[key] = [existing, value];
      }
    });

    return record;
  }, [searchParams]);
}
