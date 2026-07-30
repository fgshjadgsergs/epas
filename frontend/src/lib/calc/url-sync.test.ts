import { describe, it, expect } from 'vitest';
import { buildDefaultState, stateToSearch, searchToState } from './url-sync';
import { businessCards } from './configs/business-cards';

describe('url-sync', () => {
  it('значения по умолчанию не попадают в URL', () => {
    const st = buildDefaultState(businessCards);
    expect(stateToSearch(businessCards, st)).toBe('');
  });

  it('изменённые параметры сериализуются', () => {
    const st = { ...buildDefaultState(businessCards), qty: 500 };
    st.params = { ...st.params, paper: 'design' };
    const search = stateToSearch(businessCards, st);
    expect(search).toContain('paper=design');
    expect(search).toContain('qty=500');
  });

  it('round-trip state → search → state сохраняет значения', () => {
    const st = { ...buildDefaultState(businessCards), qty: 1000, express: true };
    st.params = { ...st.params, coating: 'soft-touch' };
    const search = stateToSearch(businessCards, st);
    const restored = searchToState(businessCards, search, buildDefaultState(businessCards));
    expect(restored.qty).toBe(1000);
    expect(restored.express).toBe(true);
    expect(restored.params.coating).toBe('soft-touch');
  });
});
