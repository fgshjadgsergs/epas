/**
 * Ошибки admin-каталога → понятное русское сообщение + флаг «перечитать».
 * Backend отдаёт стабильные HTTP-статусы (409 на дубликат slug, 400 на
 * валидацию); текст не парсим. При conflict/404 состояние перечитывается.
 */
import { ApiError } from '@/lib/api/client';

export interface CatalogError {
  message: string;
  reload: boolean;
}

export function describeCatalogError(error: unknown): CatalogError {
  if (!(error instanceof ApiError)) {
    return { message: 'Не удалось выполнить действие. Попробуйте ещё раз.', reload: false };
  }
  switch (error.status) {
    case 0:
      return { message: 'Нет связи с сервером. Проверьте подключение.', reload: false };
    case 400:
      return { message: error.message || 'Проверьте правильность заполнения полей.', reload: false };
    case 401:
      return { message: 'Сессия истекла. Войдите заново.', reload: false };
    case 403:
      return { message: 'Недостаточно прав для управления каталогом.', reload: false };
    case 404:
      return { message: 'Запись не найдена — данные обновлены.', reload: true };
    case 409:
      // Чаще всего — занятый slug или удаление занятой категории.
      return { message: error.message || 'Конфликт: значение уже используется.', reload: true };
    case 413:
      return { message: 'Файл слишком большой.', reload: false };
    case 429:
      return { message: 'Слишком много действий. Подождите минуту.', reload: false };
    default:
      return { message: error.message || 'Ошибка сервера.', reload: error.status >= 500 };
  }
}

/** Дубликат slug backend отдаёт как 409 — определяем по статусу, не по тексту. */
export function isDuplicateSlug(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}
