import Link from 'next/link';
import { Calculator } from 'lucide-react';

export default function MyCalcs() {
  return (
    <div>
      <h2 className="mb-4 text-lg font-bold">Мои расчёты</h2>
      <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-surface py-14 text-center">
        <Calculator size={32} className="mb-3 text-subtle" />
        <p className="text-muted">Сохранённых расчётов пока нет.</p>
        <p className="mt-1 text-sm text-subtle">
          В калькуляторе нажмите «Поделиться», чтобы сохранить конфигурацию.
        </p>
        <Link href="/poligrafiya/" className="mt-4 text-sm font-medium text-primary hover:underline">
          Перейти в каталог →
        </Link>
      </div>
    </div>
  );
}
