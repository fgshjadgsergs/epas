/**
 * Валидация контактной формы оформления заказа.
 *
 * Правила и нормализация повторяют CreateOrderDto на backend (длины, набор
 * символов телефона, trim/lowercase e-mail). Это подсказка пользователю до
 * отправки, а не замена серверной проверки: источник истины — backend.
 */

export interface ContactForm {
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  customerComment: string;
}

export type ContactField = keyof ContactForm;

/** Порядок совпадает с порядком полей на экране — по нему ищем первую ошибку. */
export const CONTACT_FIELD_ORDER: ContactField[] = [
  'contactName',
  'contactPhone',
  'contactEmail',
  'customerComment',
];

export const EMPTY_CONTACT_FORM: ContactForm = {
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  customerComment: '',
};

/** Схлопывание пробелов — как @Transform(collapse) в DTO. */
const collapse = (value: string) => value.trim().replace(/\s+/g, ' ');

const PHONE_ALLOWED = /^[+()\-\s\d]+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Приведение к тому виду, в котором значения примет backend. */
export function normalizeContactForm(form: ContactForm): ContactForm {
  return {
    contactName: collapse(form.contactName),
    contactPhone: form.contactPhone.trim(),
    contactEmail: form.contactEmail.trim().toLowerCase(),
    customerComment: form.customerComment.trim(),
  };
}

export type ContactErrors = Partial<Record<ContactField, string>>;

export function validateContactForm(form: ContactForm): ContactErrors {
  const value = normalizeContactForm(form);
  const errors: ContactErrors = {};

  if (value.contactName.length < 2 || value.contactName.length > 120) {
    errors.contactName = 'Укажите имя: от 2 до 120 символов.';
  }

  const digits = value.contactPhone.replace(/\D/g, '').length;
  if (value.contactPhone.length < 5 || value.contactPhone.length > 32) {
    errors.contactPhone = 'Укажите телефон: от 5 до 32 символов.';
  } else if (!PHONE_ALLOWED.test(value.contactPhone)) {
    errors.contactPhone = 'Телефон может содержать только цифры, пробелы и символы + ( ) -';
  } else if (digits < 5) {
    errors.contactPhone = 'В телефоне слишком мало цифр.';
  }

  if (value.contactEmail.length < 3 || value.contactEmail.length > 254) {
    errors.contactEmail = 'Укажите e-mail для подтверждения заказа.';
  } else if (!EMAIL.test(value.contactEmail)) {
    errors.contactEmail = 'Проверьте e-mail: похоже, в адресе опечатка.';
  }

  if (value.customerComment.length > 2000) {
    errors.customerComment = 'Комментарий не длиннее 2000 символов.';
  }

  return errors;
}

export function isContactFormValid(form: ContactForm): boolean {
  return Object.keys(validateContactForm(form)).length === 0;
}
