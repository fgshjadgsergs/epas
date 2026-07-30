// @vitest-environment jsdom
/**
 * AdminShell: навигация гейтится по PERMISSIONS. «Каталог» — catalog.manage,
 * «Заказы» — orders.read и т.д. Backend остаётся authority.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminShell } from './admin-shell';
import type { AdminAccessState } from '@/lib/admin/use-admin-access';

const access = vi.hoisted(() => ({ state: { status: 'loading' } as AdminAccessState }));

vi.mock('@/lib/admin/use-admin-access', () => ({ useAdminAccess: () => access.state }));
vi.mock('@/lib/auth/auth-context', () => ({ useAuth: () => ({ signOut: vi.fn() }) }));
vi.mock('next/navigation', () => ({ usePathname: () => '/admin/catalog/' }));

beforeEach(() => { access.state = { status: 'loading' }; });
afterEach(() => cleanup());

const granted = (permissions: string[]): AdminAccessState => ({ status: 'granted', roles: [], permissions });

describe('AdminShell navigation gating', () => {
  it('catalog.manage видит «Каталог», но не «Заказы»/«Прайсы»/«Макеты»', () => {
    access.state = granted(['catalog.manage']);
    render(<AdminShell><div /></AdminShell>);
    expect(screen.getAllByText('Каталог').length).toBeGreaterThan(0);
    expect(screen.queryByText('Заказы')).toBeNull();
    expect(screen.queryByText('Прайсы')).toBeNull();
    expect(screen.queryByText('Макеты')).toBeNull();
  });

  it('orders.read видит «Заказы», но не «Каталог»', () => {
    access.state = granted(['orders.read']);
    render(<AdminShell><div /></AdminShell>);
    expect(screen.getAllByText('Заказы').length).toBeGreaterThan(0);
    expect(screen.queryByText('Каталог')).toBeNull();
  });

  it('полный набор прав показывает все разделы', () => {
    access.state = granted(['orders.read', 'pricing.read', 'artwork.read', 'catalog.manage']);
    render(<AdminShell><div /></AdminShell>);
    for (const label of ['Заказы', 'Прайсы', 'Макеты', 'Каталог']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it('до подтверждения сессии разделов не показываем', () => {
    access.state = { status: 'loading' };
    render(<AdminShell><div /></AdminShell>);
    expect(screen.queryByText('Каталог')).toBeNull();
    expect(screen.queryByText('Заказы')).toBeNull();
  });
});
