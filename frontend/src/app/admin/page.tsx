import { redirect } from 'next/navigation';

/** /admin → рабочий раздел «Заказы» (пустого дашборда с метриками нет). */
export default function AdminHomePage() {
  redirect('/admin/orders/');
}
