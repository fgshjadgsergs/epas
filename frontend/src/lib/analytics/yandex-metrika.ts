/**
 * Безопасный адаптер Яндекс.Метрики (ТЗ «URL-адреса в калькуляторах»).
 *
 * Единственная точка обращения к window.ym — компоненты не трогают глобал
 * напрямую. Без счётчика (env не задан) или без загруженного ym — no-op,
 * приложение не падает.
 *
 * В metadata событий НЕЛЬЗЯ передавать персональные данные: промокоды,
 * email/телефон/имя, токены, B2B-реквизиты, персональные скидки.
 */
import { site } from '@/lib/site';

type YmFn = (id: number, action: string, ...args: unknown[]) => void;

const COUNTER_ID =
  Number(process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID ?? '') || site.yandexMetrikaId || 0;

function callYm(action: string, ...args: unknown[]): void {
  if (typeof window === 'undefined' || !COUNTER_ID) return;
  const fn = (window as unknown as { ym?: YmFn }).ym;
  if (typeof fn !== 'function') return;
  try {
    fn(COUNTER_ID, action, ...args);
  } catch {
    // Аналитика не должна ломать приложение ни при каких обстоятельствах.
  }
}

/**
 * Виртуальный просмотр страницы — вызывается ТОЛЬКО после успешного
 * pushState (не при инициализации и не при popstate).
 */
export function trackVirtualHit(url: string, options: { title: string; referer?: string }): void {
  callYm('hit', url, options);
}

/** Достижение цели. Параметры — только неперсональные машинные значения. */
export function trackGoal(name: string, params?: Record<string, unknown>): void {
  callYm('reachGoal', name, params);
}
