'use client';

import { useMemo, useState } from 'react';
import { cn, formatPrice } from '@/lib/utils';

/**
 * Демонстрационная разметка калькулятора (ТЗ страницы услуги, блок 3).
 * Поведение и расчёт цены — заглушка. Реальный конфиг-движок с API,
 * матрицами совместимости и синхронизацией URL — фаза 3.
 */
interface ParamGroup {
  id: string;
  label: string;
  options: { id: string; label: string }[];
}

const DEMO_PARAMS: ParamGroup[] = [
  {
    id: 'format',
    label: 'Формат',
    options: [
      { id: '90x50', label: '90×50' },
      { id: '85x55', label: '85×55' },
    ],
  },
  {
    id: 'paper',
    label: 'Бумага',
    options: [
      { id: 'c300', label: 'Мелованная 300 г' },
      { id: 'c350', label: 'Мелованная 350 г' },
      { id: 'design', label: 'Дизайнерская' },
    ],
  },
  {
    id: 'lam',
    label: 'Ламинация',
    options: [
      { id: 'none', label: 'Без ламинации' },
      { id: 'matte', label: 'Матовая' },
      { id: 'gloss', label: 'Глянцевая' },
      { id: 'soft', label: 'Soft Touch' },
    ],
  },
  {
    id: 'qty',
    label: 'Количество',
    options: [
      { id: '100', label: '100' },
      { id: '200', label: '200' },
      { id: '500', label: '500' },
      { id: '1000', label: '1000' },
    ],
  },
  {
    id: 'term',
    label: 'Срок',
    options: [
      { id: 'std', label: 'Стандарт' },
      { id: 'express', label: 'Срочно' },
    ],
  },
];

function readyDateLabel(express: boolean): string {
  const d = new Date();
  d.setDate(d.getDate() + (express ? 0 : 2));
  const fmt = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
  return express ? 'сегодня до 18:00' : fmt.format(d);
}

export function CalculatorStub({ basePrice = 1200 }: { basePrice?: number }) {
  const [selected, setSelected] = useState<Record<string, string>>({
    format: '90x50',
    paper: 'c350',
    lam: 'gloss',
    qty: '500',
    term: 'std',
  });
  const [b2b, setB2b] = useState(false);

  // Индикативная цена (НЕ реальная): база × множитель тиража + надбавки.
  const price = useMemo(() => {
    const qty = Number(selected.qty) || 100;
    const lamAdd = selected.lam !== 'none' ? 0.15 : 0;
    const paperAdd = selected.paper === 'design' ? 0.25 : selected.paper === 'c350' ? 0.1 : 0;
    const expressAdd = selected.term === 'express' ? 0.5 : 0;
    const perUnit = basePrice / 100;
    let total = perUnit * (qty / 100) * 100 * (1 + lamAdd + paperAdd + expressAdd);
    if (b2b) total *= 1.2;
    return Math.round(total / 10) * 10;
  }, [selected, b2b, basePrice]);

  const set = (g: string, o: string) => setSelected((s) => ({ ...s, [g]: o }));

  return (
    <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
      {/* Левая часть — параметры */}
      <div className="rounded-2xl border border-border bg-surface p-5 lg:p-7">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">Параметры заказа</h2>
          <span className="rounded-full bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning">
            демо · точный расчёт — на бэкенде
          </span>
        </div>
        <div className="space-y-5">
          {DEMO_PARAMS.map((g) => (
            <div key={g.id} className="grid gap-2 sm:grid-cols-[120px_1fr] sm:items-center">
              <span className="text-sm text-muted">{g.label}</span>
              <div className="flex flex-wrap gap-2">
                {g.options.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => set(g.id, o.id)}
                    aria-pressed={selected[g.id] === o.id}
                    className={cn(
                      'h-9 rounded-lg border px-3 text-sm transition-colors',
                      selected[g.id] === o.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-fg hover:border-primary/50',
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Правая часть — итог (статичная колонка) */}
      <div>
        <div className="rounded-2xl border border-border bg-surface p-6">
          {/* B2B-переключатель */}
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-border p-1 text-sm">
            <button
              type="button"
              onClick={() => setB2b(false)}
              className={cn('h-9 rounded-lg font-medium', !b2b ? 'bg-primary text-primary-fg' : 'text-muted')}
            >
              Физлицо
            </button>
            <button
              type="button"
              onClick={() => setB2b(true)}
              className={cn('h-9 rounded-lg font-medium', b2b ? 'bg-primary text-primary-fg' : 'text-muted')}
            >
              Юрлицо
            </button>
          </div>

          <p className="text-sm text-muted">Стоимость{b2b ? ' с НДС' : ''}</p>
          <p className="text-4xl font-extrabold" aria-live="polite">
            {formatPrice(price)}
          </p>
          <p className="mt-1 text-sm text-muted">
            {formatPrice(Math.round(price / (Number(selected.qty) || 100)))} за шт.
          </p>

          <dl className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Готовность</dt>
              <dd className="font-medium">{readyDateLabel(selected.term === 'express')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Доставка</dt>
              <dd className="font-medium">от 300 ₽</dd>
            </div>
          </dl>

          <button className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-fg hover:bg-primary-hover">
            Перейти к оформлению
          </button>
          <button className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border font-medium hover:bg-surface-2">
            Загрузить макет
          </button>
          <a
            href="#"
            className="mt-3 flex items-center justify-center gap-1.5 text-sm text-primary hover:underline"
          >
            Нет макета? Заказать дизайн
          </a>
          <p className="mt-3 text-center text-xs text-subtle">
            Цена актуальна 15 минут. Не является публичной офертой.
          </p>
        </div>
      </div>

      {/* Мобильный фикс-бар с ценой и кнопкой (ТЗ: правая часть → fixed-бар внизу) */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur lg:hidden">
        <div>
          <p className="text-xs text-muted">Итого{b2b ? ' с НДС' : ''}</p>
          <p className="text-xl font-extrabold">{formatPrice(price)}</p>
        </div>
        <button className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-fg">
          Оформить
        </button>
      </div>
    </div>
  );
}
