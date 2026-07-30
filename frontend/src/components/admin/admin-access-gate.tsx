'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Button } from '@/components/ui/button';
import { useAdminAccess } from '@/lib/admin/use-admin-access';
import { canManageCatalog, hasAnyAdminAccess } from '@/lib/admin/access';
import { loginUrlWithReturn } from '@/lib/auth/return-url';

/**
 * UX-гейт админ-страниц. Неавторизованного отправляет на вход с безопасным
 * return URL; вошедшего без роли — на экран «Нет доступа».
 *
 * Это не безопасность, а лишь удобство: любой admin-запрос всё равно проверяет
 * backend (PermissionsGuard). Даже если кто-то обойдёт этот экран, API вернёт
 * 403, и страницы покажут отказ.
 */
/** Права раздела (строкой — чтобы Server Component мог передать её в client-гейт). */
const CAPABILITY_PREDICATE = {
  any: hasAnyAdminAccess,
  catalog: canManageCatalog,
} as const;

export function AdminAccessGate({
  returnUrl,
  capability = 'any',
  children,
}: {
  returnUrl: string;
  /** UX-гейт раздела: 'any' — любой доступ к панели; 'catalog' — catalog.manage. */
  capability?: keyof typeof CAPABILITY_PREDICATE;
  children: React.ReactNode;
}) {
  const access = useAdminAccess(CAPABILITY_PREDICATE[capability]);
  const router = useRouter();

  useEffect(() => {
    if (access.status === 'anon') {
      router.replace(loginUrlWithReturn(returnUrl));
    }
  }, [access.status, returnUrl, router]);

  if (access.status === 'loading' || access.status === 'anon') {
    return (
      <Container className="flex min-h-[50vh] items-center justify-center py-16">
        <p role="status" className="text-muted">
          Проверяем доступ…
        </p>
      </Container>
    );
  }

  if (access.status === 'forbidden') {
    return (
      <Container className="flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
        <ShieldAlert size={40} className="mb-3 text-danger" />
        <h1 className="text-2xl font-bold">Нет доступа</h1>
        <p className="mt-2 max-w-md text-muted">
          Панель управления доступна только сотрудникам. Если это ошибка — обратитесь к администратору.
        </p>
        <Button href="/" className="mt-6">
          Вернуться на сайт
        </Button>
        <Link href="/lichnyy-kabinet/" className="mt-3 text-sm text-muted hover:text-primary">
          В личный кабинет
        </Link>
      </Container>
    );
  }

  if (access.status === 'error') {
    return (
      <Container className="flex min-h-[50vh] flex-col items-center justify-center py-16 text-center">
        <ShieldAlert size={36} className="mb-3 text-warning" />
        <h1 className="text-xl font-bold">Не удалось проверить доступ</h1>
        <p className="mt-2 text-muted">Обновите страницу или попробуйте позже.</p>
      </Container>
    );
  }

  return <>{children}</>;
}
