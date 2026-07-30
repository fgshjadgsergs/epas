import { mockUser } from '@/components/account/account-data';

export default function Loyalty() {
  const next = 2000;
  const pct = Math.min(100, Math.round((mockUser.loyaltyPoints / next) * 100));
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Программа лояльности</h2>

      <div className="rounded-2xl border border-border bg-gradient-to-br from-surface to-bg-2 p-6">
        <p className="text-sm text-muted">Ваш уровень</p>
        <p className="text-2xl font-extrabold">{mockUser.loyaltyLevel}</p>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-sm">
            <span className="font-semibold">{mockUser.loyaltyPoints.toLocaleString('ru-RU')} баллов</span>
            <span className="text-muted">до «Золотого» — {next - mockUser.loyaltyPoints}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Кэшбэк баллами', 'до 5% с каждого заказа'],
          ['Оплата баллами', '1 балл = 1 ₽, до 30% заказа'],
          ['Бонусы за уровень', 'приоритет и скидки на срочность'],
        ].map(([t, d]) => (
          <div key={t} className="rounded-2xl border border-border bg-surface p-5">
            <p className="font-semibold">{t}</p>
            <p className="mt-1 text-sm text-muted">{d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
