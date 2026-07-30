import { apiFetch } from './client';
import type { Category, Service, ServiceImage } from './types';

/**
 * Клиент админ-каталога. Backend защищён permission catalog.manage
 * (PermissionsGuard) — frontend-гейтинг лишь UX. Цена/калькулятор здесь не
 * редактируются (Pricing Engine); калькулятор приходит read-only индикатором.
 */

export interface AdminCategory extends Category {
  serviceCount: number;
  childrenCount: number;
}

export interface AdminCalculatorRef {
  definitionId: string;
  code: string;
  title: string;
}

export interface AdminService {
  id: string;
  categoryId: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  category: { id: string; title: string; slug: string };
  calculator: AdminCalculatorRef | null;
  images: ServiceImage[];
}

export interface CategoryInput {
  slug: string;
  title: string;
  description?: string | null;
  parentId?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface ServiceInput {
  categoryId: string;
  slug: string;
  title: string;
  shortDescription?: string | null;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

// --- categories -------------------------------------------------------------

export function getAdminCategories(token: string): Promise<AdminCategory[]> {
  return apiFetch('admin/categories', { token, cache: 'no-store' });
}
export function getAdminCategory(id: string, token: string): Promise<AdminCategory> {
  return apiFetch(`admin/categories/${encodeURIComponent(id)}`, { token, cache: 'no-store' });
}
export function createAdminCategory(body: CategoryInput, token: string): Promise<Category> {
  return apiFetch('admin/categories', { method: 'POST', body, token });
}
export function updateAdminCategory(id: string, body: Partial<CategoryInput>, token: string): Promise<Category> {
  return apiFetch(`admin/categories/${encodeURIComponent(id)}`, { method: 'PATCH', body, token });
}
export function deleteAdminCategory(id: string, token: string): Promise<void> {
  return apiFetch(`admin/categories/${encodeURIComponent(id)}`, { method: 'DELETE', token });
}

// --- services ---------------------------------------------------------------

export function getAdminServices(token: string): Promise<AdminService[]> {
  return apiFetch('admin/services', { token, cache: 'no-store' });
}
export function getAdminService(id: string, token: string): Promise<AdminService> {
  return apiFetch(`admin/services/${encodeURIComponent(id)}`, { token, cache: 'no-store' });
}
export function createAdminService(body: ServiceInput, token: string): Promise<Service> {
  return apiFetch('admin/services', { method: 'POST', body, token });
}
export function updateAdminService(id: string, body: Partial<ServiceInput>, token: string): Promise<Service> {
  return apiFetch(`admin/services/${encodeURIComponent(id)}`, { method: 'PATCH', body, token });
}
export function deleteAdminService(id: string, token: string): Promise<void> {
  return apiFetch(`admin/services/${encodeURIComponent(id)}`, { method: 'DELETE', token });
}

// --- service images ---------------------------------------------------------

export function updateServiceImage(
  serviceId: string,
  imageId: string,
  body: { alt?: string; sortOrder?: number; isMain?: boolean },
  token: string,
): Promise<ServiceImage> {
  return apiFetch(`admin/services/${encodeURIComponent(serviceId)}/images/${encodeURIComponent(imageId)}`, {
    method: 'PATCH',
    body,
    token,
  });
}
export function deleteServiceImage(serviceId: string, imageId: string, token: string): Promise<void> {
  return apiFetch(`admin/services/${encodeURIComponent(serviceId)}/images/${encodeURIComponent(imageId)}`, {
    method: 'DELETE',
    token,
  });
}
