'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Lock, Pencil, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { tokenStorage } from '@/lib/api/auth';
import { useAuth } from '@/lib/auth/auth-context';
import {
  createDraftRule,
  deleteDraftRule,
  getPricingDefinition,
  getPriceLists,
  publishDraft,
  updateDraftRule,
  validateDraft,
  type DraftRuleInput,
  type PriceListDetail,
  type PriceListSummary,
  type PriceRuleView,
  type PricingDefinitionDetail,
  type ValidateDraftResult,
} from '@/lib/api/admin-pricing';
import { usePriceList } from '@/lib/admin/use-price-list';
import { canEditPricing, canPublishPricing } from '@/lib/admin/access';
import { describePricingError } from '@/lib/admin/pricing-errors';
import { loginUrlWithReturn } from '@/lib/auth/return-url';
import {
  formatValidPeriod,
  minorToRub,
  priceListPath,
  priceStatusBadge,
  priceStatusLabel,
  pricingDefinitionPath,
  ruleKindLabel,
} from '@/lib/admin/pricing-presentation';
import { pickPricingEditor } from '@/lib/admin/pricing-editor-kind';
import { ModeBadge } from './pricing-definitions-list';
import { RuleEditor } from './rule-editor';
import { DryRunSandbox } from './dry-run-sandbox';
import { PublishDialog } from './publish-dialog';
import { AuditHistory } from './audit-history';
import { TierEditor } from './editors/tier-editor';
import { MetricEditor } from './editors/metric-editor';
import { MultiQtyEditor } from './editors/multi-qty-editor';

