/**
 * Безопасная сериализация для <script type="application/ld+json">.
 *
 * JSON.stringify может содержать `<`/`>`/`&` (например, из редактируемого
 * контент-менеджером описания услуги) и закрыть тег раньше времени — это XSS.
 * Плюс U+2028/U+2029 ломают встроенный JSON. Экранируем их в безопасные \uXXXX
 * — значение попадает внутрь script-тега как данные, не как разметка.
 */
const UNSAFE_JSONLD = new RegExp('[<>&' + String.fromCharCode(0x2028, 0x2029) + ']', 'g');
const BACKSLASH_U = String.fromCharCode(92) + 'u';

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(
    UNSAFE_JSONLD,
    (ch) => BACKSLASH_U + ch.charCodeAt(0).toString(16).padStart(4, '0'),
  );
}
