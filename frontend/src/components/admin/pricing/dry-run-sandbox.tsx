'use client';

import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { tokenStorage } from '@/lib/api/auth';
import { dryRunDraft, type DryRunResult, type PricingDefinitionDetail } from '@/lib/api/admin-pricing';
import { describePricingError } from '@/lib/admin/pricing-errors';
import { minorToRub } from '@/lib/admin/pricing-presentation';
import { ModeBadge } from './pricing-definitions-list';

/**
 * Песочница dry-run: форма строится по read-only метаданным определения
 * (select для опций, число для DIMENSION/qty). Считает по DRAFT-прайсу без
 * создания заказа/снимка. Доступна MANAGER (pricing.read).
 */
export function DryRunSandbox({ priceListId, definition, disabled = false }: { priceListId: string; definition: PricingDefinitionDetail; disabled?: boolean }) {
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(definition));
  const [qty, setQty] = useState(String(definition.minQty || 1));
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<DryRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setRunning(true);
    setError(null);
    const token = tokenStorage.getAccessToken();
    if (!token) {
      setError('Сессия истекла. Войдите заново.');
      setRunning(false);
      return;
    }
    const parameters: Record<string, unknown> = { qty: Number(qty) || definition.minQty };
    for (const p of definition.parameters) {
      const v = values[p.urlKey];
      if (v !== undefined && v !== '') parameters[p.urlKey] = p.type === 'DIMENSION' ? Number(v) : v;
    }
    try {
      setResult(await dryRunDraft(priceListId, { parameters }, token));
    } catch (err) {
      setResult(null);
      setError(describePricingError(err).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h3 className="flex items-center gap-2 font-semibold">
        <FlaskConical size={16} className="text-primary" /> Тестовый расчёт
      </h3>
      <p className="mt-1 text-xs text-subtle">Тестовый расчёт. Заказ и снимок цены не создаются.</p>
      {disabled && (
        <p className="mt-2 rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning">
          Сохраните изменения цен, чтобы протестировать актуальный прайс.
        </p>
      )}

      <fieldset disabled={disabled} className="contents">
      <form onSubmit={run} className="mt-3 grid gap-3 sm:grid-cols-2">
        {definition.parameters
          .filter((p) => p.type !== 'MULTI_QTY')
          .map((p) => {
            const active = p.options.filter((o) => o.isActive);
            return (
              <label key={p.urlKey} className="text-sm">
                <span className="mb-1 block text-muted">{p.label}</span>
                {active.length > 0 ? (
                  <select
                    value={values[p.urlKey] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [p.urlKey]: e.target.value }))}
                    className="h-10 w-full rounded-xl border border-border bg-bg px-3 text-fg focus:border-primary focus:outline-none"
                  >
                    <option value="">—</option>
                    {active.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={p.type === 'DIMENSION' ? 'number' : 'text'}
                    value={values[p.urlKey] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [p.urlKey]: e.target.value }))}
                    className="h-10 w-full rounded-xl border border-border bg-bg px-3 text-fg focus:border-primary focus:outline-none"
                  />
                )}
              </label>
            );
          })}
        <label className="text-sm">
          <span className="mb-1 block text-muted">Тираж</span>
          <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} className="h-10 w-full rounded-xl border border-border bg-bg px-3 text-fg focus:border-primary focus:outline-none" />
        </label>
        <div className="sm:col-span-2">
          <button type="submit" disabled={running} className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary-hover disabled:opacity-60">
            {running ? 'Считаем…' : 'Рассчитать'}
          </button>
        </div>
      </form>
      </fieldset>

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      {result && (
        <div className="mt-4 rounded-2xl border border-border bg-bg p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Итого (тестово)</span>
            <span className="flex items-center gap-2">
              <ModeBadge isDemo={result.pricingMode === 'DEMO'} />
              <span className="text-xl font-extrabold">{minorToRub(result.total.amountMinor)} {result.currency}</span>
            </span>
          </div>
          <p className="mt-1 text-xs text-subtle">Цена за единицу: {minorToRub(result.unitPrice.amountMinor)} {result.currency} · тираж {result.quantity}</p>

          {result.derived.length > 0 && (
            <dl className="mt-3 space-y-1 border-t border-border pt-2 text-xs">
              {(result.derived as { code: string; label: string; total: number; unit: string }[]).map((m) => (
                <div key={m.code} className="flex justify-between">
                  <dt className="text-muted">{m.label}</dt>
                  <dd className="font-medium">{m.total.toLocaleString('ru-RU')} {m.unit}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </section>
  );
}

function initialValues(definition: PricingDefinitionDetail): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of definition.parameters) {
    const def = p.options.find((o) => o.isActive);
    if (def) out[p.urlKey] = def.value;
  }
  return out;
}
