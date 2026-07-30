/**
 * Общая механика специализированных редакторов цен.
 *
 * Frontend редактирует ДАННЫЕ правил (kind/диапазон/цена/условие); движок,
 * валидация, расчёт и публикация остаются на backend. Изменения нескольких
 * строк применяются последовательно через существующий rule CRUD (никакого
 * bulk/replace API): revision корректно обновляется между запросами, цепочка
 * останавливается на первом конфликте.
 */
import {
  createDraftRule,
  deleteDraftRule,
  updateDraftRule,
  type DraftRuleInput,
  type PriceRuleView,
  type PricingDefinitionDetail,
} from '@/lib/api/admin-pricing';
import { describePricingError, type PricingError } from './pricing-errors';

/** Деньги: рубли-строка ввода → целые копейки (без float-накопления в total). */
export function rubToMinor(rub: string | number): number | null {
  const n = typeof rub === 'number' ? rub : Number(String(rub).replace(',', '.').trim());
  if (!Number.isFinite(n)) return null;
  // Округляем к копейке через строку, чтобы 12.1*100 не давало 1209.9999.
  return Math.round(n * 100);
}

export function minorToRubInput(amountMinor: number | null | undefined): string {
  if (amountMinor == null) return '';
  return String(amountMinor / 100);
}

/** Человекочитаемое условие правила по метаданным определения. */
export function humanizeCondition(
  condition: Record<string, unknown> | null | undefined,
  definition: Pick<PricingDefinitionDetail, 'parameters'>,
): string {
  if (!condition || Object.keys(condition).length === 0) return 'Всегда';
  const paramByKey = new Map(definition.parameters.map((p) => [p.urlKey, p]));
  return Object.entries(condition)
    .map(([key, raw]) => {
      const param = paramByKey.get(key);
      const values = Array.isArray(raw) ? raw : [raw];
      const labels = values.map((v) => {
        const opt = param?.options.find((o) => o.value === String(v));
        return opt?.label ?? String(v);
      });
      return `${param?.label ?? key}: ${labels.join(' / ')}`;
    })
    .join('; ');
}

/** Локальная строка редактора со статусом относительно backend. */
export interface EditableRule {
  /** id существующего правила; undefined — новая строка. */
  id?: string;
  kind: PriceRuleView['kind'];
  priority: number;
  condition: Record<string, unknown> | null;
  qtyFrom: number | null;
  qtyTo: number | null;
  amountMinor: number | null;
  multiplier: number | null;
  /** config сохраняется как есть (метрические правила) — фронт его не сочиняет. */
  config: Record<string, unknown> | null;
  /** Локальный ключ для React (стабилен в пределах сессии редактирования). */
  localKey: string;
  /** Пометка удаления — применяется при сохранении. */
  deleted?: boolean;
}

let keyCounter = 0;
export function nextLocalKey(): string {
  keyCounter += 1;
  return `local-${keyCounter}`;
}

export function ruleToEditable(rule: PriceRuleView): EditableRule {
  return {
    id: rule.id,
    kind: rule.kind,
    priority: rule.priority,
    condition: rule.condition,
    qtyFrom: rule.qtyFrom,
    qtyTo: rule.qtyTo,
    amountMinor: rule.amountMinor,
    multiplier: rule.multiplier,
    config: rule.config,
    localKey: nextLocalKey(),
  };
}

function toDraftInput(row: EditableRule): DraftRuleInput {
  return {
    kind: row.kind,
    priority: row.priority,
    condition: row.condition,
    qtyFrom: row.qtyFrom,
    qtyTo: row.qtyTo,
    amountMinor: row.amountMinor,
    multiplier: row.multiplier,
    config: row.config,
  };
}

/** Изменилась ли существующая строка относительно исходного правила. */
export function isRowChanged(row: EditableRule, original: PriceRuleView | undefined): boolean {
  if (!original) return true; // новая строка
  return (
    row.kind !== original.kind ||
    row.priority !== original.priority ||
    row.qtyFrom !== original.qtyFrom ||
    row.qtyTo !== original.qtyTo ||
    row.amountMinor !== original.amountMinor ||
    row.multiplier !== original.multiplier ||
    JSON.stringify(row.condition ?? null) !== JSON.stringify(original.condition ?? null) ||
    JSON.stringify(row.config ?? null) !== JSON.stringify(original.config ?? null)
  );
}

export interface SaveOutcome {
  revision: number;
  applied: number;
  error?: PricingError;
}

/**
 * Последовательно применить изменения строк: удаления, обновления, создания.
 * Возвращает финальный revision и число применённых операций; при первом
 * конфликте/ошибке останавливается и возвращает частичный результат (не
 * скрываем частично применённые изменения — вызывающий рефетчит DRAFT).
 */
export async function applyRuleChanges(
  priceListId: string,
  startRevision: number,
  rows: EditableRule[],
  originalById: Map<string, PriceRuleView>,
  token: string,
): Promise<SaveOutcome> {
  let revision = startRevision;
  let applied = 0;

  const deletes = rows.filter((r) => r.deleted && r.id);
  const updates = rows.filter((r) => !r.deleted && r.id && isRowChanged(r, originalById.get(r.id!)));
  const creates = rows.filter((r) => !r.deleted && !r.id);

  try {
    for (const row of deletes) {
      const res = await deleteDraftRule(priceListId, row.id!, revision, token);
      revision = res.revision;
      applied += 1;
    }
    for (const row of updates) {
      const res = await updateDraftRule(priceListId, row.id!, { ...toDraftInput(row), expectedRevision: revision }, token);
      revision = res.revision;
      applied += 1;
    }
    for (const row of creates) {
      const res = await createDraftRule(priceListId, { ...toDraftInput(row), expectedRevision: revision }, token);
      revision = res.revision;
      applied += 1;
    }
    return { revision, applied };
  } catch (error) {
    return { revision, applied, error: describePricingError(error) };
  }
}
