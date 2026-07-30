import type { Metadata } from 'next';

/**
 * page.tsx в этой папке — клиентский компонент ('use client'), поэтому
 * `metadata` нельзя экспортировать прямо из него (ограничение App Router) —
 * выносим в серверный layout рядом.
 *
 * TODO: /backend-demo — временная техническая страница для проверки
 * интеграции с backend API. Убрать перед production-релизом.
 */
export const metadata: Metadata = {
  title: 'Backend demo',
  robots: { index: false, follow: false },
};

export default function BackendDemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
