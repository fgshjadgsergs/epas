/** Разбор ошибок оформления в сообщения и действия для UI. */
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/client';
import { describeCheckoutError } from './checkout-errors';

describe('describeCheckoutError', () => {
  it('400 → ошибки полей, корзину перечитывать не нужно', () => {
    const result = describeCheckoutError(new ApiError(400, 'Ошибка валидации', ['Некорректный email']));
    expect(result.kind).toBe('validation');
    expect(result.details).toEqual(['Некорректный email']);
    expect(result.refreshCart).toBe(false);
  });

  it('401 → истёкшая сессия', () => {
    expect(describeCheckoutError(new ApiError(401, 'Unauthorized')).kind).toBe('unauthorized');
  });

  it('404 → корзина недоступна, предлагаем вернуться в корзину', () => {
    const result = describeCheckoutError(new ApiError(404, 'Not found'));
    expect(result.kind).toBe('notFound');
    expect(result.refreshCart).toBe(true);
    expect(result.backToCart).toBe(true);
  });

  it('409 → конфликт корзины: перечитать корзину, успех не показывать', () => {
    const result = describeCheckoutError(new ApiError(409, 'Валюта позиции не совпадает'));
    expect(result.kind).toBe('cartConflict');
    expect(result.refreshCart).toBe(true);
    expect(result.message).toContain('Валюта позиции');
  });

  it('422 (устаревшая позиция) тоже трактуется как конфликт корзины', () => {
    const result = describeCheckoutError(new ApiError(422, 'Цена позиции изменилась — обновите корзину'));
    expect(result.kind).toBe('cartConflict');
    expect(result.backToCart).toBe(true);
  });

  it('429 → просим подождать', () => {
    expect(describeCheckoutError(new ApiError(429, 'Too many')).kind).toBe('rateLimit');
  });

  it('ApiError(0) от client.ts → сетевая ошибка', () => {
    const result = describeCheckoutError(new ApiError(0, 'Не удалось связаться с сервером'));
    expect(result.kind).toBe('network');
    expect(result.refreshCart).toBe(false);
  });

  it('500 → неизвестная ошибка, корзину перечитываем на всякий случай', () => {
    const result = describeCheckoutError(new ApiError(500, 'Internal'));
    expect(result.kind).toBe('unknown');
    expect(result.refreshCart).toBe(true);
  });

  it('не-ApiError → общее сообщение без утечки деталей', () => {
    const result = describeCheckoutError(new TypeError('cannot read property phone of undefined'));
    expect(result.kind).toBe('unknown');
    expect(result.message).not.toContain('phone');
  });
});
