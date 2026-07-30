// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditHistory } from './audit-history';
import type { Paginated, PricingAuditEntry } from '@/lib/api/admin-pricing';

const api = vi.hoisted(() => ({ getPricingAudit: vi.fn() }));
const auth = vi.hoisted(() => ({ token: 'jwt' as string | null }));

vi.mock('@/lib/api/admin-pricing', () => api);
vi.mock('@/lib/api/auth', () => ({ tokenStorage: { getAccessToken: () => auth.token } }));

function page(items: PricingAuditEntry[], total = items.length): Paginated<PricingAuditEntry> {
  return { items, total, page: 1, pageSize: 10 };
}

beforeEach(() => {
  api.getPricingAudit.mockReset();
  auth.token = 'jwt';
});
afterEach(() => cleanup());

describe('AuditHistory', () => {
  it('показывает безопасное имя сотрудника и действие, без сырого actorId', async () => {
    api.getPricingAudit.mockResolvedValue(
      page([
        {
          id: 'a-1',
          action: 'pricing.publish',
          entityType: 'PriceList',
          entityId: '2a7913d8-0f42-4adb-a64b-fbca56db4e60',
          changedBy: { displayName: 'Пётр Ценников' },
          before: { status: 'DRAFT' },
          after: { status: 'ACTIVE', version: 4 },
          createdAt: '2026-07-26T10:00:00.000Z',
        },
      ]),
    );
    render(<AuditHistory priceListId="pl-1" />);
    expect(await screen.findByText('Пётр Ценников')).toBeTruthy();
    expect(screen.getByText(/опубликовал версию/)).toBeTruthy();
    // Сырой actorId/uuid не отображается.
    expect(screen.queryByText(/2a7913d8/)).toBeNull();
  });

  it('запрашивает историю по priceListId', async () => {
    api.getPricingAudit.mockResolvedValue(page([]));
    render(<AuditHistory priceListId="pl-42" />);
    await waitFor(() => expect(api.getPricingAudit).toHaveBeenCalledWith('jwt', { priceListId: 'pl-42', page: 1, pageSize: 10 }));
    expect(await screen.findByText('Изменений пока нет.')).toBeTruthy();
  });

  it('различает действия clone/rule/publish понятными подписями', async () => {
    api.getPricingAudit.mockResolvedValue(
      page([
        { id: 'a1', action: 'pricing.draft.clone', entityType: 'PriceList', entityId: 'x', changedBy: { displayName: 'Анна' }, before: null, after: { version: 5 }, createdAt: '2026-07-26T10:00:00.000Z' },
        { id: 'a2', action: 'pricing.rule.update', entityType: 'PriceRule', entityId: 'y', changedBy: { displayName: 'Анна' }, before: null, after: { kind: 'SURCHARGE_FLAT' }, createdAt: '2026-07-26T10:01:00.000Z' },
      ]),
    );
    render(<AuditHistory priceListId="pl-1" />);
    expect(await screen.findByText(/создал черновик/)).toBeTruthy();
    expect(screen.getByText(/изменил правило/)).toBeTruthy();
  });
});
