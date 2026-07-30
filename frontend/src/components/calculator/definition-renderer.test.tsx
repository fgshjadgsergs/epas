// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderDefinitionField } from './definition-renderer';
import type { CalculatorDefinitionDto } from '@/lib/api/calculator';

type Param = CalculatorDefinitionDto['parameters'][number];

function makeParam(overrides: Partial<Param> = {}): Param {
  return {
    urlKey: 'paper',
    label: 'Бумага',
    type: 'SELECT',
    unit: null,
    min: null,
    max: null,
    step: null,
    default: 'coated-350',
    required: true,
    shareable: true,
    visibleIf: null,
    options: [
      { value: 'coated-300', label: 'Мелованная 300 г', isDefault: false, meta: null },
      { value: 'coated-350', label: 'Мелованная 350 г', isDefault: true, meta: null },
    ],
    ...overrides,
  };
}

afterEach(() => cleanup());

describe('renderDefinitionField', () => {
  it('SELECT: опции и подписи берутся из definition, без хардкода на frontend', () => {
    const onChange = vi.fn();
    render(renderDefinitionField({ param: makeParam(), value: 'coated-350', onChange }));
    expect(screen.getByRole('option', { name: 'Мелованная 350 г' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Мелованная 300 г' })).toBeTruthy();
  });

  it('изменение label/options в backend definition отражается без изменения кода', () => {
    // Симулируем «CMS изменила название и добавила вариант» — тот же
    // компонент, другие данные, без модификации definition-renderer.tsx.
    const updatedParam = makeParam({
      label: 'Тип бумаги', // переименовано в CMS
      default: 'design', // сменился дефолт
      options: [
        { value: 'coated-350', label: 'Мелованная 350 г', isDefault: false, meta: null },
        { value: 'design', label: 'Дизайнерская премиум', isDefault: true, meta: null }, // новая опция
      ],
    });
    const onChange = vi.fn();
    render(renderDefinitionField({ param: updatedParam, value: undefined, onChange }));

    expect(screen.getByRole('option', { name: 'Дизайнерская премиум' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Мелованная 300 г' })).toBeNull();
    expect(screen.getByLabelText('Тип бумаги')).toBeTruthy();
  });

  it('SEGMENTED рендерится как radiogroup и вызывает onChange с machine value', () => {
    const onChange = vi.fn();
    const param = makeParam({
      type: 'SEGMENTED',
      urlKey: 'sides',
      label: 'Стороны',
      default: 'double',
      options: [
        { value: 'single', label: '1 сторона', isDefault: false, meta: null },
        { value: 'double', label: '2 стороны', isDefault: true, meta: null },
      ],
    });
    render(renderDefinitionField({ param, value: 'double', onChange }));
    fireEvent.click(screen.getByLabelText('1 сторона'));
    expect(onChange).toHaveBeenCalledWith('single');
  });

  it('DIMENSION уважает min/max/step из definition', () => {
    const onChange = vi.fn();
    const param = makeParam({ type: 'DIMENSION', urlKey: 'w', label: 'Ширина', min: 30, max: 100, step: 1, options: [] });
    render(renderDefinitionField({ param, value: 90, onChange }));
    const input = screen.getByLabelText('Ширина') as HTMLInputElement;
    expect(input.min).toBe('30');
    expect(input.max).toBe('100');
  });

  it('TOGGLE: checked отражает machine value "1"/"0"', () => {
    const onChange = vi.fn();
    const param = makeParam({ type: 'TOGGLE', urlKey: 'express', label: 'Срочно', options: [], default: '0' });
    render(renderDefinitionField({ param, value: '1', onChange }));
    expect((screen.getByLabelText('Срочно') as HTMLInputElement).checked).toBe(true);
  });

  it('disabledOptionValues отключает недоступные варианты (совместимость из backend)', () => {
    const onChange = vi.fn();
    render(
      renderDefinitionField({
        param: makeParam(),
        value: 'coated-350',
        onChange,
        disabledOptionValues: ['coated-300'],
      }),
    );
    expect((screen.getByRole('option', { name: 'Мелованная 300 г' }) as HTMLOptionElement).disabled).toBe(true);
  });

  it('неизвестный/кастомный тип (SWATCH) не рендерится универсальной регистри — возвращает null', () => {
    const onChange = vi.fn();
    const result = renderDefinitionField({ param: makeParam({ type: 'SWATCH' }), value: 'coated-350', onChange });
    expect(result).toBeNull();
  });
});
