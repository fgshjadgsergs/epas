import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/client';
import { describePricingError } from './pricing-errors';

const withCode = (status: number, code: string, message = 'x') =>
  new ApiError(status, message, { code } as never);

describe('describePricingError', () => {
  it('409 PRICING_DRAFT_CONFLICT → draftConflict + reload', () => {
    const r = describePricingError(withCode(409, 'PRICING_DRAFT_CONFLICT'));
    expect(r.kind).toBe('draftConflict');
    expect(r.reload).toBe(true);
    expect(r.message).toMatch(/изменён другим/);
  });

  it('409 PRICING_NOT_DRAFT → notDraft + reload', () => {
    expect(describePricingError(withCode(409, 'PRICING_NOT_DRAFT')).kind).toBe('notDraft');
  });

  it('409 PRICING_IMMUTABLE → immutable + reload', () => {
    const r = describePricingError(withCode(409, 'PRICING_IMMUTABLE'));
    expect(r.kind).toBe('immutable');
    expect(r.reload).toBe(true);
  });

  it('409 без известного кода → periodConflict + reload', () => {
    const r = describePricingError(new ApiError(409, 'Период пересекается'));
    expect(r.kind).toBe('periodConflict');
    expect(r.reload).toBe(true);
  });

  it('403 с «демо» → demoForbidden', () => {
    expect(describePricingError(new ApiError(403, 'Демо-прайс нельзя активировать')).kind).toBe('demoForbidden');
  });

  it('403 прочее → forbidden', () => {
    expect(describePricingError(new ApiError(403, 'forbidden')).kind).toBe('forbidden');
  });

  it('400 → validation с деталями', () => {
    const r = describePricingError(new ApiError(400, 'bad', ['e1', 'e2']));
    expect(r.kind).toBe('validation');
    expect(r.details).toEqual(['e1', 'e2']);
  });

  it('401 → unauthorized, 404 → notFound(reload), 429 → rateLimit', () => {
    expect(describePricingError(new ApiError(401, 'x')).kind).toBe('unauthorized');
    const nf = describePricingError(new ApiError(404, 'x'));
    expect(nf.kind).toBe('notFound');
    expect(nf.reload).toBe(true);
    expect(describePricingError(new ApiError(429, 'x')).kind).toBe('rateLimit');
  });

  it('ApiError(0) → network; 500 → unknown+reload', () => {
    expect(describePricingError(new ApiError(0, 'x')).kind).toBe('network');
    const r = describePricingError(new ApiError(500, 'x'));
    expect(r.kind).toBe('unknown');
    expect(r.reload).toBe(true);
  });

  it('не-ApiError → unknown', () => {
    expect(describePricingError(new Error('boom')).kind).toBe('unknown');
  });
});
