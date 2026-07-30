const integerFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

const profitFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

export function formatInteger(value: number): string {
  return integerFormatter.format(Math.round(value));
}

export function formatPricePerArea(price: number, area: number): string | null {
  if (!Number.isFinite(price) || !Number.isFinite(area) || area <= 0) {
    return null;
  }

  return formatInteger(price / area);
}

export function formatProfit(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return profitFormatter.format(value);
}

export function includesRent(dealType: string): boolean {
  return dealType.toLowerCase().includes("аренд");
}

export function isRentBusiness(dealType: string): boolean {
  const normalized = dealType.toLowerCase().trim();
  return normalized !== "продажа" && normalized !== "аренда";
}

export function isPlainRent(dealType: string): boolean {
  return dealType.toLowerCase().trim() === "аренда";
}

/**
 * Аренда котируется помесячно, продажа — единой суммой. Без явного периода
 * рядом с ценой выдача из аренды и продажи читается одинаково.
 */
export function getPricePeriodSuffix(dealType: string): string | null {
  return isPlainRent(dealType) ? "/мес" : null;
}

/**
 * Для аренды ставка за метр традиционно указывается за год, для продажи —
 * это просто цена метра.
 */
export function formatRatePerArea(
  price: number,
  area: number,
  dealType: string,
): { value: string; unit: string } | null {
  if (!Number.isFinite(price) || !Number.isFinite(area) || area <= 0) {
    return null;
  }

  if (isPlainRent(dealType)) {
    return { value: formatInteger((price * 12) / area), unit: "₽/м² в год" };
  }

  return { value: formatInteger(price / area), unit: "₽ за м²" };
}

/**
 * У части объектов (здания целиком) этаж не задан — тогда показываем
 * этажность здания и меняем подпись плитки, а не пишем «—».
 */
export function formatFloorStat(
  floor: number | null,
  allFloors: number | null,
): { label: string; value: string } {
  if (floor === null || floor === undefined) {
    return allFloors
      ? { label: "Этажей", value: String(allFloors) }
      : { label: "Этаж", value: "—" };
  }

  return {
    label: "Этаж",
    value: allFloors ? `${floor} из ${allFloors}` : String(floor),
  };
}

/** Брокеры называют объект свободного назначения ПСН — так короче и привычнее. */
export function shortenEstateType(estateType: string | null): string | null {
  if (!estateType) {
    return null;
  }

  const map: Record<string, string> = {
    "объект свободного назначения": "ПСН",
    "помещение свободного назначения": "ПСН",
    "торговая площадь": "Торговля",
    "готовый бизнес": "Готовый бизнес",
  };

  return map[estateType.toLowerCase().trim()] ?? estateType;
}
