import { Suspense } from 'react';
import { AuthForm } from '@/components/account/auth-form';

/** Форма читает ?return= через useSearchParams — нужен Suspense-барьер. */
export default function AuthPage() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}
