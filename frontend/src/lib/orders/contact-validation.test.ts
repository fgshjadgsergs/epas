/** Контактная форма: правила повторяют CreateOrderDto на backend. */
import { describe, expect, it } from 'vitest';
import {
  EMPTY_CONTACT_FORM,
  isContactFormValid,
  normalizeContactForm,
  validateContactForm,
  type ContactForm,
} from './contact-validation';

const valid: ContactForm = {
  contactName: 'Иван Петров',
  contactPhone: '+7 900 123-45-67',
  contactEmail: 'ivan@example.com',
  customerComment: '',
};

describe('validateContactForm', () => {
  it('корректные данные проходят', () => {
    expect(validateContactForm(valid)).toEqual({});
    expect(isContactFormValid(valid)).toBe(true);
  });

  it('пустая форма даёт ошибки по всем обязательным полям', () => {
    const errors = validateContactForm(EMPTY_CONTACT_FORM);
    expect(Object.keys(errors).sort()).toEqual(['contactEmail', 'contactName', 'contactPhone']);
  });

  it('имя короче 2 символов отклоняется', () => {
    expect(validateContactForm({ ...valid, contactName: 'И' }).contactName).toBeTruthy();
  });

  it('имя длиннее 120 символов отклоняется (как @Length(2,120))', () => {
    expect(validateContactForm({ ...valid, contactName: 'и'.repeat(121) }).contactName).toBeTruthy();
  });

  it('телефон с буквами отклоняется (как @Matches на backend)', () => {
    expect(validateContactForm({ ...valid, contactPhone: '+7 позвоните' }).contactPhone).toBeTruthy();
  });

  it('телефон из скобок без цифр отклоняется', () => {
    expect(validateContactForm({ ...valid, contactPhone: '(((-)))' }).contactPhone).toBeTruthy();
  });

  it('e-mail без @ отклоняется', () => {
    expect(validateContactForm({ ...valid, contactEmail: 'ivan.example.com' }).contactEmail).toBeTruthy();
  });

  it('комментарий длиннее 2000 символов отклоняется', () => {
    expect(
      validateContactForm({ ...valid, customerComment: 'a'.repeat(2001) }).customerComment,
    ).toBeTruthy();
  });

  it('пустой комментарий допустим — поле необязательное', () => {
    expect(validateContactForm({ ...valid, customerComment: '   ' })).toEqual({});
  });
});

describe('normalizeContactForm', () => {
  it('схлопывает пробелы в имени, тримит телефон, приводит e-mail к нижнему регистру', () => {
    expect(
      normalizeContactForm({
        contactName: '  Иван   Петров  ',
        contactPhone: '  +7 900 123-45-67 ',
        contactEmail: '  IVAN@Example.COM ',
        customerComment: '  до 18:00  ',
      }),
    ).toEqual({
      contactName: 'Иван Петров',
      contactPhone: '+7 900 123-45-67',
      contactEmail: 'ivan@example.com',
      customerComment: 'до 18:00',
    });
  });

  it('валидация работает по нормализованному значению', () => {
    expect(isContactFormValid({ ...valid, contactName: '  Иван Петров  ' })).toBe(true);
  });
});
