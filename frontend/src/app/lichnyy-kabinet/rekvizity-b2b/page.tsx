'use client';

import { useState } from 'react';
import { Check, Search } from 'lucide-react';

export default function Requisites() {
  const [form, setForm] = useState({ company: '', inn: '', kpp: '', ogrn: '', address: '', bank: '' });
  const [saved, setSaved] = useState(false);
  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };

  // Демо-«подтягивание» по ИНН. На проде — DaData API.
  const lookup = () => {
    if (form.inn.length >= 10)
      setForm((f) => ({
        ...f,
        company: f.company || 'ООО «Пример»',
        kpp: f.kpp || '770101001',
        ogrn: f.ogrn || '1234567890123',
        address: f.address || 'Москва, ул. Примерная, 10',
      }));
  };

  return (
    <div className="max-w-2xl">
      <h2 className="mb-1 text-lg font-bold">Реквизиты компании (B2B)</h2>
      <p className="mb-4 text-sm text-muted">Для счетов, счетов-фактур и актов с НДС.</p>
      <div className="grid gap-4 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1.5 block text-muted">ИНН</span>
          <div className="flex gap-2">
            <input
              value={form.inn}
              onChange={(e) => set('inn', e.target.value)}
              className="h-11 flex-1 rounded-xl border border-border bg-bg px-3"
            />
            <button
              onClick={lookup}
              className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-border px-4 text-sm font-medium hover:border-primary"
            >
              <Search size={15} /> Найти
            </button>
          </div>
          <span className="mt-1 block text-[11px] text-subtle">
            Реквизиты подтянутся автоматически (DaData)
          </span>
        </label>
        <RField label="Компания" value={form.company} onChange={(v) => set('company', v)} span />
        <RField label="КПП" value={form.kpp} onChange={(v) => set('kpp', v)} />
        <RField label="ОГРН" value={form.ogrn} onChange={(v) => set('ogrn', v)} />
        <RField label="Юридический адрес" value={form.address} onChange={(v) => set('address', v)} span />
        <RField label="Банковские реквизиты" value={form.bank} onChange={(v) => set('bank', v)} span />
        <button
          onClick={() => setSaved(true)}
          className="inline-flex h-11 items-center gap-2 self-start rounded-xl bg-primary px-5 font-semibold text-primary-fg hover:bg-primary-hover sm:col-span-2"
        >
          {saved ? (
            <>
              <Check size={16} /> Сохранено
            </>
          ) : (
            'Сохранить реквизиты'
          )}
        </button>
      </div>
    </div>
  );
}

function RField({
  label,
  value,
  onChange,
  span,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  span?: boolean;
}) {
  return (
    <label className={`block text-sm ${span ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1.5 block text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-border bg-bg px-3 focus:border-primary focus:outline-none"
      />
    </label>
  );
}
