// @vitest-environment jsdom
/**
 * Сессия: access только в памяти, single-flight refresh, чистка legacy-ключей.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAccessToken,
  clearLegacyAuthStorage,
  getAccessToken,
  refreshSession,
  setSession,
} from './session';

describe('session store', () => {
  beforeEach(() => {
    clearAccessToken();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it('access token живёт только в памяти, не в localStorage', () => {
    setSession({ accessToken: 'abc', user: { id: 'u', email: 'e', firstName: null, lastName: null, roles: [], permissions: [] } });
    expect(getAccessToken()).toBe('abc');
    // Нигде в localStorage токен не появляется.
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)!;
      expect(window.localStorage.getItem(key)).not.toContain('abc');
    }
    clearAccessToken();
    expect(getAccessToken()).toBeNull();
  });

  it('refreshSession single-flight: параллельные вызовы = один POST /auth/refresh', async () => {
    let calls = 0;
    let resolveFetch: (v: Response) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        calls += 1;
        return new Promise<Response>((res) => {
          resolveFetch = res;
        });
      }),
    );

    const p1 = refreshSession();
    const p2 = refreshSession();
    const p3 = refreshSession();
    expect(calls).toBe(1); // ровно одна ротация на пачку

    resolveFetch(
      new Response(JSON.stringify({ accessToken: 'new', user: { id: 'u', email: 'e', firstName: null, lastName: null, roles: [], permissions: [] } }), { status: 200 }),
    );
    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    expect(r1?.accessToken).toBe('new');
    expect(r2).toBe(r1);
    expect(r3).toBe(r1);
    expect(getAccessToken()).toBe('new');
  });

  it('провал refresh (401) → null и очистка токена', async () => {
    setSession({ accessToken: 'old', user: { id: 'u', email: 'e', firstName: null, lastName: null, roles: [], permissions: [] } });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401 })));
    const r = await refreshSession();
    expect(r).toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it('clearLegacyAuthStorage удаляет старые demo-ключи', () => {
    window.localStorage.setItem('pp_access_token', 'x');
    window.localStorage.setItem('pp_refresh_token', 'y');
    clearLegacyAuthStorage();
    expect(window.localStorage.getItem('pp_access_token')).toBeNull();
    expect(window.localStorage.getItem('pp_refresh_token')).toBeNull();
  });
});
