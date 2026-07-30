import { generateOrderNumber } from './order-number';

describe('generateOrderNumber', () => {
  it('формат KP-YYYYMMDD-XXXXXX', () => {
    const n = generateOrderNumber(new Date('2026-07-23T10:00:00Z'));
    expect(n).toMatch(/^KP-20260723-\d{6}$/);
  });

  it('суффикс случайный — коллизии крайне редки', () => {
    const now = new Date('2026-07-23T10:00:00Z');
    const numbers = new Set(Array.from({ length: 2000 }, () => generateOrderNumber(now)));
    // 2000 из 1_000_000 — единичные коллизии допустимы, но не массовые.
    expect(numbers.size).toBeGreaterThan(1990);
  });

  it('не является последовательным (не раскрывает объём заказов)', () => {
    const a = generateOrderNumber();
    const b = generateOrderNumber();
    const suffixA = Number(a.split('-')[2]);
    const suffixB = Number(b.split('-')[2]);
    // Соседние вызовы почти наверняка не дают +1.
    expect(Math.abs(suffixA - suffixB)).not.toBe(1);
  });
});
