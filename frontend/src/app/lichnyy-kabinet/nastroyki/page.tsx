'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { mockUser } from '@/components/account/account-data';

export default function Settings() {
  const [form, setForm] = useState({ name: mockUser.name, email: mockUser.email, phone: mockUser.phone });
  const [saved, setSaved] = useState(false);
  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };

  return (
    <div className="max-w-lg">
      <h2 className="mb-4 text-lg font-bold">Настройки</h2>
      <div className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        {(['name', 'email', 'phone'] as const).map((k) => (
          <label key={k} className="block text-sm">
            <span className="mb-1.5 block text-muted">
              {k === 'name' ? 'Имя' : k === 'email' ? 'E-mail' : 'Телефон'}
            </span>
            <input
              value={form[k]}
              onChange={(e) => set(k, e.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-bg px-3 text-fg focus:border-primary focus:outline-none"
            />
          </label>
        ))}
        <button
          onClick={() => setSaved(true)}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-fg hover:bg-primary-hover"
        >
          {saved ? (
            <>
              <Check size={16} /> Сохранено
            </>
          ) : (
            'Сохранить'
          )}
        </button>
      </div>
      <p className="mt-3 text-xs text-subtle">Тема оформления переключается в шапке сайта (солнце/луна).</p>
    </div>
  );
}
