/**
 * Ключ идемпотентности оформления заказа.
 *
 * Ключ привязан к конкретной версии конкретной корзины (`cartId:cartVersion`):
 *
 * - повторный клик и сетевой retry по той же корзине используют ТОТ ЖЕ ключ,
 *   поэтому backend вернёт уже созданный заказ, а не создаст второй;
 * - любая мутация корзины поднимает `version` на сервере, и ключ создаётся
 *   заново — новая корзина = новый заказ;
 * - после успешного оформления ключ удаляется.
 *
 * В sessionStorage хранится ТОЛЬКО пара идентификаторов и uuid: ни состава
 * заказа, ни цен, ни контактов там нет.
 */

const STORAGE_KEY = 'kp_checkout_idempotency';

interface StoredKey {
  cartId: string;
  cartVersion: number;
  key: string;
}

/** crypto.randomUUID есть во всех поддерживаемых браузерах; fallback — на всякий случай. */
function newUuid(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();

  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // версия 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // вариант 10x
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function readStored(): StoredKey | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredKey>;
    if (typeof parsed.cartId !== 'string') return null;
    if (typeof parsed.cartVersion !== 'number') return null;
    if (typeof parsed.key !== 'string' || !parsed.key) return null;
    return { cartId: parsed.cartId, cartVersion: parsed.cartVersion, key: parsed.key };
  } catch {
    // Недоступный или повреждённый sessionStorage не должен ломать оформление.
    return null;
  }
}

/**
 * Ключ для попытки оформления данной версии корзины. Для одной и той же пары
 * (cartId, cartVersion) всегда возвращает один и тот же uuid.
 */
export function idempotencyKeyFor(cartId: string, cartVersion: number): string {
  if (typeof window === 'undefined') return newUuid();

  const stored = readStored();
  if (stored && stored.cartId === cartId && stored.cartVersion === cartVersion) {
    return stored.key;
  }

  const fresh: StoredKey = { cartId, cartVersion, key: newUuid() };
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  } catch {
    // Приватный режим без storage — ключ всё равно валиден в пределах попытки.
  }
  return fresh.key;
}

/** Снять ключ после успешного заказа: следующая корзина получит новый. */
export function clearIdempotencyKey(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
}
