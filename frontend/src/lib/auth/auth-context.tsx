'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { logout as apiLogout } from '@/lib/api/auth';
import { clearLegacyAuthStorage, refreshSession, setSession, type SessionData, type SessionUser } from './session';

/**
 * Источник auth-состояния приложения.
 *
 * На старте (bootstrap) один раз пытается восстановить сессию через httpOnly
 * refresh-cookie: пока идёт проверка — status 'loading' (не мигаем ADMIN UI до
 * подтверждения). Провал refresh — обычное анонимное состояние, без redirect-
 * циклов. permissions приходят из БД (для UX-гейтинга); авторитет — backend.
 */
type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'authenticated'; user: SessionUser }
  | { status: 'anonymous'; user: null };

interface AuthContextValue {
  status: AuthState['status'];
  user: SessionUser | null;
  permissions: string[];
  roles: string[];
  /** Применить сессию после успешного login/register. */
  applySession: (data: SessionData) => void;
  /** Выход: отзыв refresh-сессии на сервере + сброс состояния. */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });

  useEffect(() => {
    clearLegacyAuthStorage(); // одноразовая чистка старых demo-токенов с диска
    let cancelled = false;
    refreshSession()
      .then((session) => {
        if (cancelled) return;
        setState(session ? { status: 'authenticated', user: session.user } : { status: 'anonymous', user: null });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'anonymous', user: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const applySession = useCallback((data: SessionData) => {
    setSession(data);
    setState({ status: 'authenticated', user: data.user });
  }, []);

  const signOut = useCallback(async () => {
    await apiLogout();
    setState({ status: 'anonymous', user: null });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      user: state.user,
      permissions: state.user?.permissions ?? [],
      roles: state.user?.roles ?? [],
      applySession,
      signOut,
    }),
    [state, applySession, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
