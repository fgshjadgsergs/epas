/**
 * Базовый fetch-wrapper для backend API.
 * Базовый URL читается из NEXT_PUBLIC_API_URL — нигде в компонентах
 * localhost не хардкодится, только здесь (как fallback на случай,
 * если переменная окружения не задана).
 */
import { getAccessToken, refreshSession } from '@/lib/auth/session';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

/** Формат ошибки, который отдаёт HttpExceptionFilter backend. */
interface BackendErrorBody {
  statusCode?: number;
  message?: string;
  errors?: string[];
}

export class ApiError extends Error {
  readonly status: number;
  readonly errors?: string[];

  constructor(status: number, message: string, errors?: string[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** JWT access token — добавляется как `Authorization: Bearer <token>`. */
  token?: string | null;
  query?: Record<string, string | number | undefined>;
  /** Прокидывается в fetch как есть (например, { cache: 'no-store' } в server components). */
  cache?: RequestCache;
  /**
   * ISR: срок кэша (сек) для fetch в server components (next: { revalidate }).
   * На клиенте игнорируется браузерным fetch без последствий.
   */
  revalidate?: number;
  /** ISR cache-теги (next: { tags }) для точечной инвалидации из route handler. */
  tags?: string[];
  signal?: AbortSignal;
  /**
   * Отправлять cookie кросс-доменно. Нужен серверной корзине: анонимная
   * сессия живёт в httpOnly-cookie (kp_cart_sid), браузер шлёт её только
   * при credentials: 'include' (backend отвечает CORS credentials: true).
   */
  credentials?: RequestCredentials;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(path.replace(/^\//, ''), `${API_BASE_URL.replace(/\/$/, '')}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/** Признак auth-эндпоинтов: на них не пытаемся авто-refresh (иначе рекурсия). */
function isAuthEndpoint(path: string): boolean {
  return path.replace(/^\//, '').startsWith('auth/');
}

async function rawFetch(path: string, options: RequestOptions, bearer: string | null | undefined): Promise<Response> {
  const { method = 'GET', body, query, cache, revalidate, tags, signal, credentials } = options;
  const next = revalidate !== undefined || tags !== undefined
    ? { ...(revalidate !== undefined ? { revalidate } : {}), ...(tags !== undefined ? { tags } : {}) }
    : undefined;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  return fetch(buildUrl(path, query), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache,
    ...(next !== undefined ? { next } : {}),
    ...(credentials !== undefined ? { credentials } : {}),
    signal,
  });
}

async function toResult<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  const data = text ? safeJsonParse(text) : undefined;
  if (!response.ok) {
    const errorBody = (data ?? {}) as BackendErrorBody;
    throw new ApiError(response.status, errorBody.message ?? `Ошибка запроса (${response.status})`, errorBody.errors);
  }
  return data as T;
}

/**
 * Единая точка входа для запросов к backend.
 *
 * При обычном API 401 (запрос был авторизован Bearer, на клиенте, вне auth-
 * эндпоинтов) выполняется единый single-flight refresh по httpOnly-cookie, и
 * исходный запрос повторяется РОВНО один раз с новым access token. 403 не
 * триггерит refresh; на refresh-эндпоинт refresh не делаем. Идемпотентность
 * заказов/публикаций не нарушается: повтор — только после доказанного 401.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const canRefresh = typeof window !== 'undefined' && !!options.token && !isAuthEndpoint(path);

  let response: Response;
  try {
    response = await rawFetch(path, options, options.token);
  } catch {
    throw new ApiError(0, 'Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.');
  }

  if (response.status === 401 && canRefresh) {
    const session = await refreshSession();
    if (session?.accessToken) {
      try {
        response = await rawFetch(path, options, session.accessToken ?? getAccessToken());
      } catch {
        throw new ApiError(0, 'Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.');
      }
    }
  }

  return toResult<T>(response);
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
