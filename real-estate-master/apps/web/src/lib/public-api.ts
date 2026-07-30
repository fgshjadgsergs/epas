export interface PublicEstateCard {
  dbId: number;
  title: string;
  price: number;
  presentationPrice: string;
  imageUrl: string;
  imagePublicUrl: string;
  images: string[];
  imagesPublicUrls: string[];
  metroStation: string | null;
  district: string | null;
  region: string | null;
  area: number;
  estateType: string | null;
  floor: number | null;
  allFloors: number | null;
  dealType: string;
  tenantType: string | null;
  profit: number | null;
  map: number | null;
  presentationMap: string | null;
}

export interface PublicEstateDetail {
  dbId: number;
  title: string;
  coordinates: string | null;
  coordinatesTuple: [number, number] | null;
  price: number;
  presentationPrice: string;
  area: number;
  areaPrice: string | null;
  dealType: string;
  description: string;
  areaDescription: string | null;
  region: string | null;
  district: string | null;
  ceilingHeightM: number | null;
  powerKw: number | null;
  images: string[];
  imagesPublicUrls: string[];
  planImage: string | null;
  planImagePublicUrl: string | null;
  estateType: string | null;
  tenantType: string | null;
  map: number | null;
  presentationMap: string | null;
  contractTerm: string | null;
  indexing: string | null;
  profit: number | null;
  floor: number | null;
  allFloors: number | null;
  metroStation: string | null;
}

export interface MainPageResponse {
  page: number;
  perPage: number;
  totalCount: number;
  items: PublicEstateCard[];
}

export interface ListingResponse {
  title: string;
  page: number;
  perPage: number;
  totalCount: number;
  items: PublicEstateCard[];
  filters: Record<string, unknown>;
}

export class PublicApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "PublicApiError";
  }
}

const DEFAULT_PUBLIC_API_TIMEOUT_MS = 8000;

function getApiBaseUrl(): string {
  return (
    process.env.ESTATE_API_BASE_URL ??
    process.env.NEXT_PUBLIC_ESTATE_API_BASE_URL ??
    "http://127.0.0.1:3000"
  );
}

function getPublicApiTimeoutMs(): number {
  const rawValue = process.env.PUBLIC_API_FETCH_TIMEOUT_MS ?? process.env.FRONTEND_API_FETCH_TIMEOUT_MS;
  const parsedValue = Number.parseInt(rawValue ?? "", 10);

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : DEFAULT_PUBLIC_API_TIMEOUT_MS;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function withLeadingSlash(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

export function resolveStoragePath(path: string): string {
  return withLeadingSlash(path);
}

async function fetchJson<T>(path: string): Promise<T> {
  const startedAt = Date.now();
  const timeoutMs = getPublicApiTimeoutMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  console.info(`[PUBLIC API FETCH] start path=${path} timeoutMs=${timeoutMs}`);

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    console.info(`[PUBLIC API FETCH] end path=${path} status=${response.status} durationMs=${Date.now() - startedAt}`);

    if (!response.ok) {
      throw new PublicApiError(`Public API request failed: ${path}`, response.status);
    }

    return (await response.json()) as T;
  } catch (error) {
    console.warn(`[PUBLIC API FETCH] error path=${path} durationMs=${Date.now() - startedAt} message=${getErrorMessage(error)}`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeSearchParams(input: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
      continue;
    }

    params.set(key, value);
  }

  return params;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsedValue = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
}

function getFirstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function getMainPageData(page?: string): Promise<MainPageResponse> {
  const params = new URLSearchParams();
  if (page) {
    params.set("page", page);
  }

  const query = params.toString();
  const path = `/api/v1/estates/main${query ? `?${query}` : ""}`;

  try {
    return await fetchJson<MainPageResponse>(path);
  } catch (error) {
    console.warn(`[PUBLIC API FETCH] fallback path=${path} reason=${getErrorMessage(error)}`);

    return {
      page: parsePositiveInt(page, 1),
      perPage: 12,
      totalCount: 0,
      items: [],
    };
  }
}

export async function getListingData(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<ListingResponse> {
  const query = normalizeSearchParams(searchParams).toString();
  const path = `/api/v1/estates${query ? `?${query}` : ""}`;

  try {
    return await fetchJson<ListingResponse>(path);
  } catch (error) {
    console.warn(`[PUBLIC API FETCH] fallback path=${path} reason=${getErrorMessage(error)}`);

    return {
      title: "Objects",
      page: parsePositiveInt(getFirstParam(searchParams.page), 1),
      perPage: parsePositiveInt(getFirstParam(searchParams["per-page"]), 10),
      totalCount: 0,
      items: [],
      filters: {},
    };
  }
}

export async function getEstateDetail(estateId: number): Promise<PublicEstateDetail> {
  return fetchJson<PublicEstateDetail>(`/api/v1/estates/${estateId}`);
}
