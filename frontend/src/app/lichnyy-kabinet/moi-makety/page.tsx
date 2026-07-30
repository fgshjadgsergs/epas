import Link from 'next/link';
import { FileImage } from 'lucide-react';

export default function MyDesigns() {
  return (
    <div>
      <h2 className="mb-4 text-lg font-bold">Мои макеты</h2>
      <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-surface py-14 text-center">
        <FileImage size={32} className="mb-3 text-subtle" />
        <p className="text-muted">Макеты прикрепляются к позициям заказа — там же видно статус проверки.</p>
        <Link
          href="/lichnyy-kabinet/moi-zakazy/"
          className="mt-4 text-sm font-medium text-primary hover:underline"
        >
          Перейти к моим заказам →
        </Link>
      </div>
    </div>
  );
}
