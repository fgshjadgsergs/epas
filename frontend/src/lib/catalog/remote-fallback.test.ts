/**
 * F-9: классификация ошибки каталога различает недоступность backend и
 * авторитетный 410 Gone. Тестируем чистую функцию (без промис-моков):
 *  B. network failure (status 0) → null (фолбэк на статику);
 *  C. 410 Gone                   → GONE (НЕ воскрешать деактивированный узел);
 *  D. 404                        → null (нет узла — вариант живёт на статике);
 *  E. прочее (5xx)               → null (страница не падает).
 */
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/client';
import { classifyCatalogError, GONE } from './remote';

describe('F-9: classifyCatalogError', () => {
  it('C: 410 Gone → GONE (деактивированную сущность не воскрешаем)', () => {
    expect(classifyCatalogError(new ApiError(410, 'gone'))).toBe(GONE);
  });

  it('D: 404 → null (нет отдельной backend-записи — фолбэк на статику)', () => {
    expect(classifyCatalogError(new ApiError(404, 'not found'))).toBeNull();
  });

  it('B: недоступность backend (status 0) → null (фолбэк на статику)', () => {
    expect(classifyCatalogError(new ApiError(0, 'network'))).toBeNull();
  });

  it('E: прочая ошибка (5xx / не ApiError) → null (страница не падает)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(classifyCatalogError(new ApiError(500, 'boom'))).toBeNull();
    expect(classifyCatalogError(new Error('unexpected'))).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
