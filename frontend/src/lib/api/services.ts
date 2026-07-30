import { apiFetch } from './client';
import type { PaginatedResponse, Service } from './types';
import type { FetchOptions, ListQuery } from './categories';

export function getServices(
  query: ListQuery = {},
  options: FetchOptions = {},
): Promise<PaginatedResponse<Service>> {
  return apiFetch<PaginatedResponse<Service>>('services', { query, ...options });
}

export function getServiceBySlug(slug: string, options: FetchOptions = {}): Promise<Service> {
  return apiFetch<Service>(`services/${encodeURIComponent(slug)}`, options);
}
