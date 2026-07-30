/**
 * Разбор ошибок оформления заказа в понятное пользователю сообщение.
 *
 * Осознанно ничего не логирует: тело запроса содержит имя, телефон, e-mail и
 * комментарий — эти данные не должны попадать ни в консоль, ни в трейсинг.
 */
import { ApiError } from '@/lib/api/client';

export type CheckoutErrorKind =
  | 'validation'
  | 'unauthorized'
  | 'notFound'
  | 'cartConflict'
  | 'rateLimit'
  | 'network'
  | 'unknown';

export interface CheckoutError {
  kind: CheckoutErrorKind;
  /** Заголовок сообщения для пользователя. */
  message: string;
  /** Построчные замечания по полям (из 400 backend). */
  details?: string[];
  /** Нужно ли перечитать корзину: её состояние на сервере разошлось с экраном. */
  refreshCart: boolean;
  /** Стоит ли предложить вернуться в корзину и пересчитать позиции. */
  backToCart: boolean;
}

export function describeCheckoutError(error: unknown): CheckoutError {
  if (!(error instanceof ApiError)) {
    return {
      kind: 'unknown',
      message: 'Не удалось оформить заказ. Попробуйте ещё раз.',
      refreshCart: false,
      backToCart: false,
    };
  }

  // ApiError(0) выставляет client.ts, когда fetch не дошёл до сервера.
  if (error.status === 0) {
    return {
      kind: 'network',
      message: 'Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.',
      refreshCart: false,
      backToCart: false,
    };
  }

  switch (error.status) {
    case 400:
      return {
        kind: 'validation',
        message: 'Проверьте контактные данные.',
        details: error.errors,
        refreshCart: false,
        backToCart: false,
      };

    case 401:
      return {
        kind: 'unauthorized',
        message: 'Сессия истекла. Войдите ещё раз — введённые данные сохранятся.',
        refreshCart: false,
        backToCart: false,
      };

    case 403:
    case 404:
      return {
        kind: 'notFound',
        message: 'Корзина недоступна. Откройте её заново и повторите оформление.',
        refreshCart: true,
        backToCart: true,
      };

    // 409 — конфликт (валюта, коллизия номера), 422 — корзина устарела,
    // позиция недействительна, демо-прайс. И то и другое означает: состояние
    // на сервере изменилось, показывать успех нельзя.
    case 409:
    case 422:
      return {
        kind: 'cartConflict',
        message: error.message || 'Корзина изменилась. Проверьте состав и повторите оформление.',
        refreshCart: true,
        backToCart: true,
      };

    case 429:
      return {
        kind: 'rateLimit',
        message: 'Слишком много попыток оформления. Подождите минуту и повторите.',
        refreshCart: false,
        backToCart: false,
      };

    default:
      return {
        kind: 'unknown',
        message: error.message || 'Не удалось оформить заказ. Попробуйте ещё раз.',
        refreshCart: error.status >= 500,
        backToCart: false,
      };
  }
}
