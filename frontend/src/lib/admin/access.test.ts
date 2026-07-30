import { describe, expect, it } from 'vitest';
import {
  canAccessArtworks,
  canAccessOrders,
  canAccessPricing,
  canEditPricing,
  canManageCatalog,
  canPublishPricing,
  hasAnyAdminAccess,
} from './access';

describe('capability gating по permissions', () => {
  it('разделы гейтятся по конкретному праву', () => {
    expect(canAccessOrders(['orders.read'])).toBe(true);
    expect(canAccessPricing(['pricing.read'])).toBe(true);
    expect(canAccessArtworks(['artwork.read'])).toBe(true);
    expect(canManageCatalog(['catalog.manage'])).toBe(true);
  });

  it('нет права — нет доступа', () => {
    expect(canAccessOrders(['catalog.manage'])).toBe(false);
    expect(canManageCatalog(['orders.read'])).toBe(false);
    expect(canManageCatalog(null)).toBe(false);
    expect(canManageCatalog(undefined)).toBe(false);
  });

  it('pricing edit/publish — по отдельным правам, не по read', () => {
    expect(canEditPricing(['pricing.read'])).toBe(false);
    expect(canEditPricing(['pricing.draft.edit'])).toBe(true);
    expect(canPublishPricing(['pricing.draft.edit'])).toBe(false);
    expect(canPublishPricing(['pricing.publish'])).toBe(true);
  });

  it('hasAnyAdminAccess: любой admin-раздел открывает панель', () => {
    expect(hasAnyAdminAccess(['orders.read'])).toBe(true);
    expect(hasAnyAdminAccess(['catalog.manage'])).toBe(true);
    expect(hasAnyAdminAccess([])).toBe(false);
    expect(hasAnyAdminAccess(['some.unrelated'])).toBe(false);
  });
});
