import type { Metadata } from 'next';
import { CartView } from '@/components/commerce/cart-view';

export const metadata: Metadata = {
  title: 'Корзина — ПРИНТЕРА',
  robots: { index: false, follow: true },
};

export default function CartPage() {
  return <CartView />;
}
