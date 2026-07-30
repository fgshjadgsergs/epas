'use client';

/**
 * Renderer registry, управляемый backend-определением (Codex review, блок 8).
 *
 * Backend definition — источник истины по составу полей, порядку, labels/
 * values, дефолтам, required, min/max/step, видимости, shareable. Frontend
 * НЕ хранит эти данные повторно в локальном конфиге — здесь только маппинг
 * «тип параметра из definition → визуальный компонент».
 *
 * Кастомный UX (свотчи с превью материала, слайдер тиража с выгодой и т.п.)
 * остаётся отдельным путём для визиток (см. calculator.tsx) — эта регистри
 * покрывает типы, для которых достаточно универсального рендера, и служит
 * целевой архитектурой для будущих калькуляторов, не требующих кастомной
 * визуализации.
 */
import type { CalculatorDefinitionDto } from '@/lib/api/calculator';

type DefinitionParameter = CalculatorDefinitionDto['parameters'][number];

export interface FieldRendererProps {
  param: DefinitionParameter;
  value: string | number | undefined;
  onChange: (value: string | number) => void;
  disabledOptionValues?: string[];
}

export type FieldRenderer = (props: FieldRendererProps) => React.ReactElement;

const SelectRenderer: FieldRenderer = ({ param, value, onChange, disabledOptionValues }) => (
  <select
    aria-label={param.label}
    value={String(value ?? param.default ?? '')}
    onChange={(e) => onChange(e.target.value)}
  >
    {param.options.map((o) => (
      <option key={o.value} value={o.value} disabled={disabledOptionValues?.includes(o.value)}>
        {o.label}
      </option>
    ))}
  </select>
);

const RadioRenderer: FieldRenderer = ({ param, value, onChange, disabledOptionValues }) => (
  <div role="radiogroup" aria-label={param.label}>
    {param.options.map((o) => (
      <label key={o.value}>
        <input
          type="radio"
          name={param.urlKey}
          value={o.value}
          checked={String(value ?? param.default) === o.value}
          disabled={disabledOptionValues?.includes(o.value)}
          onChange={() => onChange(o.value)}
        />
        {o.label}
      </label>
    ))}
  </div>
);

const NumberRenderer: FieldRenderer = ({ param, value, onChange }) => (
  <input
    type="number"
    aria-label={param.label}
    value={value ?? param.default ?? ''}
    min={param.min ?? undefined}
    max={param.max ?? undefined}
    step={param.step ?? undefined}
    onChange={(e) => onChange(Number(e.target.value))}
  />
);

const CheckboxRenderer: FieldRenderer = ({ param, value, onChange }) => (
  <label>
    <input
      type="checkbox"
      aria-label={param.label}
      checked={value === '1' || value === 1}
      onChange={(e) => onChange(e.target.checked ? '1' : '0')}
    />
    {param.label}
  </label>
);

/**
 * Реестр: тип параметра из backend definition → компонент. Только типы,
 * для которых нет кастомного UX — SWATCH/DIMENSION-с-превью и т.п. рендерит
 * calculator.tsx напрямую (см. комментарий модуля).
 */
export const fieldRendererRegistry: Partial<Record<DefinitionParameter['type'], FieldRenderer>> = {
  SELECT: SelectRenderer,
  SEGMENTED: RadioRenderer,
  DIMENSION: NumberRenderer,
  TOGGLE: CheckboxRenderer,
};

/** Рендерит параметр по definition; null — для типов без универсального рендера (кастомный UX). */
export function renderDefinitionField(props: FieldRendererProps): React.ReactElement | null {
  const Renderer = fieldRendererRegistry[props.param.type];
  return Renderer ? <Renderer {...props} /> : null;
}
