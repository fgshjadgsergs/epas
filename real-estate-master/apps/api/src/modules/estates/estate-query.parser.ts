import { Injectable } from "@nestjs/common";
import { DEAL_TYPES } from "../../common/domain/domain.constants";

export interface ParsedEstateSearch {
  searchByAddress: string | null;
  dealType: string | null;
  estateType: string | null;
  isMoscow: boolean;
  isRegion: boolean;
  fullPrice: boolean | null;
  priceFrom: number | null;
  priceTo: number | null;
  areaFrom: number | null;
  areaTo: number | null;
  metroStation: string | null;
  district: string | null;
  page: number;
  perPage: number;
  offset: number;
  limit: number;
  title: string;
}

@Injectable()
export class EstateQueryParser {
  parseMainPage(query: Record<string, string | string[] | undefined>): { page: number; perPage: number } {
    const page = this.parsePositiveInteger(this.getSingle(query.page), 1);
    return {
      page,
      perPage: 20,
    };
  }

  parseListing(query: Record<string, string | string[] | undefined>): ParsedEstateSearch {
    const filters: ParsedEstateSearch = {
      searchByAddress: null,
      dealType: null,
      estateType: null,
      isMoscow: false,
      isRegion: false,
      fullPrice: null,
      priceFrom: null,
      priceTo: null,
      areaFrom: null,
      areaTo: null,
      metroStation: null,
      district: null,
      page: 1,
      perPage: 30,
      offset: 0,
      limit: 30,
      title: this.getSingle(query.title) || "Объекты по Вашему запросу",
    };

    const searchByAddress = this.getSingle(query.search_by_address);
    if (searchByAddress) {
      filters.searchByAddress = searchByAddress;
    }

    const dealType = this.getSingle(query.deal_type)?.toLowerCase();
    if (
      dealType &&
      [DEAL_TYPES.SELL, DEAL_TYPES.RENT, DEAL_TYPES.RENT_BUSINESS].map((value) => value.toLowerCase()).includes(
        dealType,
      )
    ) {
      filters.dealType = dealType;
    }

    const estateType = this.getSingle(query.estate_type);
    if (estateType) {
      filters.estateType = estateType;
    }

    filters.isMoscow = this.hasValue(query.is_moscow);
    filters.isRegion = this.hasValue(query.is_region);

    const priceFor = this.getSingle(query.price_for)?.toLowerCase();
    if (priceFor === "full") {
      filters.fullPrice = true;
    }
    if (priceFor === "area") {
      filters.fullPrice = false;
    }

    filters.priceFrom = this.parseNumber(this.getSingle(query.price_from));
    filters.priceTo = this.parseNumber(this.getSingle(query.price_to));
    if (filters.priceFrom !== null && filters.priceTo !== null && filters.priceFrom > filters.priceTo) {
      filters.priceFrom = null;
      filters.priceTo = null;
    }

    filters.areaFrom = this.parseNumber(this.getSingle(query.area_from));
    filters.areaTo = this.parseNumber(this.getSingle(query.area_to));
    if (filters.areaFrom !== null && filters.areaTo !== null && filters.areaFrom > filters.areaTo) {
      filters.areaFrom = null;
      filters.areaTo = null;
    }

    const metroStation = this.getSingle(query.metro_station);
    if (metroStation) {
      filters.metroStation = metroStation.toLowerCase();
    }

    const district = this.getSingle(query.district);
    if (district) {
      filters.district = district.toUpperCase();
    }

    filters.page = this.parsePositiveInteger(this.getSingle(query.page), 1);
    filters.perPage = this.parsePerPage(this.getSingle(query["per-page"]));
    filters.offset = (filters.page - 1) * filters.perPage;
    filters.limit = filters.perPage;

    return filters;
  }

  private getSingle(value: string | string[] | undefined): string | null {
    if (Array.isArray(value)) {
      return value[0] ?? null;
    }

    return value ?? null;
  }

  private parseNumber(value: string | null): number | null {
    if (!value) {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private parsePositiveInteger(value: string | null, fallback: number): number {
    if (!value) {
      return fallback;
    }

    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed)) {
      return fallback;
    }

    return Math.max(parsed, 1);
  }

  private parsePerPage(value: string | null): number {
    if (!value) {
      return 30;
    }

    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed)) {
      return 30;
    }

    return parsed > 50 ? 30 : Math.max(parsed, 1);
  }

  private hasValue(value: string | string[] | undefined): boolean {
    return this.getSingle(value) !== null;
  }
}
