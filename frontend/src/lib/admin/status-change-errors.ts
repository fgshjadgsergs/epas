/**
 * Разбор ошибок смены статуса заказа в сообщение и нужное действие для UI.
 * Персональные данные не логируются: сюда попадают только коды/сообщения API.
 */
import { ApiError } from '@/lib/api/client';

export type StatusChangeErrorKind =
  | 'validation'
  | 'unauthorized'
  | 'forbidden'
  | 'notFound'
  | 'conflict'
  | 'rateLimit'
  | 'network'
  | 'unknown';

export interface StatusChangeError {
  kind: StatusChangeErrorKind;
  message: string;
  /** Нужно ли перечитать заказ: состояние на сервере разошлось с экраном. */
  reload: boolean;
}

export function describeStatusChangeError(error: unknown): StatusChangeError {
  if (!(error instanceof ApiError)) {
    return { kind: 'unknown', message: 'Не удалось изменить статус. Попробуйте ещё раз.', reload: false };
  }

  if (error.status === 0) {
    return { kind: 'network', message: 'Нет связи с сервером. Проверьте подключение.', reload: false };
  }

  switch (error.status) {
    case 400:
      return { kind: 'validation', message: error.message || 'Некорректные данные.', reload: false };
    case 401:
      return { kind: 'unauthorized', message: 'Сессия истекла. Войдите заново.', reload: false };
    case 403:
      return { kind: 'forbidden', message: 'Недостаточно прав для смены статуса.', reload: false };
    case 404:
      return { kind: 'notFound', message: 'Заказ не найден.', reload: false };
    case 409:
      // Статус уже изменён или переход запрещён — перечитываем заказ, чтобы
      // показать актуальное состояние.
      return {
        kind: 'conflict',
        message: error.message || 'Статус заказа уже изменился. Показываем актуальные данные.',
        reload: true,
      };
    case 429:
      return { kind: 'rateLimit', message: 'Слишком много действий. Подождите минуту.', reload: false };
    default:
      return {
        kind: 'unknown',
        message: error.message || 'Не удалось изменить статус.',
        reload: error.status >= 500,
      };
  }
}
