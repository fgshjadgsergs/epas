/**
 * Устаревшая обёртка. Единственная точка доступа к Яндекс.Метрике —
 * @/lib/analytics/yandex-metrika (счётчик из NEXT_PUBLIC_YANDEX_METRIKA_ID).
 * Оставлена как делегат для обратной совместимости старых импортов.
 */
import { trackGoal, trackVirtualHit } from '@/lib/analytics/yandex-metrika';

/** @deprecated используйте trackVirtualHit из @/lib/analytics/yandex-metrika */
export function calcHit(path: string, title: string, referer?: string) {
  trackVirtualHit(path, { title, referer });
}

/** @deprecated используйте trackGoal из @/lib/analytics/yandex-metrika */
export function calcGoal(name: string, params?: Record<string, unknown>) {
  trackGoal(name, params);
}