/** Страница прайс-листа: read-only для ACTIVE/ARCHIVED, редактирование для DRAFT. */
export function PriceListView({ priceListId }: { priceListId: string }) {
  const { state, reload } = usePriceList(priceListId);
  const [definition, setDefinition] = useState<PricingDefinitionDetail | null>(null);
  const [currentActive, setCurrentActive] = useState<PriceListSummary | null>(null);
  const { permissions } = useAuth();
  const [publishNotice, setPublishNotice] = useState<string | null>(null);
  // Несохранённые изменения в специализированном редакторе блокируют
  // validate/dry-run/publish (иначе оператор опубликует старые серверные данные).
  const [editorDirty, setEditorDirty] = useState(false);
  // Результат последнего validate — для подсветки проблемных правил и статуса.
  const [validation, setValidation] = useState<ValidateDraftResult | null>(null);

  // Дальнейшая правка DRAFT делает прежний validate неактуальным.
  const handleDirtyChange = useCallback((dirty: boolean) => {
    setEditorDirty(dirty);
    if (dirty) setValidation(null);
  }, []);

  const definitionId = state.status === 'ready' ? state.priceList.definitionId : null;

  // Загружаем определение (для редактора/песочницы) и текущий ACTIVE (для publish-диалога).
  useEffect(() => {
    const token = tokenStorage.getAccessToken();
    if (!token || !definitionId) return;
    void getPricingDefinition(definitionId, token).then(setDefinition).catch(() => setDefinition(null));
    void getPriceLists(definitionId, token, { pageSize: 100 })
      .then((res) => setCurrentActive(res.items.find((pl) => pl.status === 'ACTIVE') ?? null))
      .catch(() => setCurrentActive(null));
  }, [definitionId]);


  if (state.status === 'loading') return <Shell definitionId={null}><Skeleton /></Shell>;
  if (state.status === 'unauthorized') return <Shell definitionId={null}><Notice tone="warning" title="Сессия истекла"><Link href={loginUrlWithReturn(priceListPath(priceListId))} className="font-semibold text-primary underline">Войти заново</Link></Notice></Shell>;
  if (state.status === 'forbidden') return <Shell definitionId={null}><Notice tone="danger" title="Нет доступа">Нет прав на просмотр прайса.</Notice></Shell>;
  if (state.status === 'notFound') return <Shell definitionId={null}><Notice tone="muted" title="Не найдено">Прайс-лист не найден.</Notice></Shell>;
  if (state.status === 'error') {
    return <Shell definitionId={null}><Notice tone="danger" title="Ошибка">{state.message} <button onClick={reload} className="font-semibold text-primary underline">Повторить</button></Notice></Shell>;
  }

  const pl = state.priceList;
  const isDraft = pl.status === 'DRAFT';
  const canEdit = canEditPricing(permissions) && isDraft;
  const canPublish = canPublishPricing(permissions) && isDraft;
  const editorKind = pickPricingEditor(definition?.code);
  const errorRuleIds = new Set(
    (validation?.errors ?? []).map((e) => e.ruleId).filter((id): id is string => Boolean(id)),
  );

  // Специализированный редактор для четырёх эталонных калькуляторов; иначе
  // технический RuleEditor как fallback. MANAGER видит редактор read-only.
  const editorProps = definition
    ? {
        rules: pl.rules,
        definition,
        priceListId: pl.id,
        revision: pl.revision,
        canEdit,
        reload,
        onDirtyChange: handleDirtyChange,
        errorRuleIds,
        currency: pl.currency,
      }
    : null;

  return (
    <Shell definitionId={pl.definitionId}>
      {publishNotice && (
        <p role="status" className="mb-4 flex items-center gap-1.5 rounded-2xl bg-success/10 px-4 py-3 text-sm text-success">
          <CheckCircle2 size={16} /> {publishNotice}
        </p>
      )}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">Версия {pl.version}</h2>
            <p className="text-sm text-subtle">
              {pl.currency} · {formatValidPeriod(pl.validFrom, pl.validTo)} · rev {pl.revision}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${priceStatusBadge(pl.status)}`}>
              {priceStatusLabel(pl.status)}
            </span>
            <ModeBadge isDemo={pl.isDemo} />
          </div>
        </div>
        {!isDraft && (
          <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs text-muted">
            <Lock size={13} /> {pl.status === 'ACTIVE' ? 'Активный прайс' : 'Архивная версия'} — только просмотр.
          </p>
        )}
      </section>

      {isDraft && definition && (
        <DraftActions
          priceList={pl}
          definition={definition}
          currentActive={currentActive}
          canPublish={canPublish}
          reload={reload}
          onPublished={setPublishNotice}
          dirty={editorDirty}
          onValidation={setValidation}
        />
      )}

      <div className="mt-4">
        {editorProps && editorKind === 'tier' && <TierEditor {...editorProps} />}
        {editorProps && editorKind === 'metric' && <MetricEditor {...editorProps} />}
        {editorProps && editorKind === 'multiqty' && <MultiQtyEditor {...editorProps} />}
        {(editorKind === 'technical' || !editorProps) && (
          <RulesSection
            rules={pl.rules}
            currency={pl.currency}
            definition={definition}
            priceListId={pl.id}
            revision={pl.revision}
            canEdit={canEdit}
            reload={reload}
          />
        )}
      </div>

      <section className="mt-4 rounded-2xl border border-border bg-surface p-5">
        <h3 className="mb-3 font-semibold">Сроки изготовления (read-only)</h3>
        {pl.productionRules.length === 0 ? (
          <p className="text-sm text-muted">Нет правил срока.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {pl.productionRules.map((r) => (
              <li key={r.id} className="flex justify-between gap-3 border-b border-border pb-2 last:border-0">
                <span className="text-muted">{r.condition ? JSON.stringify(r.condition) : 'базовое'}</span>
                <span className="font-medium">{r.workingDays} раб. дн. · отсечка {r.cutoff}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isDraft && definition && <div className="mt-4"><DryRunSandbox priceListId={pl.id} definition={definition} disabled={editorDirty} /></div>}

      <div className="mt-4">
        <AuditHistory priceListId={pl.id} />
      </div>
    </Shell>
  );
}

/** Блок действий DRAFT: validate + publish. */
function DraftActions({
  priceList,
  definition,
  currentActive,
  canPublish,
  reload,
  onPublished,
  dirty,
  onValidation,
}: {
  priceList: PriceListDetail;
  definition: PricingDefinitionDetail;
  currentActive: PriceListSummary | null;
  canPublish: boolean;
  reload: () => void;
  onPublished: (message: string) => void;
  dirty: boolean;
  onValidation: (v: ValidateDraftResult | null) => void;
}) {
  void definition;
  const router = useRouter();
  const [validation, setValidation] = useState<ValidateDraftResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const publishingRef = useRef(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function runValidate() {
    setValidating(true);
    setActionError(null);
    const token = tokenStorage.getAccessToken();
    if (!token) return setValidating(false);
    try {
      const result = await validateDraft(priceList.id, token);
      setValidation(result);
      onValidation(result); // подсветка проблемных правил в редакторе
    } catch (err) {
      const d = describePricingError(err);
      setActionError(d.message);
      if (d.reload) reload();
    } finally {
      setValidating(false);
    }
  }

  async function doPublish() {
    if (publishingRef.current) return; // защита от двойного клика
    publishingRef.current = true;
    setPublishing(true);
    setActionError(null);
    const token = tokenStorage.getAccessToken();
    if (!token) {
      setActionError('Сессия истекла.');
      publishingRef.current = false;
      setPublishing(false);
      return;
    }
    try {
      await publishDraft(priceList.id, priceList.revision, token);
      setShowPublish(false);
      onPublished('Версия опубликована. Она стала активной, предыдущая ушла в архив.');
      reload();
    } catch (err) {
      const d = describePricingError(err);
      setActionError(d.message);
      setShowPublish(false);
      if (d.kind === 'unauthorized') router.push(loginUrlWithReturn(priceListPath(priceList.id)));
      // 409 всегда перечитывает актуальные данные.
      if (d.reload) reload();
    } finally {
      publishingRef.current = false;
      setPublishing(false);
    }
  }

  return (
    <section className="mt-4 rounded-2xl border border-border bg-surface p-5">
      <h3 className="font-semibold">Действия с черновиком</h3>
      {dirty && (
        <p className="mt-2 rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning">
          Сначала сохраните или отмените изменения цен — проверка и публикация используют сохранённые данные.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={runValidate} disabled={validating || dirty} className="h-10 rounded-xl border border-border px-4 text-sm font-semibold hover:border-primary hover:text-primary disabled:opacity-60">
          {validating ? 'Проверяем…' : 'Проверить прайс'}
        </button>
        {canPublish && (
          <button onClick={() => setShowPublish(true)} disabled={dirty} className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary-hover disabled:opacity-60">
            Опубликовать
          </button>
        )}
      </div>

      {actionError && <p role="alert" className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{actionError}</p>}

      {validation && (
        <div className="mt-3" data-testid="validation-result">
          {validation.valid ? (
            <p className="flex items-center gap-1.5 rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
              <CheckCircle2 size={15} /> Ошибок не найдено
            </p>
          ) : (
            <div className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
              <p className="font-semibold">Найдены проблемы:</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {validation.errors.map((e, i) => (
                  <li key={i}>
                    <span className="font-mono text-xs">{e.code}</span> — {e.message}
                    {e.ruleId && <span className="text-xs text-muted"> (правило {e.ruleId.slice(0, 8)})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {validation.warnings.length > 0 && (
            <div className="mt-2 rounded-xl bg-warning/10 px-3 py-2 text-sm text-warning">
              <p className="font-semibold">Предупреждения:</p>
              <ul className="mt-1 list-inside list-disc">
                {validation.warnings.map((w, i) => (<li key={i}>{String(w)}</li>))}
              </ul>
            </div>
          )}
        </div>
      )}

      {showPublish && (
        <PublishDialog
          draft={priceList}
          currentActive={currentActive}
          submitting={publishing}
          onConfirm={doPublish}
          onCancel={() => !publishing && setShowPublish(false)}
        />
      )}
    </section>
  );
}

/** Таблица правил + технический редактор для DRAFT. */
function RulesSection({
  rules,
  currency,
  definition,
  priceListId,
  revision,
  canEdit,
  reload,
}: {
  rules: PriceRuleView[];
  currency: string;
  definition: PricingDefinitionDetail | null;
  priceListId: string;
  revision: number;
  canEdit: boolean;
  reload: () => void;
}) {
  const [editing, setEditing] = useState<PriceRuleView | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  async function save(fields: DraftRuleInput, ruleId: string | null) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    const token = tokenStorage.getAccessToken();
    if (!token) {
      setError('Сессия истекла.');
      savingRef.current = false;
      setSaving(false);
      return;
    }
    try {
      if (ruleId) {
        await updateDraftRule(priceListId, ruleId, { ...fields, expectedRevision: revision }, token);
      } else {
        await createDraftRule(priceListId, { ...fields, expectedRevision: revision }, token);
      }
      setEditing(null);
      setCreating(false);
      reload(); // берём новый revision из refetch, не перезаписываем локально
    } catch (err) {
      const d = describePricingError(err);
      setError(d.message);
      if (d.reload) {
        setEditing(null);
        setCreating(false);
        reload();
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function remove(ruleId: string) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    const token = tokenStorage.getAccessToken();
    if (!token) {
      savingRef.current = false;
      setSaving(false);
      return;
    }
    try {
      await deleteDraftRule(priceListId, ruleId, revision, token);
      reload();
    } catch (err) {
      const d = describePricingError(err);
      setError(d.message);
      if (d.reload) reload();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <section className="mt-4 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Правила цены</h3>
        {canEdit && definition && !creating && !editing && (
          <button onClick={() => setCreating(true)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-primary/40 px-3 text-sm font-semibold text-primary hover:bg-primary/10">
            <Plus size={15} /> Добавить
          </button>
        )}
      </div>

      {error && <p role="alert" className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      {creating && definition && (
        <div className="mt-3">
          <RuleEditor definition={definition} rule={null} saving={saving} onSave={(f) => save(f, null)} onCancel={() => setCreating(false)} />
        </div>
      )}

      <ul className="mt-3 space-y-2">
        {rules.length === 0 && <li className="text-sm text-muted">Правил пока нет.</li>}
        {rules.map((r) =>
          editing?.id === r.id && definition ? (
            <li key={r.id}>
              <RuleEditor definition={definition} rule={r} saving={saving} onSave={(f) => save(f, r.id)} onCancel={() => setEditing(null)} />
            </li>
          ) : (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-bg px-3 py-2 text-sm" data-testid="rule-row" data-rule-id={r.id}>
              <div className="min-w-0">
                <span className="font-medium">{ruleKindLabel(r.kind)}</span>
                <span className="ml-2 text-xs text-subtle">приоритет {r.priority}</span>
                {r.condition && (
                  <span className="mt-0.5 block text-xs text-muted">
                    когда {Object.entries(r.condition).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('/') : v}`).join(', ')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-medium tabular-nums">
                  {r.amountMinor != null ? `${minorToRub(r.amountMinor)} ${currency}` : r.multiplier != null ? `× ${r.multiplier}` : ''}
                  {r.qtyFrom != null && <span className="ml-1 text-xs text-subtle">{r.qtyFrom}{r.qtyTo != null ? `–${r.qtyTo}` : '+'}</span>}
                </span>
                {canEdit && definition && (
                  <>
                    <button onClick={() => setEditing(r)} aria-label="Изменить правило" className="text-subtle hover:text-primary"><Pencil size={15} /></button>
                    <button onClick={() => remove(r.id)} disabled={saving} aria-label="Удалить правило" className="text-subtle hover:text-danger disabled:opacity-40"><Trash2 size={15} /></button>
                  </>
                )}
              </div>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

function Shell({ definitionId, children }: { definitionId: string | null; children: React.ReactNode }) {
  const back = definitionId ? pricingDefinitionPath(definitionId) : '/admin/pricing/';
  return (
    <div>
      <Link href={back} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary">
        <ArrowLeft size={15} /> {definitionId ? 'К версиям прайса' : 'К списку прайсов'}
      </Link>
      {children}
    </div>
  );
}

function Skeleton() {
  return <div className="h-40 animate-pulse rounded-2xl border border-border bg-surface" aria-hidden />;
}

function Notice({ tone, title, children }: { tone: 'danger' | 'warning' | 'muted'; title: string; children: React.ReactNode }) {
  const color = tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-subtle';
  return (
    <div className="rounded-2xl border border-border bg-surface p-8 text-center">
      <ShieldAlert size={32} className={`mx-auto ${color}`} />
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{children}</p>
    </div>
  );
}
