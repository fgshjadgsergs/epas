import type { Metadata } from 'next';
import { ConstructorApp } from '@/components/constructor/constructor-app';

// Инструмент-редактор не индексируется (canonical — на страницу фотокниг).
export const metadata: Metadata = {
  title: 'Онлайн-конструктор фотокниг — КИДС-ПРИНТ',
  description: 'Соберите фотокнигу в браузере: загрузите фото, выберите макеты разворотов и оформите заказ.',
  robots: { index: false, follow: true },
  alternates: { canonical: '/fotoknigi/' },
};

export default function KonstruktorPage() {
  return <ConstructorApp />;
}
