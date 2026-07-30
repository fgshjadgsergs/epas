/** DTO-типы под текущий backend (NestJS, см. D:\photo-print\src). */

export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    limit: number;
    offset: number;
    total: number;
  };
}

export interface Category {
  id: string;
  parentId: string | null;
  slug: string;
  title: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceImage {
  id: string;
  alt: string | null;
  sortOrder: number;
  isMain: boolean;
  url: string | null;
}

export interface Service {
  id: string;
  categoryId: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  description: string | null;
  /** Decimal с backend сериализуется в JSON как строка, не number. */
  priceFrom: string | null;
  productionTimeFrom: number | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  images: ServiceImage[];
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  roles: string[];
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  roles: string[];
  /** Коды прав из БД для UX-гейтинга (не секрет; авторитет — backend). */
  permissions: string[];
  createdAt: string;
}
