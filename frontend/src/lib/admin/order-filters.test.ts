import { describe, expect, it } from 'vitest';
import {
  EMPTY_CONTACT_SEARCH,
  EMPTY_FILTERS,
  filtersFromParams,
  filtersToQuery,
  filtersToSearch,
  isDateRangeValid,
} from './order-filters';

describe('order-filters', () => {
  it('читает только безопасные фильтры из URL search params', () => {
    const params = new URLSearchParams('page=3&status=CANCELLED&from=2026-07-01&to=2026-07-31&orderNumber=KP-1');
    const f = filtersFromParams(params);
    expect(f).toEqual({
      page: 3,
      status: 'CANCELLED',
      from: '2026-07-01',
      to: '2026-07-31',
      orderNumber: 'KP-1',
    });
  });

  it('phone/email из URL игнорируются — их не должно быть в фильтрах', () => {
    const f = filtersFromParams(new URLSearchParams('phone=900&email=a@b.co&status=NEW'));
    expect(f).not.toHaveProperty('phone');
    expect(f).not.toHaveProperty('email');
    expect(f.status).toBe('NEW');
  });

  it('невалидный status в URL отбрасывается', () => {
    expect(filtersFromParams(new URLSearchParams('status=HACKED')).status).toBe('');
  });

  it('некорректный page → 1', () => {
    expect(filtersFromParams(new URLSearchParams('page=abc')).page).toBe(1);
    expect(filtersFromParams(new URLSearchParams('page=0')).page).toBe(1);
  });

  it('сериализация опускает пустые поля и page=1', () => {
    expect(filtersToSearch(EMPTY_FILTERS)).toBe('');
    expect(filtersToSearch({ ...EMPTY_FILTERS, status: 'NEW', page: 2 })).toBe('?page=2&status=NEW');
  });

  it('сериализация НИКОГДА не пишет phone/email в URL', () => {
    // Даже если фильтры расширят — сериализуем только известные безопасные ключи.
    const search = filtersToSearch({ ...EMPTY_FILTERS, status: 'NEW', orderNumber: 'KP-9' });
    expect(search).not.toContain('phone');
    expect(search).not.toContain('email');
  });

  it('roundtrip URL → filters → URL сохраняет значения', () => {
    const search = '?page=2&status=NEW&orderNumber=KP-5';
    const f = filtersFromParams(new URLSearchParams(search.slice(1)));
    expect(filtersToSearch(f)).toBe(search);
  });

  it('даты превращаются в ISO-границы суток для API', () => {
    const q = filtersToQuery({ ...EMPTY_FILTERS, from: '2026-07-01', to: '2026-07-31' });
    expect(q.from).toBe('2026-07-01T00:00:00.000Z');
    expect(q.to).toBe('2026-07-31T23:59:59.999Z');
  });

  it('контактный поиск передаётся в query отдельным аргументом', () => {
    const q = filtersToQuery({ ...EMPTY_FILTERS, status: 'NEW' }, { phone: '900', email: 'A@B.CO' });
    expect(q.phone).toBe('900');
    expect(q.email).toBe('A@B.CO');
    expect(q.status).toBe('NEW');
  });

  it('пустой контактный поиск → undefined (не шлём пустые строки)', () => {
    const q = filtersToQuery(EMPTY_FILTERS, EMPTY_CONTACT_SEARCH);
    expect(q.phone).toBeUndefined();
    expect(q.email).toBeUndefined();
  });

  it('пустые фильтры дают undefined в query (кроме page/pageSize)', () => {
    const q = filtersToQuery(EMPTY_FILTERS);
    expect(q.status).toBeUndefined();
    expect(q.orderNumber).toBeUndefined();
    expect(q.phone).toBeUndefined();
    expect(q.email).toBeUndefined();
    expect(q.pageSize).toBe(20);
  });

  describe('isDateRangeValid', () => {
    it('пустой диапазон валиден', () => {
      expect(isDateRangeValid('', '')).toBe(true);
      expect(isDateRangeValid('2026-07-01', '')).toBe(true);
    });
    it('from <= to валиден', () => {
      expect(isDateRangeValid('2026-07-01', '2026-07-31')).toBe(true);
      expect(isDateRangeValid('2026-07-01', '2026-07-01')).toBe(true);
    });
    it('from > to невалиден', () => {
      expect(isDateRangeValid('2026-08-01', '2026-07-01')).toBe(false);
    });
  });
});
