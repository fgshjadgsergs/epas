import { apiFetch, type RequestOptions } from './client';
import type { Category, PaginatedResponse, Service } from './types';

export interface ListQuery {
  limit?: number;
  offset?: number;
  [key: string]: string | number | undefined;
}

/** Опции кэширования, которые имеет смысл прокидывать из server components. */
export type FetchOptions = Pick<RequestOptions, 'cache' | 'revalidate' | 'tags'>;

export function getCategories(
  query: ListQuery = {},
  options: FetchOptions = {},
): Promise<PaginatedResponse<Category>> {
  return apiFetch<PaginatedResponse<Category>>('categories', { query, ...options });
}

export function getCategoryBySlug(slug: string, options: FetchOptions = {}): Promise<Category> {
  return apiFetch<Category>(`categories/${encodeURIComponent(slug)}`, options);
}

/** Backend отдаёт здесь голый массив, без пагинации — в отличие от /categories. */
export function getCategoryServices(slug: string, options: FetchOptions = {}): Promise<Service[]> {
  return apiFetch<Service[]>(`categories/${encodeURIComponent(slug)}/services`, options);
}
