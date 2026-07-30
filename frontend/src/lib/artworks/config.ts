/**
 * Клиентские ограничения макета (зеркалят backend allowlist/размер только для
 * UX-подсказок). НЕ security boundary — источник истины остаётся backend.
 */
export const ARTWORK_ACCEPT_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const ARTWORK_ACCEPT_ATTR = ARTWORK_ACCEPT_MIME.join(',');
export const ARTWORK_ACCEPT_LABEL = 'JPEG, PNG, WebP, PDF';

/** Совпадает с backend FILES_MAX_SIZE_BYTES (20 МБ) — только для ранней подсказки. */
export const ARTWORK_MAX_SIZE_BYTES = 20 * 1024 * 1024;
export const ARTWORK_MAX_SIZE_LABEL = '20 МБ';

/** Быстрая клиентская проверка перед загрузкой (не заменяет backend). */
export function precheckArtworkFile(file: File): string | null {
  if (file.size > ARTWORK_MAX_SIZE_BYTES) {
    return `Файл больше ${ARTWORK_MAX_SIZE_LABEL}. Уменьшите размер и попробуйте снова.`;
  }
  if (file.type && !ARTWORK_ACCEPT_MIME.includes(file.type)) {
    return `Недопустимый формат. Разрешены: ${ARTWORK_ACCEPT_LABEL}.`;
  }
  return null;
}
