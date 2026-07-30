/** Возврат после входа: только внутренние пути, без открытого редиректа. */
import { describe, expect, it } from 'vitest';
import { DEFAULT_RETURN_URL, isSafeReturnUrl, loginUrlWithReturn, safeReturnUrl } from './return-url';

describe('isSafeReturnUrl', () => {
  it('принимает внутренние пути', () => {
    expect(isSafeReturnUrl('/oformlenie-zakaza/')).toBe(true);
    expect(isSafeReturnUrl('/lichnyy-kabinet/moi-zakazy/')).toBe(true);
  });

  it('отклоняет внешние адреса и protocol-relative ссылки', () => {
    expect(isSafeReturnUrl('https://evil.example/')).toBe(false);
    expect(isSafeReturnUrl('//evil.example/')).toBe(false);
    expect(isSafeReturnUrl('/\\evil.example')).toBe(false);
    expect(isSafeReturnUrl('javascript:alert(1)')).toBe(false);
  });

  it('отклоняет пустое значение', () => {
    expect(isSafeReturnUrl(null)).toBe(false);
    expect(isSafeReturnUrl('')).toBe(false);
  });
});

describe('safeReturnUrl', () => {
  it('подставляет личный кабинет вместо небезопасного значения', () => {
    expect(safeReturnUrl('https://evil.example/')).toBe(DEFAULT_RETURN_URL);
    expect(safeReturnUrl('/korzina/')).toBe('/korzina/');
  });
});

describe('loginUrlWithReturn', () => {
  it('кодирует путь возврата в query', () => {
    expect(loginUrlWithReturn('/oformlenie-zakaza/')).toBe(
      '/lichnyy-kabinet/vhod-registraciya/?return=%2Foformlenie-zakaza%2F',
    );
  });

  it('небезопасный путь просто отбрасывается', () => {
    expect(loginUrlWithReturn('//evil.example')).toBe('/lichnyy-kabinet/vhod-registraciya/');
  });
});
