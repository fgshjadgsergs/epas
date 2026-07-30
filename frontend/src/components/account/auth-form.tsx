'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ApiError } from '@/lib/api/client';
import { login as apiLogin, register as apiRegister } from '@/lib/api/auth';
import { useAuth } from '@/lib/auth/auth-context';
import { useCart } from '@/lib/cart/store';
import { RETURN_URL_PARAM, isSafeReturnUrl } from '@/lib/auth/return-url';
import type { SessionUser } from '@/lib/auth/session';

/**
 * Вход и регистрация.
 *
 * После успешной авторизации: анонимная корзина сливается с пользовательской
 * ровно один раз (backend идемпотентен), затем корзина принудительно
 * перечитывается. Если пользователь пришёл с оформления заказа, параметр
 * `?return=` возвращает его обратно на checkout уже готовым к заказу.
 */
export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrlParam = searchParams.get(RETURN_URL_PARAM);
  const returnUrl = isSafeReturnUrl(returnUrlParam) ? returnUrlParam : null;

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const { applySession, signOut } = useAuth();
  const mergeCart = useCart((s) => s.mergeCart);
  const loadCart = useCart((s) => s.loadCart);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === 'register' && password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);
    try {
      const session =
        mode === 'login'
          ? await apiLogin({ email, password })
          : await apiRegister({ email, password, firstName: firstName || undefined });

      // refresh token уже в httpOnly-cookie; access — в памяти сессии.
      applySession(session);
      setCurrentUser(session.user);

      // Анонимная корзина переносится к пользователю ровно один раз после
      // входа; backend идемпотентен, дублей при повторе не будет.
      await mergeCart();
      await loadCart({ force: true });

      if (returnUrl) {
        router.push(returnUrl);
        return;
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Что-то пошло не так. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await signOut();
    setCurrentUser(null);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFirstName('');
    void loadCart({ force: true });
  }

  if (currentUser) {
    return (
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-border bg-surface p-6">
          <p className="text-sm text-muted">Вы вошли как</p>
          <p className="mt-1 text-lg font-semibold">{currentUser.email}</p>
          {currentUser.firstName && <p className="text-muted">{currentUser.firstName}</p>}
          <p className="mt-2 text-sm text-muted">
            Роли: <span className="font-medium text-fg">{currentUser.roles.join(', ') || '—'}</span>
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/lichnyy-kabinet/"
              className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
            >
              Перейти в личный кабинет
            </Link>
            <button
              onClick={handleLogout}
              className="inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm font-medium text-muted hover:bg-surface-2"
            >
              Выйти
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border border-border bg-surface p-6">
        {returnUrl && (
          <p className="mb-4 rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">
            Войдите, чтобы продолжить оформление заказа — корзина сохранится.
          </p>
        )}

        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-border p-1 text-sm">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={cn(
                'h-9 rounded-lg font-medium',
                mode === m ? 'bg-primary text-primary-fg' : 'text-muted',
              )}
            >
              {m === 'login' ? 'Вход' : 'Регистрация'}
            </button>
          ))}
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          {mode === 'register' && <AuthField label="Имя" value={firstName} onChange={setFirstName} />}
          <AuthField label="E-mail" type="email" value={email} onChange={setEmail} required />
          <AuthField label="Пароль" type="password" value={password} onChange={setPassword} required />
          {mode === 'register' && (
            <AuthField
              label="Повторите пароль"
              type="password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              required
            />
          )}

          {mode === 'login' && (
            <div className="text-right">
              <a href="#" className="text-xs text-primary hover:underline">
                Забыли пароль?
              </a>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-11 w-full rounded-xl bg-primary font-semibold text-primary-fg hover:bg-primary-hover disabled:opacity-60"
          >
            {loading ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-subtle">
          {mode === 'login' ? 'Нет аккаунта? ' : 'Уже есть аккаунт? '}
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError(null);
            }}
            className="text-primary hover:underline"
          >
            {mode === 'login' ? 'Зарегистрироваться' : 'Войти'}
          </button>
        </p>
      </div>
    </div>
  );
}

function AuthField({
  label,
  type = 'text',
  value,
  onChange,
  required,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="h-11 w-full rounded-xl border border-border bg-bg px-3 text-fg focus:border-primary focus:outline-none"
      />
    </label>
  );
}
