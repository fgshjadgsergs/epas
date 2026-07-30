'use client';

import { AlertTriangle, ArrowLeft, Check } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { useEditor } from './store';
import { getLayout } from './layouts';
import { pricePhotobook } from './pricing';

export function OrderStep() {
  const spreads = useEditor((s) => s.spreads);
  const photos = useEditor((s) => s.photos);
  const params = useEditor((s) => s.params);
  const setStep = useEditor((s) => s.setStep);

  const inner = spreads.filter((s) => !s.cover).length;
  const { price, days } = pricePhotobook(params, inner);

  // Валидация перед заказом (ТЗ п.5.1).
  let emptyCells = 0;
  spreads.forEach((s) => {
    if (s.layout === 'blank') return;
    getLayout(s.layout).cells.forEach((_, ci) => {
      if (!s.cells[ci]?.photoId) emptyCells++;
    });
  });
  const lowResUsed = photos.filter(
    (p) => p.width > 0 && p.width < 1200 && spreads.some((s) => s.cells.some((c) => c.photoId === p.id)),
  ).length;
  const canOrder = emptyCells === 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <button
        onClick={() => setStep('design')}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"
      >
        <ArrowLeft size={15} /> Вернуться в редактор
      </button>
      <h1 className="text-2xl font-bold">Оформление фотокниги</h1>
      <p className="mt-1 text-sm text-muted">Шаг 3 из 3 — проверьте и оформите заказ.</p>

      {/* Проверки */}
      <div className="mt-6 space-y-2">
        <Check2
          ok={canOrder}
          okText="Все ячейки заполнены фото"
          badText={`Не заполнено ячеек: ${emptyCells} — заполните перед заказом`}
        />
        <Check2
          ok={lowResUsed === 0}
          warn
          okText="Разрешение фото в порядке"
          badText={`Фото с низким разрешением: ${lowResUsed} — можно продолжить, но качество печати может пострадать`}
        />
      </div>

      {/* Сводка */}
      <div className="mt-6 grid gap-4 rounded-2xl border border-border bg-surface p-6 sm:grid-cols-2">
        <dl className="space-y-2 text-sm">
          <Line k="Переплёт" v={params.binding} />
          <Line k="Размер" v={params.size} />
          <Line k="Разворотов" v={String(inner)} />
          <Line k="Бумага" v={params.paper} />
          <Line k="Обложка" v={params.cover} />
          <Line k="Экземпляров" v={String(params.copies)} />
        </dl>
        <div className="flex flex-col justify-between">
          <div>
            <p className="text-sm text-muted">Стоимость · готовность {days} дней</p>
            <p className="text-3xl font-extrabold">{formatPrice(price)}</p>
          </div>
          {/* Фотокниги ещё не переведены на серверный калькулятор: без
              подтверждённого расчёта (CalculationSnapshot) позицию нельзя
              положить в серверную корзину, а класть выдуманную цену нельзя.
              На проде: POST /api/v1/photobook/project/finalize → рендер PDF →
              подтверждение расчёта → корзина. */}
          <button
            disabled
            aria-disabled="true"
            className="mt-4 flex h-12 cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-surface-2 px-3 text-center text-sm font-semibold text-subtle"
          >
            Заказ фотокниги подключается на следующем этапе
          </button>
        </div>
      </div>
    </div>
  );
}

function Check2({
  ok,
  warn,
  okText,
  badText,
}: {
  ok: boolean;
  warn?: boolean;
  okText: string;
  badText: string;
}) {
  return (
    <div
      className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${ok ? 'border-success/40 bg-success/10' : warn ? 'border-warning/40 bg-warning/10' : 'border-danger/40 bg-danger/10'}`}
    >
      {ok ? (
        <Check size={16} className="mt-0.5 text-success" />
      ) : (
        <AlertTriangle size={16} className={`mt-0.5 ${warn ? 'text-warning' : 'text-danger'}`} />
      )}
      <span>{ok ? okText : badText}</span>
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}
