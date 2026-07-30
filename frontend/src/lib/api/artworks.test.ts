import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachArtwork, getArtworkDownloadUrl, getMyFiles, getOrderItemArtworks, withdrawArtwork } from './artworks';
import { changeArtworkStatus, getAdminArtwork, getAdminArtworks } from './admin-artworks';

function mockFetch(body: unknown = { ok: true }) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify(body) });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
function lastCall(m: ReturnType<typeof vi.fn>) {
  const c = m.mock.calls.at(-1)!;
  return { url: String(c[0]), init: c[1] as { method?: string; body?: string; headers: Record<string, string> } };
}

describe('artworks API client (customer)', () => {
  let m: ReturnType<typeof mockFetch>;
  beforeEach(() => (m = mockFetch()));
  afterEach(() => vi.unstubAllGlobals());

  it('list — GET по позиции', async () => {
    await getOrderItemArtworks('o1', 'i1', 'jwt');
    expect(lastCall(m).url).toMatch(/orders\/o1\/items\/i1\/artworks$/);
    expect(lastCall(m).init.headers.Authorization).toBe('Bearer jwt');
  });

  it('attach — POST только fileId+comment, без reviewer/user id', async () => {
    await attachArtwork('o1', 'i1', { fileId: 'f1', customerComment: 'см. цвет' }, 'jwt');
    const { url, init } = lastCall(m);
    expect(url).toMatch(/orders\/o1\/items\/i1\/artworks$/);
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body!);
    expect(Object.keys(body).sort()).toEqual(['customerComment', 'fileId']);
    for (const bad of ['userId', 'reviewerId', 'storageKey', 'bucket']) expect(body).not.toHaveProperty(bad);
  });

  it('withdraw — POST', async () => {
    await withdrawArtwork('o1', 'i1', 'a1', 'jwt');
    expect(lastCall(m).url).toMatch(/artworks\/a1\/withdraw$/);
    expect(lastCall(m).init.method).toBe('POST');
  });

  it('download URL — GET', async () => {
    await getArtworkDownloadUrl('o1', 'i1', 'a1', 'jwt');
    expect(lastCall(m).url).toMatch(/artworks\/a1\/download$/);
  });

  it('my-files — GET files/my с пагинацией', async () => {
    await getMyFiles('jwt', { page: 2 });
    expect(lastCall(m).url).toContain('files/my');
    expect(lastCall(m).url).toContain('page=2');
  });
});

describe('admin-artworks API client', () => {
  let m: ReturnType<typeof mockFetch>;
  beforeEach(() => (m = mockFetch()));
  afterEach(() => vi.unstubAllGlobals());

  it('list — GET с фильтрами', async () => {
    await getAdminArtworks('jwt', { status: 'UPLOADED', orderNumber: 'KP-1', page: 2 });
    const { url } = lastCall(m);
    expect(url).toContain('admin/artworks');
    expect(url).toContain('status=UPLOADED');
    expect(url).toContain('orderNumber=KP-1');
  });

  it('detail — GET по id', async () => {
    await getAdminArtwork('a1', 'jwt');
    expect(lastCall(m).url).toMatch(/admin\/artworks\/a1$/);
  });

  it('changeStatus — PATCH только status+comment, без reviewer id', async () => {
    await changeArtworkStatus('a1', { status: 'REJECTED', comment: 'плохо' }, 'jwt');
    const { url, init } = lastCall(m);
    expect(url).toMatch(/admin\/artworks\/a1\/status$/);
    expect(init.method).toBe('PATCH');
    const body = JSON.parse(init.body!);
    expect(Object.keys(body).sort()).toEqual(['comment', 'status']);
    expect(body).not.toHaveProperty('reviewedByUserId');
  });
});
