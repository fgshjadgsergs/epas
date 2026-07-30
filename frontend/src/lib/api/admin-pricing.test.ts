import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clonePriceListDraft,
  createPriceList,
  createDraftRule,
  deleteDraftRule,
  dryRunDraft,
  getPriceLists,
  getPricingAudit,
  getPricingDefinitions,
  publishDraft,
  updateDraftRule,
  validateDraft,
} from './admin-pricing';

function mockFetch(body: unknown = { ok: true }) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify(body) });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function lastCall(fetchMock: ReturnType<typeof vi.fn>) {
  const call = fetchMock.mock.calls.at(-1)!;
  return { url: String(call[0]), init: call[1] as { method?: string; body?: string; headers: Record<string, string> } };
}

describe('admin-pricing API client', () => {
  let fetchMock: ReturnType<typeof mockFetch>;
  beforeEach(() => {
    fetchMock = mockFetch();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('read-запросы идут GET с токеном', async () => {
    await getPricingDefinitions('jwt', { page: 2 });
    let { url, init } = lastCall(fetchMock);
    expect(url).toContain('admin/pricing/definitions');
    expect(url).toContain('page=2');
    expect(init.method ?? 'GET').toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer jwt');

    await getPriceLists('def-1', 'jwt');
    ({ url } = lastCall(fetchMock));
    expect(url).toContain('admin/pricing/definitions/def-1/price-lists');
  });

  it('clone — POST без тела', async () => {
    await clonePriceListDraft('pl-1', 'jwt');
    const { url, init } = lastCall(fetchMock);
    expect(url).toMatch(/price-lists\/pl-1\/clone-draft$/);
    expect(init.method).toBe('POST');
  });

  it('createPriceList — POST на definitions/:id/price-lists без тела', async () => {
    await createPriceList('def-1', 'jwt');
    const { url, init } = lastCall(fetchMock);
    expect(url).toMatch(/definitions\/def-1\/price-lists$/);
    expect(init.method).toBe('POST');
  });

  it('createDraftRule шлёт POST с expectedRevision, без actorId', async () => {
    await createDraftRule('pl-1', { kind: 'SURCHARGE_FLAT', amountMinor: 500, expectedRevision: 3 }, 'jwt');
    const { url, init } = lastCall(fetchMock);
    expect(url).toMatch(/price-lists\/pl-1\/rules$/);
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body!);
    expect(body.expectedRevision).toBe(3);
    expect(body).not.toHaveProperty('actorId');
  });

  it('updateDraftRule — PATCH по ruleId', async () => {
    await updateDraftRule('pl-1', 'r-1', { kind: 'MULTIPLIER', multiplier: 1.2, expectedRevision: 4 }, 'jwt');
    const { url, init } = lastCall(fetchMock);
    expect(url).toMatch(/price-lists\/pl-1\/rules\/r-1$/);
    expect(init.method).toBe('PATCH');
  });

  it('deleteDraftRule — DELETE с revision в теле', async () => {
    await deleteDraftRule('pl-1', 'r-1', 5, 'jwt');
    const { url, init } = lastCall(fetchMock);
    expect(url).toMatch(/price-lists\/pl-1\/rules\/r-1$/);
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(init.body!).expectedRevision).toBe(5);
  });

  it('validate/dry-run — POST', async () => {
    await validateDraft('pl-1', 'jwt');
    expect(lastCall(fetchMock).url).toMatch(/price-lists\/pl-1\/validate$/);
    expect(lastCall(fetchMock).init.method).toBe('POST');

    await dryRunDraft('pl-1', { parameters: { qty: 500 } }, 'jwt');
    const { url, init } = lastCall(fetchMock);
    expect(url).toMatch(/price-lists\/pl-1\/dry-run$/);
    expect(JSON.parse(init.body!).parameters.qty).toBe(500);
  });

  it('publish — POST с expectedRevision, без actorId', async () => {
    await publishDraft('pl-1', 7, 'jwt');
    const { url, init } = lastCall(fetchMock);
    expect(url).toMatch(/price-lists\/pl-1\/publish$/);
    const body = JSON.parse(init.body!);
    expect(body.expectedRevision).toBe(7);
    expect(body).not.toHaveProperty('actorId');
  });

  it('audit — GET с фильтрами', async () => {
    await getPricingAudit('jwt', { priceListId: 'pl-1', action: 'pricing.publish', page: 2 });
    const { url, init } = lastCall(fetchMock);
    expect(url).toContain('admin/pricing/audit');
    expect(url).toContain('priceListId=pl-1');
    expect(url).toContain('action=pricing.publish');
    expect(url).toContain('page=2');
    expect(init.method ?? 'GET').toBe('GET');
  });
});
