/**
 * Разбор ошибок admin-pricing в понятное сообщение + флаг «перечитать данные».
 * 409 всегда приводит к refetch актуального состояния.
 */
import { ApiError } from '@/lib/api/client';

export type PricingErrorKind =
  | 'draftConflict'
  | 'notDraft'
  | 'immutable'
  | 'validation'
  | 'periodConflict'
  | 'demoForbidden'
  | 'unauthorized'
  | 'forbidden'
  | 'notFound'
  | 'rateLimit'
  | 'network'
  | 'unknown';

export interface PricingError {
  kind: PricingErrorKind;
  message: string;
  /** Список ошибок валидации (из 422/backend errors), если есть. */
  details?: string[];
  /** Нужно перечитать актуальные данные (любой 409 и т.п.). */
  reload: boolean;
}

/** Достаём доменный code из тела ApiError (backend кладёт его в errors.code). */
function domainCode(error: ApiError): string | undefined {
  const errs = error.errors as unknown;
  if (errs && typeof errs === 'object' && 'code' in errs) {
    return String((errs as { code?: unknown }).code ?? '');
  }
  return undefined;
}

/** Список строковых деталей из errors, если backend прислал массив. */
function detailList(error: ApiError): string[] | undefined {
  const errs = error.errors as unknown;
  if (Array.isArray(errs)) {
    return errs.map((e) => (typeof e === 'string' ? e : (e as { message?: string }).message ?? JSON.stringify(e)));
  }
  return undefined;
}

export function describePricingError(error: unknown): PricingError {
  if (!(error instanceof ApiError)) {
    return { kind: 'unknown', message: 'Не удалось выполнить операцию. Попробуйте ещё раз.', reload: false };
  }
  if (error.status === 0) {
    return { kind: 'network', message: 'Нет связи с сервером. Проверьте подключение.', reload: false };
  }

  const code = domainCode(error);

  if (error.status === 409) {
    if (code === 'PRICING_DRAFT_CONFLICT') {
      return {
        kind: 'draftConflict',
        message: 'Прайс был изменён другим пользователем. Данные обновлены.',
        reload: true,
      };
    }
    if (code === 'PRICING_NOT_DRAFT') {
      return { kind: 'notDraft', message: 'Действие доступно только для черновика.', reload: true };
    }
    if (code === 'PRICING_IMMUTABLE') {
      return {
        kind: 'immutable',
        message: 'Опубликованный прайс неизменяем — создайте черновик новой версии.',
        reload: true,
      };
    }
    // Прочие 409 (пересечение периодов, коллизия) — тоже перечитываем.
    return {
      kind: 'periodConflict',
      message: error.message || 'Конфликт: период пересекается с активным прайсом.',
      reload: true,
    };
  }

  switch (error.status) {
    case 400:
      return { kind: 'validation', message: error.message || 'Некорректные данные.', details: detailList(error), reload: false };
    case 401:
      return { kind: 'unauthorized', message: 'Сессия истекла. Войдите заново.', reload: false };
    case 403:
      // Демо-прайс в production блокируется ForbiddenException (не нехватка прав).
      if (/демо/i.test(error.message)) {
        return { kind: 'demoForbidden', message: error.message, reload: false };
      }
      return { kind: 'forbidden', message: 'Недостаточно прав для этого действия.', reload: false };
    case 404:
      return { kind: 'notFound', message: 'Не найдено. Возможно, данные устарели.', reload: true };
    case 422:
      // Демо-прайс в production или ошибки валидации публикации.
      return {
        kind: error.message.includes('емо') ? 'demoForbidden' : 'validation',
        message: error.message || 'Прайс не прошёл проверку.',
        details: detailList(error),
        reload: false,
      };
    case 429:
      return { kind: 'rateLimit', message: 'Слишком много действий. Подождите минуту.', reload: false };
    default:
      return { kind: 'unknown', message: error.message || 'Ошибка сервера.', reload: error.status >= 500 };
  }
}
