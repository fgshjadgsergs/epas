import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OrderDoneView } from '@/components/commerce/order-done-view';

export const metadata: Metadata = {
  title: 'Заказ оформлен — ПРИНТЕРА',
  robots: { index: false, follow: true },
};

export default function OrderDonePage() {
  return (
    <Suspense>
      <OrderDoneView />
    </Suspense>
  );
}
