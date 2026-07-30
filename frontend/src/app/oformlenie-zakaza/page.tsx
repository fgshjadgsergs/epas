import type { Metadata } from 'next';
import { CheckoutView } from '@/components/commerce/checkout-view';

export const metadata: Metadata = {
  title: 'Оформление заказа — КИДС-ПРИНТ',
  robots: { index: false, follow: true },
};

export default function CheckoutPage() {
  return <CheckoutView />;
}
