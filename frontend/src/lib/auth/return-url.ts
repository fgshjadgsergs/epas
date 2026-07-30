/**
 * Возврат на исходную страницу после входа/регистрации.
 *
 * Адрес передаётся query-параметром `?return=`. Принимаются только внутренние
 * относительные пути: значение вида `//evil.example` или `https://…` игнорируется,
 * иначе ссылка «Войти» превращается в открытый редирект.
 */

export const RETURN_URL_PARAM = 'return';

/** Куда уходит пользователь, если корректного `return` в адресе нет. */
export const DEFAULT_RETURN_URL = '/lichnyy-kabinet/';

/** Безопасен ли путь для router.push: только свой сайт, без схемы и хоста. */
export function isSafeReturnUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  if (!value.startsWith('/')) return false;
  if (value.startsWith('//')) return false; // protocol-relative → чужой хост
  if (value.includes('\\')) return false; // обход нормализации в части браузеров
  return true;
}

/** Проверенный путь возврата либо личный кабинет. */
export function safeReturnUrl(value: string | null | undefined): string {
  return isSafeReturnUrl(value) ? value : DEFAULT_RETURN_URL;
}

/** Ссылка на страницу входа, которая вернёт пользователя обратно на `target`. */
export function loginUrlWithReturn(target: string): string {
  const base = '/lichnyy-kabinet/vhod-registraciya/';
  if (!isSafeReturnUrl(target)) return base;
  return `${base}?${RETURN_URL_PARAM}=${encodeURIComponent(target)}`;
}
