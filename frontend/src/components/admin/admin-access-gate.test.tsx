// @vitest-environment jsdom
/**
 * UX-гейт по PERMISSIONS поверх сессии: loading не мигает, аноним → редирект,
 * нет права → 403-экран, есть право → контент. Backend остаётся authority.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAccessGate } from './admin-access-gate';

interface AuthMock {
  status: 'loading' | 'authenticated' | 'anonymous';
  permissions: string[];
}
const auth = vi.hoisted(() => ({ value: { status: 'loading', permissions: [] } as AuthMock }));
const router = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ status: auth.value.status, permissions: auth.value.permissions, roles: [] }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

beforeEach(() => { auth.value = { status: 'loading', permissions: [] }; router.replace.mockReset(); });
afterEach(() => cleanup());

describe('AdminAccessGate', () => {
  it('loading: показывает проверку доступа, контент скрыт', () => {
    auth.value = { status: 'loading', permissions: [] };
    render(<AdminAccessGate returnUrl="/admin/orders/">панель</AdminAccessGate>);
    expect(screen.getByText('Проверяем доступ…')).toBeTruthy();
    expect(screen.queryByText('панель')).toBeNull();
  });

  it('аноним → редирект на вход с безопасным return URL', async () => {
    auth.value = { status: 'anonymous', permissions: [] };
    render(<AdminAccessGate returnUrl="/admin/orders/">панель</AdminAccessGate>);
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
    expect(String(router.replace.mock.calls[0][0])).toContain('return=%2Fadmin%2Forders%2F');
  });

  it('аутентифицирован без прав → «Нет доступа»', () => {
    auth.value = { status: 'authenticated', permissions: [] };
    render(<AdminAccessGate returnUrl="/admin/orders/">секрет</AdminAccessGate>);
    expect(screen.getByText('Нет доступа')).toBeTruthy();
    expect(screen.queryByText('секрет')).toBeNull();
  });

  it('capability="catalog": без catalog.manage → 403', () => {
    auth.value = { status: 'authenticated', permissions: ['orders.read'] };
    render(<AdminAccessGate returnUrl="/admin/catalog/" capability="catalog">каталог</AdminAccessGate>);
    expect(screen.getByText('Нет доступа')).toBeTruthy();
  });

  it('capability="catalog": с catalog.manage → контент', () => {
    auth.value = { status: 'authenticated', permissions: ['catalog.manage'] };
    render(<AdminAccessGate returnUrl="/admin/catalog/" capability="catalog">каталог</AdminAccessGate>);
    expect(screen.getByText('каталог')).toBeTruthy();
  });

  it('любой admin-доступ по умолчанию пускает в панель', () => {
    auth.value = { status: 'authenticated', permissions: ['orders.read'] };
    render(<AdminAccessGate returnUrl="/admin/orders/">рабочая-панель</AdminAccessGate>);
    expect(screen.getByText('рабочая-панель')).toBeTruthy();
  });
});
