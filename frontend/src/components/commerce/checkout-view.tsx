'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Info, Lock, ShoppingCart } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Button } from '@/components/ui/button';
import { Reveal } from '@/components/reveal';
import { cn, formatPrice } from '@/lib/utils';
import { useCart } from '@/lib/cart/store';
import { tokenStorage } from '@/lib/api/auth';
import { getCurrentUser } from '@/lib/api/users';
import { createOrder } from '@/lib/api/orders';
import { loginUrlWithReturn } from '@/lib/auth/return-url';
import { clearIdempotencyKey, idempotencyKeyFor } from '@/lib/orders/idempotency';
import { describeCheckoutError, type CheckoutError } from '@/lib/orders/checkout-errors';
import {
  CONTACT_FIELD_ORDER,
  EMPTY_CONTACT_FORM,
  isContactFormValid,
  normalizeContactForm,
  validateContactForm,
  type ContactErrors,
  type ContactField,
  type ContactForm,
} from '@/lib/orders/contact-validation';
import { DEMO_PRICING_NOTICE, showDemoPricingNotice } from '@/lib/demo-pricing';
import type { CartItemDto } from '@/lib/api/cart';

/** Копейки → рубли для отображения. Все суммы считает backend. */
const rub = (amountMinor: number) => formatPrice(amountMinor / 100);

export const CHECKOUT_PATH = '/oformlenie-zakaza/';

/** Корзина разошлась с экраном — успех показывать нельзя. */
const CART_NOT_READY: CheckoutError = {
  kind: 'cartConflict',
  message: 'Состав корзины изменился. Проверьте позиции и повторите оформление.',
  refreshCart: false,
  backToCart: true,
};

/**
 * Оформление заказа.
 *
 * Состав, цены, суммы и признак pricingMode приходят из серверной корзины;
 * на backend уходят ТОЛЬКО контакты и ключ идемпотентности — ни items, ни
 * цен, ни total, ни snapshotId клиент не передаёт. Заказ создаёт исключительно
 * POST /orders, локального «заказа» на фронте не существует.
 */
