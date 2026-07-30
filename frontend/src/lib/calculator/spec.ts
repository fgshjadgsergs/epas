/**
 * Построение UrlStateSpec из двух источников:
 * - definition backend (истина по urlOrder/дефолтам/вариантам);
 * - локального CalcConfig (фолбэк, пока backend недоступен или услуга
 *   ещё не переведена на движок).
 *
 * qty и express — часть spec (порядок из ТЗ: … → qty → express).
 * b2b/promo/upsells в spec отсутствуют — они не существуют для URL-слоя.
 *
 * pagePreset страницы-варианта участвует как «дефолт URL-слоя»: значение,
 * совпадающее с preset лендинга (напр. format=A4 на /listovki/a4/), в query
 * не сериализуется — оно и так задано самой страницей; сериализуются только
 * отличия от preset/дефолтов.
 */
import type { CalcConfig, Selection } from '@/lib/calc/types';
import type { CalculatorDefinitionDto } from '@/lib/api/calculator';
import type { UrlStateSpec } from './url-state';

/** Базовый порядок из ТЗ URL: сервисные ключи конфига дописываются после. */
const BASE_ORDER = ['subtype', 'format', 'paper', 'coating', 'sides', 'qty', 'express'];

export function specFromDefinition(def: CalculatorDefinitionDto, pagePreset?: Selection): UrlStateSpec {
  // Производный тираж (config.quantityFrom): пользователь тираж не вводит —
  // его выводит сервер из параметров-сомножителей, поэтому поле «Тираж»
  // (URL-ключ qty) в spec не добавляется.
  const derivedQty = !!def.quantityFrom?.product?.length;
  return {
    order: def.urlOrder,
    params: [
      ...def.parameters.map((p) => ({
        key: p.urlKey,
        shareable: p.shareable,
        defaultValue: String(pagePreset?.[p.urlKey] ?? p.default ?? ''),
        // MULTI_QTY: options — белый список СТРОК формата «key:qty,…»,
        // а не список одиночных допустимых значений.
        allowedValues:
          p.type !== 'MULTI_QTY' && p.options.length > 0 ? p.options.map((o) => o.value) : undefined,
        multiQtyKeys: p.type === 'MULTI_QTY' ? p.options.map((o) => o.value) : undefined,
        numeric:
          p.type === 'DIMENSION'
            ? { min: p.min ?? undefined, max: p.max ?? undefined }
            : undefined,
      })),
      ...(derivedQty
        ? []
        : [
            {
              key: 'qty',
              shareable: true,
              defaultValue: String(pagePreset?.qty ?? def.qty.default),
              numeric: { min: def.qty.min, max: def.qty.max },
            },
          ]),
    ],
  };
}

export function specFromConfig(config: CalcConfig, pagePreset?: Selection): UrlStateSpec {
  const keys = config.groups.map((g) => g.id);
  const order = [...BASE_ORDER.filter((k) => keys.includes(k) || k === 'qty' || k === 'express'), ...keys.filter((k) => !BASE_ORDER.includes(k))];
  const maxQty = config.qtyTiers?.[config.qtyTiers.length - 1]?.qty ?? config.qtyRange?.max;
  return {
    order,
    params: [
      ...config.groups.map((g) => ({
        key: g.id,
        shareable: true,
        defaultValue: String(pagePreset?.[g.id] ?? g.default),
        allowedValues: g.type !== 'multi-qty' && g.options ? g.options.map((o) => o.id) : undefined,
        multiQtyKeys: g.type === 'multi-qty' ? g.options?.map((o) => o.id) : undefined,
        numeric:
          g.type === 'dimension' || g.type === 'qty-slider'
            ? { min: g.min, max: g.max }
            : undefined,
      })),
      {
        key: 'qty',
        shareable: true,
        defaultValue: String(pagePreset?.qty ?? config.defaultQty),
        numeric: {
          min: config.qtyTiers?.[0]?.qty ?? config.qtyRange?.min ?? 1,
          max: maxQty ? maxQty * 10 : undefined,
        },
      },
      { key: 'express', shareable: true, defaultValue: '0', allowedValues: ['0', '1'] },
    ],
  };
}
