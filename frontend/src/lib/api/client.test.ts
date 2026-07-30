// @vitest-environment jsdom
/**
 * apiFetch 401-обработка: единичный refresh + ровно один повтор с новым access.
 * 403 не триггерит refresh; на auth-эндпоинтах авто-refresh не делаем.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, ApiError } from './client';

const session = vi.hoisted(() => ({ getAccessToken: vi.fn(() => 'old'), refreshSession: vi.fn() }));
vi.mock('@/lib/auth/session', () => session);

function jsonRes(status: number, body: unknown) {
  return new Response(body === undefined ? '' : JSON.stringify(body), { status });
}

beforeEach(() => {
  session.getAccessToken.mockReset().mockReturnValue('old');
  session.refreshSession.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe('apiFetch 401 handling', () => {
  it('401 → один refresh и повтор с новым токеном', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonRes(401, { message: 'expired' }))
      .mockResolvedValueOnce(jsonRes(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    session.refreshSession.mockResolvedValue({ accessToken: 'new', user: {} });

    const result = await apiFetch<{ ok: boolean }>('orders', { token: 'old' });
    expect(result.ok).toBe(true);
    expect(session.refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Повтор ушёл с новым access.
    const retryHeaders = (fetchMock.mock.calls[1][1] as RequestInit).headers as Record<string, string>;
    expect(retryHeaders.Authorization).toBe('Bearer new');
  });

  it('401 при неудачном refresh → пробрасывает 401 без второго повтора', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes(401, { message: 'expired' }));
    vi.stubGlobal('fetch', fetchMock);
    session.refreshSession.mockResolvedValue(null);

    await expect(apiFetch('orders', { token: 'old' })).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1); // без нового токена не повторяем
  });

  it('403 не триггерит refresh', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes(403, { message: 'forbidden' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('admin/orders', { token: 'old' })).rejects.toMatchObject({ status: 403 });
    expect(session.refreshSession).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('на auth-эндпоинтах авто-refresh не делаем (нет рекурсии)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes(401, { message: 'no' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('auth/refresh', { method: 'POST', token: 'old' })).rejects.toMatchObject({ status: 401 });
    expect(session.refreshSession).not.toHaveBeenCalled();
  });

  it('без токена (аноним) refresh не запускается', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes(401, { message: 'no' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('cart')).rejects.toMatchObject({ status: 401 });
    expect(session.refreshSession).not.toHaveBeenCalled();
  });

  it('ApiError экспортируется и несёт статус', () => {
    expect(new ApiError(429, 'slow').status).toBe(429);
  });
});
