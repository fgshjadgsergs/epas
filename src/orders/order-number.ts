import { randomInt } from 'node:crypto';

/**
 * Человекочитаемый номер заказа: `KP-YYYYMMDD-XXXXXX`.
 *
 * Дата — для удобства оператора; шестизначный суффикс из криптослучайных цифр
 * делает номер непредсказуемым и НЕ раскрывает объём заказов (в отличие от
 * простого автоинкремента). Уникальность гарантирует unique-индекс в БД: при
 * коллизии вызывающий код повторяет генерацию.
 */
export function generateOrderNumber(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const suffix = String(randomInt(0, 1_000_000)).padStart(6, '0');
  return `KP-${y}${m}${d}-${suffix}`;
}