export function CheckoutView() {
  const router = useRouter();

  const cart = useCart((s) => s.cart);
  const loading = useCart((s) => s.loading);
  const cartError = useCart((s) => s.error);
  const loadCart = useCart((s) => s.loadCart);

  // Токен читается только на клиенте: до монтирования состояние авторизации
  // неизвестно, поэтому SSR отдаёт нейтральный плейсхолдер без layout jump.
  const [authReady, setAuthReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  const [form, setForm] = useState<ContactForm>(EMPTY_CONTACT_FORM);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [checkoutError, setCheckoutError] = useState<CheckoutError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Синхронный замок: state обновляется асинхронно и не спасёт от двойного клика.
  const submittingRef = useRef(false);

  const fieldRefs = useRef<Partial<Record<ContactField, HTMLInputElement | HTMLTextAreaElement | null>>>({});

  useEffect(() => {
    const token = tokenStorage.getAccessToken();
    setAuthed(Boolean(token));
    setAuthReady(true);
    if (!token) return;

    // После возврата с логина корзина уже слита — берём актуальную серверную.
    void loadCart({ force: true });

    // Предзаполнение контактов профилем: экономит ввод, но не является
    // источником истины — пользователь может всё поменять.
    void getCurrentUser(token)
      .then((me) => {
        if (!me) return;
        const name = [me.firstName, me.lastName].filter(Boolean).join(' ');
        setForm((prev) => ({
          ...prev,
          contactName: prev.contactName || name,
          contactEmail: prev.contactEmail || me.email,
        }));
      })
      .catch(() => undefined);
  }, [loadCart]);

  const setField = useCallback((field: ContactField, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }, []);

  const focusFirstError = useCallback((found: ContactErrors) => {
    const first = CONTACT_FIELD_ORDER.find((field) => found[field]);
    if (first) fieldRefs.current[first]?.focus();
  }, []);

  const validateField = useCallback((field: ContactField) => {
    setForm((current) => {
      const found = validateContactForm(current);
      setErrors((prev) => ({ ...prev, [field]: found[field] }));
      return current;
    });
  }, []);

  const invalidItems = cart?.items.filter((item) => item.status !== 'VALID') ?? [];
  const cartReady = Boolean(cart && cart.itemCount > 0 && cart.canCheckout && invalidItems.length === 0);

  // Незаполненная форма кнопку НЕ гасит: иначе пользователь видит мёртвую
  // кнопку и не понимает, какое поле не так. Невалидные данные всё равно не
  // уходят на сервер — handleSubmit проверяет форму заново и показывает ошибки.
  const canSubmit = authed && cartReady && !submitting;
  const formValid = isContactFormValid(form);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submittingRef.current) return; // двойной клик → максимум один запрос

    const found = validateContactForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusFirstError(found);
      return;
    }

    const token = tokenStorage.getAccessToken();
    if (!token) {
      setAuthed(false);
      setCheckoutError(describeCheckoutError(new Error('no token')));
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setCheckoutError(null);
    let navigating = false;

    try {
      // Отправляем по актуальному состоянию сервера, а не по тому, что на экране.
      await loadCart({ force: true });
      const fresh = useCart.getState().cart;
      if (!fresh || fresh.itemCount === 0 || !fresh.canCheckout) {
        setCheckoutError(CART_NOT_READY);
        return;
      }

      const contacts = normalizeContactForm(form);
      const order = await createOrder(
        {
          contactName: contacts.contactName,
          contactPhone: contacts.contactPhone,
          contactEmail: contacts.contactEmail,
          ...(contacts.customerComment ? { customerComment: contacts.customerComment } : {}),
          // Один и тот же ключ на всю эту версию корзины: retry не создаст второй заказ.
          idempotencyKey: idempotencyKeyFor(fresh.id, fresh.cartVersion),
        },
        token,
      );

      clearIdempotencyKey();
      // Backend закрыл корзину — забираем новую пустую ACTIVE; бейдж в шапке
      // читает тот же store и обновится сам.
      await loadCart({ force: true });

      navigating = true;
      router.push(`/oformlenie-zakaza/zakaz-oformlen/?id=${encodeURIComponent(order.id)}`);
    } catch (error) {
      // Контакты в форме намеренно НЕ очищаем — в том числе при 401: экран
      // входа снёс бы уже введённые данные, поэтому показываем ссылку «Войти
      // заново» прямо в сообщении об ошибке.
      const described = describeCheckoutError(error);
      setCheckoutError(described);
      if (described.refreshCart) await loadCart({ force: true });
    } finally {
      if (!navigating) {
        submittingRef.current = false;
        setSubmitting(false);
      }
    }
  }

  // --- состояния экрана -----------------------------------------------------

  if (!authReady || (!cart && loading)) {
    return (
      <Container className="flex min-h-[50vh] items-center justify-center py-16">
        <p className="text-muted" role="status">
          Загружаем оформление…
        </p>
      </Container>
    );
  }

  if (!authed) {
    return (
      <Container className="py-12">
        <Reveal className="mx-auto max-w-md rounded-2xl border border-border bg-surface p-6 text-center">
          <Lock size={32} className="mx-auto text-primary" />
          <h1 className="mt-4 text-xl font-bold">Войдите, чтобы оформить заказ</h1>
          <p className="mt-2 text-sm text-muted">
            Заказ сохраняется в личном кабинете — там видны статус, состав и история.
            Корзина не потеряется: после входа она перенесётся к вашему аккаунту.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Button href={loginUrlWithReturn(CHECKOUT_PATH)}>Войти или зарегистрироваться</Button>
            <Link href="/korzina/" className="text-sm text-muted hover:text-primary">
              Вернуться в корзину
            </Link>
          </div>
        </Reveal>
      </Container>
    );
  }

  if (!cart && cartError) {
    return (
      <Container className="flex min-h-[50vh] flex-col items-center justify-center py-16 text-center">
        <AlertTriangle size={36} className="mb-3 text-danger" />
        <h1 className="text-2xl font-bold">Не удалось загрузить корзину</h1>
        <p className="mt-2 text-muted">{cartError}</p>
        <Button className="mt-6" onClick={() => void loadCart({ force: true })}>
          Повторить
        </Button>
      </Container>
    );
  }

  if (!cart || cart.itemCount === 0) {
    return (
      <Container className="flex min-h-[50vh] flex-col items-center justify-center py-16 text-center">
        <Reveal className="flex flex-col items-center">
          <ShoppingCart size={40} className="mb-4 text-subtle" />
          <h1 className="text-2xl font-bold">Корзина пуста</h1>
          <p className="mt-2 text-muted">Добавьте услуги в корзину перед оформлением.</p>
          <Button href="/poligrafiya/" className="mt-6">
            Перейти в каталог
          </Button>
        </Reveal>
      </Container>
    );
  }

  return (
    <Container className="py-8">
      <Reveal as="h1" className="text-2xl font-bold sm:text-3xl">
        Оформление заказа
      </Reveal>

      <form onSubmit={handleSubmit} noValidate className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <Reveal className="min-w-0 rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-semibold">Контактные данные</h2>
          <p className="mt-1 text-sm text-muted">Менеджер свяжется с вами для подтверждения заказа.</p>

          <div className="mt-4 space-y-4">
            <Field
              id="contactName"
              label="Имя"
              value={form.contactName}
              error={errors.contactName}
              autoComplete="name"
              onChange={(v) => setField('contactName', v)}
              onBlur={() => validateField('contactName')}
              inputRef={(el) => (fieldRefs.current.contactName = el)}
            />
            <Field
              id="contactPhone"
              label="Телефон"
              type="tel"
              inputMode="tel"
              placeholder="+7 900 123-45-67"
              value={form.contactPhone}
              error={errors.contactPhone}
              autoComplete="tel"
              onChange={(v) => setField('contactPhone', v)}
              onBlur={() => validateField('contactPhone')}
              inputRef={(el) => (fieldRefs.current.contactPhone = el)}
            />
            <Field
              id="contactEmail"
              label="E-mail"
              type="email"
              inputMode="email"
              value={form.contactEmail}
              error={errors.contactEmail}
              autoComplete="email"
              onChange={(v) => setField('contactEmail', v)}
              onBlur={() => validateField('contactEmail')}
              inputRef={(el) => (fieldRefs.current.contactEmail = el)}
            />
            <Field
              id="customerComment"
              label="Комментарий к заказу"
              optional
              multiline
              value={form.customerComment}
              error={errors.customerComment}
              onChange={(v) => setField('customerComment', v)}
              onBlur={() => validateField('customerComment')}
              inputRef={(el) => (fieldRefs.current.customerComment = el)}
            />
          </div>

          <p className="mt-4 text-xs text-subtle">
            Доставка и оплата согласовываются с менеджером после оформления.
          </p>
        </Reveal>

        <Reveal delay={80} className="min-w-0 lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-semibold">Ваш заказ</h2>

            <ul className="mt-3 space-y-3">
              {cart.items.map((item) => (
                <CheckoutLine key={item.id} item={item} />
              ))}
            </ul>

            <dl className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Товары ({cart.itemCount})</dt>
                <dd className="font-medium">{rub(cart.totals.itemsSubtotal.amountMinor)}</dd>
              </div>
              {cart.totals.discounts.amountMinor > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted">Скидка</dt>
                  <dd className="font-medium text-success">−{rub(cart.totals.discounts.amountMinor)}</dd>
                </div>
              )}
            </dl>

            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <span className="font-semibold">Итого</span>
              <span className="text-2xl font-extrabold">{rub(cart.totals.total.amountMinor)}</span>
            </div>

            {showDemoPricingNotice(cart.pricingMode) && (
              <p className="mt-3 inline-flex items-start gap-1.5 rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
                <Info size={13} className="mt-0.5 shrink-0" />
                {DEMO_PRICING_NOTICE}
              </p>
            )}

            {!cartReady && (
              <div
                role="alert"
                className="mt-3 rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning"
              >
                <AlertTriangle size={14} className="mr-1 inline shrink-0" />
                {invalidItems.some((i) => i.status === 'STALE')
                  ? 'Цена части позиций изменилась — пересчитайте их в корзине.'
                  : 'Часть позиций недоступна — обновите корзину, чтобы продолжить.'}
                <Link href="/korzina/" className="ml-1 font-semibold underline">
                  Вернуться в корзину
                </Link>
              </div>
            )}

            {checkoutError && (
              <div role="alert" className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">
                <p className="font-semibold">{checkoutError.message}</p>
                {checkoutError.details && checkoutError.details.length > 0 && (
                  <ul className="mt-1 list-inside list-disc">
                    {checkoutError.details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                )}
                {checkoutError.kind === 'unauthorized' && (
                  <Link href={loginUrlWithReturn(CHECKOUT_PATH)} className="mt-1 inline-block font-semibold underline">
                    Войти заново
                  </Link>
                )}
                {checkoutError.backToCart && (
                  <Link href="/korzina/" className="mt-1 inline-block font-semibold underline">
                    Открыть корзину
                  </Link>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              aria-disabled={!canSubmit}
              className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-primary px-3 text-sm font-semibold text-primary-fg hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-subtle"
            >
              {submitting ? 'Оформляем…' : 'Оформить заказ'}
            </button>

            {cartReady && !formValid && (
              <p className="mt-2 text-center text-xs text-subtle">
                Заполните контактные данные — менеджеру нужно с вами связаться.
              </p>
            )}

            <Link href="/korzina/" className="mt-3 block text-center text-sm text-muted hover:text-primary">
              Вернуться в корзину
            </Link>
          </div>
        </Reveal>
      </form>
    </Container>
  );
}

/** Позиция заказа: immutable-снимок названия и конфигурации из корзины. */
function CheckoutLine({ item }: { item: CartItemDto }) {
  return (
    <li className="flex justify-between gap-3 border-b border-border pb-3 text-sm last:border-0 last:pb-0">
      <span className="min-w-0">
        <span className="block font-medium">{item.title}</span>
        <span className="mt-0.5 block text-xs text-muted">{summarize(item.configuration)}</span>
        <span className="mt-0.5 block text-xs text-subtle">
          {item.quantity} шт. · {item.production.workingDays} раб. дн.
        </span>
      </span>
      <span className="shrink-0 font-medium">{rub(item.lineTotal.amountMinor)}</span>
    </li>
  );
}

/** Краткое описание конфигурации снимка (только отображение). */
function summarize(configuration: Record<string, unknown>): string {
  return Object.entries(configuration)
    .filter(([, value]) => value !== null && value !== '' && typeof value !== 'object')
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' · ');
}

function Field({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  type = 'text',
  inputMode,
  placeholder,
  autoComplete,
  optional,
  multiline,
  inputRef,
}: {
  id: ContactField;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error?: string;
  type?: string;
  inputMode?: 'tel' | 'email' | 'text';
  placeholder?: string;
  autoComplete?: string;
  optional?: boolean;
  multiline?: boolean;
  inputRef: (el: HTMLInputElement | HTMLTextAreaElement | null) => void;
}) {
  const errorId = `${id}-error`;
  const shared = {
    id,
    name: id,
    value,
    placeholder,
    autoComplete,
    onBlur,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? errorId : undefined,
    className: cn(
      'w-full rounded-xl border bg-bg px-3 text-fg focus:outline-none',
      error ? 'border-danger focus:border-danger' : 'border-border focus:border-primary',
    ),
  };

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm text-muted">
        {label}
        {optional && <span className="ml-1 text-subtle">— необязательно</span>}
      </label>
      {multiline ? (
        <textarea
          {...shared}
          ref={inputRef}
          rows={3}
          maxLength={2000}
          className={cn(shared.className, 'min-h-[84px] resize-y py-2')}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          {...shared}
          ref={inputRef}
          type={type}
          inputMode={inputMode}
          className={cn(shared.className, 'h-11')}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {/* Место под ошибку резервируется всегда — иначе строка ниже прыгает. */}
      <p id={errorId} role={error ? 'alert' : undefined} className="mt-1 min-h-[16px] text-xs text-danger">
        {error}
      </p>
    </div>
  );
}
