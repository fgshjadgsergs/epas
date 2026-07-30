import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/client';
import { describeStatusChangeError } from './status-change-errors';

describe('describeStatusChangeError', () => {
  it('409 → конфликт, заказ перечитывается', () => {
    const r = describeStatusChangeError(new ApiError(409, 'Статус уже изменён'));
    expect(r.kind).toBe('conflict');
    expect(r.reload).toBe(true);
  });

  it('403 → нет прав, без перезагрузки', () => {
    const r = describeStatusChangeError(new ApiError(403, 'Недостаточно прав'));
    expect(r.kind).toBe('forbidden');
    expect(r.reload).toBe(false);
  });

  it('401 → сессия истекла', () => {
    expect(describeStatusChangeError(new ApiError(401, 'x')).kind).toBe('unauthorized');
  });

  it('404 → заказ не найден', () => {
    expect(describeStatusChangeError(new ApiError(404, 'x')).kind).toBe('notFound');
  });

  it('400 → ошибка данных', () => {
    expect(describeStatusChangeError(new ApiError(400, 'x')).kind).toBe('validation');
  });

  it('429 → rate limit', () => {
    expect(describeStatusChangeError(new ApiError(429, 'x')).kind).toBe('rateLimit');
  });

  it('ApiError(0) → сеть', () => {
    const r = describeStatusChangeError(new ApiError(0, 'нет связи'));
    expect(r.kind).toBe('network');
  });

  it('500 → неизвестная, перечитываем', () => {
    const r = describeStatusChangeError(new ApiError(500, 'x'));
    expect(r.kind).toBe('unknown');
    expect(r.reload).toBe(true);
  });

  it('не-ApiError → общее сообщение', () => {
    expect(describeStatusChangeError(new Error('boom')).kind).toBe('unknown');
  });
});
