/**
 * Разбор ошибок макетов в понятное русское сообщение + флаг «перечитать».
 * Доменные коды приходят в errors.code (frontend не парсит русский текст).
 * 409 всегда приводит к refetch актуального состояния.
 */
import { ApiError } from '@/lib/api/client';

export interface ArtworkError {
  code: string | null;
  message: string;
  reload: boolean;
}

const CODE_MESSAGE: Record<string, string> = {
  ARTWORK_NOT_FOUND: 'Макет не найден. Данные обновлены.',
  ARTWORK_ORDER_NOT_EDITABLE: 'Заказ нельзя изменять на текущем этапе.',
  ARTWORK_FILE_NOT_READY: 'Файл ещё не готов — попробуйте загрузить заново.',
  ARTWORK_FILE_FORBIDDEN: 'Этот файл нельзя использовать для макета.',
  ARTWORK_FILE_ALREADY_ATTACHED: 'Этот файл уже прикреплён к позиции.',
  ARTWORK_REPLACEMENT_FORBIDDEN: 'Заменить макет сейчас нельзя — версия на проверке или принята.',
  ARTWORK_WITHDRAW_FORBIDDEN: 'Отозвать этот макет уже нельзя.',
  ARTWORK_STATUS_UNCHANGED: 'Макет уже в этом статусе.',
  ARTWORK_TRANSITION_FORBIDDEN: 'Это действие недоступно для текущего статуса.',
  ARTWORK_REVIEW_COMMENT_REQUIRED: 'При отклонении нужен комментарий для клиента.',
  ARTWORK_CONFLICT: 'Состояние макета уже изменилось другим сотрудником.',
};

function domainCode(error: ApiError): string | null {
  const errs = error.errors as unknown;
  if (errs && typeof errs === 'object' && !Array.isArray(errs) && 'code' in errs) {
    return String((errs as { code?: unknown }).code ?? '') || null;
  }
  return null;
}

export function describeArtworkError(error: unknown): ArtworkError {
  if (!(error instanceof ApiError)) {
    return { code: null, message: 'Не удалось выполнить действие. Попробуйте ещё раз.', reload: false };
  }
  if (error.status === 0) {
    return { code: null, message: 'Нет связи с сервером. Проверьте подключение.', reload: false };
  }

  const code = domainCode(error);
  if (code && CODE_MESSAGE[code]) {
    // Конфликтные коды требуют перечитать состояние.
    const reload =
      error.status === 409 ||
      code === 'ARTWORK_NOT_FOUND' ||
      code === 'ARTWORK_CONFLICT' ||
      code === 'ARTWORK_STATUS_UNCHANGED' ||
      code === 'ARTWORK_TRANSITION_FORBIDDEN';
    return { code, message: CODE_MESSAGE[code], reload };
  }

  switch (error.status) {
    case 400:
      return { code, message: error.message || 'Некорректные данные.', reload: false };
    case 401:
      return { code, message: 'Сессия истекла. Войдите заново.', reload: false };
    case 403:
      return { code, message: 'Недостаточно прав для действия.', reload: false };
    case 404:
      return { code, message: 'Не найдено. Данные обновлены.', reload: true };
    case 409:
      return { code, message: 'Состояние изменилось. Данные обновлены.', reload: true };
    case 413:
      return { code, message: 'Файл слишком большой.', reload: false };
    case 429:
      return { code, message: 'Слишком много действий. Подождите минуту.', reload: false };
    default:
      return { code, message: error.message || 'Ошибка сервера.', reload: error.status >= 500 };
  }
}
