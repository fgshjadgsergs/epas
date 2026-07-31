'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Zap } from 'lucide-react';
import type { CalcConfig, Selection } from '@/lib/calc/types';
import { calculate, expressAvailability, minQtyFor, multiTotal, parseCounts } from '@/lib/calc/pricing';
import { getCalculator } from '@/lib/calc/registry';
import { buildDefaultState } from '@/lib/calc/url-sync';
import { buildUrl, mergeSearch, serializeUrlState } from '@/lib/calculator/url-state';
import { specFromConfig, specFromDefinition } from '@/lib/calculator/spec';
import {
  availableUpsellsFromDefinition,
  buildGroupsFromDefinition,
  defaultsFromDefinition,
  disabledOptionsFromDefinition,
  expressAvailabilityFromDefinition,
  hiddenParamsFromDefinition,
  normalizeSelectionWithDefinition,
  qtyBoundsFromDefinition,
  sanitizePresetForDefinition,
  type RuleValues,
} from '@/lib/calculator/definition-view';
import { useCalculatorUrlState } from '@/hooks/use-calculator-url-state';
import { useCalculatorDefinition } from '@/hooks/use-backend-calculator';
import { useServerCalculation } from '@/hooks/use-server-calculation';
import { postConfirmCalculation, type CalculateRequestBody } from '@/lib/api/calculator';
import { trackGoal, trackVirtualHit } from '@/lib/analytics/yandex-metrika';
import { useCart } from '@/lib/cart/store';
import { ShareButton } from './share-button';
import { cn, formatPrice } from '@/lib/utils';
import { AnimatedPrice } from '@/components/fx/animated-price';
import { ProductPreview } from './product-preview';
import { PricePanel } from './price-panel';
import {
  DimensionSlider,
  MultiQty,
  SearchSelect,
  Segmented,
  Select,
  Swatches,
  QtySlider,
  Toggle,
} from './controls';

/**
 * Принимает slug страницы услуги (сериализуемый проп). Конфиг с функциями
 * совместимости импортируется здесь, на клиенте — поэтому не пересекает
 * границу server/client как проп.
 */
export function Calculator({ slug, name }: { slug: string; name: string }) {
  const entry = getCalculator(slug);
  if (!entry) return null;
  return (
    <CalculatorEngine
      config={entry.config}
      preset={entry.preset}
      calculatorServiceSlug={entry.calculatorServiceSlug}
      basePath={slug}
      name={name}
    />
  );
}

function normalizeParams(config: CalcConfig, params: Selection): Selection {
  const disabled = config.getDisabled?.(params) ?? {};
  const fixed = { ...params };
  for (const [groupId, ids] of Object.entries(disabled)) {
    if (ids.includes(fixed[groupId] as string)) {
      const g = config.groups.find((x) => x.id === groupId);
      const ok = g?.options?.find((o) => !ids.includes(o.id));
      if (ok) fixed[groupId] = ok.id;
    }
  }
  return fixed;
}

/** Плоские значения состояния для сопоставления условий definition-правил. */
function toRuleValues(params: Selection, express: boolean): RuleValues {
  const out: RuleValues = {};
  for (const [k, v] of Object.entries(params)) out[k] = v;
  out.express = express ? '1' : '0';
  return out;
}

function CalculatorEngine({
  config,
  preset,
  calculatorServiceSlug,
  basePath,
  name,
}: {
  config: CalcConfig;
  preset?: Selection;
  /**
   * Явный calculator binding страницы: backend-slug услуги, чьё definition
   * обслуживает калькулятор. Страницы-варианты (/listovki/a4/ и т.п.)
   * передают slug родительской услуги + собственный preset; slug никогда
   * не выводится из pathname.
   */
  calculatorServiceSlug?: string;
  basePath: string;
  name: string;
}) {
  const [state, setState] = useState(() => buildDefaultState(config, preset));
  const router = useRouter();
  const addToCart = useCart((s) => s.addItem);
  /**
   * Ключи, которые пользователь менял сам либо которые пришли из URL:
   * при поздней загрузке definition их значения НЕ сбрасываются на дефолты
   * backend (запрет двойной инициализации/reset пользовательского состояния).
   */
  const touched = useRef<Set<string>>(new Set());

  // Определение с backend — источник истины по параметрам/опциям/дефолтам/
  // правилам. Локальный CalcConfig после его загрузки поставляет только
  // presentation-данные (свотчи, бейджи, превью).
  const backendSlug = calculatorServiceSlug ?? '';
  const { definition, loaded } = useCalculatorDefinition(backendSlug);

  /**
   * Эффективный preset страницы: приоритет у backend-binding
   * (ServiceCalculator.preset из definition DTO), затем статический preset
   * registry. По definition preset санитизируется — неизвестные параметры и
   * недопустимые значения отбрасываются, обойти правила definition он не может.
   */
  const effectivePreset = useMemo<Selection>(() => {
    if (!definition) return preset ?? {};
    return sanitizePresetForDefinition(definition, (definition.preset as Record<string, unknown> | null) ?? preset ?? null);
  }, [definition, preset]);

  const spec = useMemo(
    () => (definition ? specFromDefinition(definition, effectivePreset) : specFromConfig(config, preset)),
    [definition, effectivePreset, config, preset],
  );

  // Production не работает на локальных бизнес-правилах: без definition
  // калькулятор показывает состояние недоступности и запрещает заказ.
  // В dev/preview локальный расчёт остаётся как явный демо-фолбэк.
  const requireBackend = process.env.NODE_ENV === 'production';
  const calculatorUnavailable = requireBackend && loaded && !definition;

  // Одноразовая инициализация из definition. Порядок источников:
  // дефолты definition → preset страницы → значения из URL → ввод
  // пользователя (touched-ключи не перезаписываются никогда).
  const definitionInitDone = useRef(false);
  useEffect(() => {
    if (!definition || definitionInitDone.current) return;
    definitionInitDone.current = true;
    setState((s) => {
      const params = { ...s.params };
      for (const p of definition.parameters) {
        if (p.urlKey === 'express') continue;
        if (touched.current.has(p.urlKey)) continue;
        const presetValue = effectivePreset[p.urlKey];
        if (presetValue !== undefined) {
          params[p.urlKey] = presetValue;
          continue;
        }
        if (p.default == null || p.default === '') continue;
        params[p.urlKey] = p.type === 'DIMENSION' ? Number(p.default) : p.default;
      }
      const normalized = normalizeSelectionWithDefinition(definition, params);
      const qty = touched.current.has('qty')
        ? s.qty
        : Number(effectivePreset.qty ?? definition.qty.default);
      const bounds = qtyBoundsFromDefinition(definition, toRuleValues(normalized, s.express));
      return { ...s, params: normalized, qty: Math.max(qty, bounds.min) };
    });
  }, [definition, effectivePreset]);

  // Shareable-срез состояния для URL (upsells/b2b в URL не попадают: их
  // ключей нет в spec — см. ТЗ «URL-адреса в калькуляторах»). Скрытые при
  // текущем выборе параметры (custom w/h при стандартном формате и т.п.)
  // не сериализуются — «неприменимое» состояние не живёт в shareable URL.
  const urlValues = useMemo<Record<string, string | number | boolean>>(() => {
    const values: Record<string, string | number | boolean> = {
      ...state.params,
      qty: state.qty,
      express: state.express,
    };
    if (definition) {
      const hiddenNow = hiddenParamsFromDefinition(definition, toRuleValues(state.params, state.express));
      for (const key of hiddenNow) delete values[key];
    }
    return values;
  }, [state.params, state.qty, state.express, definition]);

  // Восстановление из URL (инициализация и popstate): состояние строится
  // от дефолтов + значений URL, чтобы «Назад» полностью отражал адрес.
  // Значения URL — явный выбор пользователя: помечаем их touched, чтобы
  // поздняя загрузка definition их не перезаписала.
  const applyUrlValues = (vals: Record<string, string>) => {
    for (const key of Object.keys(vals)) touched.current.add(key);
    setState((s) => {
      if (definition) {
        const params: Selection = { ...defaultsFromDefinition(definition), ...effectivePreset };
        for (const p of definition.parameters) {
          if (p.urlKey === 'express') continue;
          const raw = vals[p.urlKey];
          if (raw === undefined) continue;
          params[p.urlKey] = p.type === 'DIMENSION' ? Number(raw) : raw;
        }
        const normalized = normalizeSelectionWithDefinition(definition, params);
        const express = vals.express === '1';
        const bounds = qtyBoundsFromDefinition(definition, toRuleValues(normalized, express));
        const baseQty = Number(effectivePreset.qty ?? definition.qty.default);
        const rawQty = vals.qty !== undefined ? Number(vals.qty) : baseQty;
        return {
          ...s, // b2b и upsells — не URL-состояние, сохраняются
          params: normalized,
          qty: Math.max(Number.isFinite(rawQty) ? rawQty : baseQty, bounds.min),
          express,
        };
      }
      const base = buildDefaultState(config, preset);
      const params = { ...base.params };
      for (const g of config.groups) {
        const raw = vals[g.id];
        if (raw === undefined) continue;
        params[g.id] = g.type === 'dimension' ? Number(raw) : raw;
      }
      const normalized = normalizeParams(config, params);
      const qty = vals.qty !== undefined ? Number(vals.qty) : base.qty;
      return {
        ...s,
        params: normalized,
        qty: Math.max(Number.isFinite(qty) ? qty : base.qty, minQtyFor(config, normalized)),
        express: vals.express === '1',
      };
    });
  };

  // Диф для calc_param_change: одно событие на pushState со списком реально
  // изменённых параметров (debounce объединяет серию изменений). Это событие
  // про ВВОД пользователя; calc_calculation_succeeded/failed идут отдельно из
  // результата backend-расчёта ниже.
  const lastTracked = useRef<Record<string, string> | null>(null);
  const stringifyValues = (vals: Record<string, string | number | boolean>) => {
    const out: Record<string, string> = {};
    for (const p of spec.params) {
      const v = vals[p.key];
      if (v === undefined || v === null || v === '') continue;
      out[p.key] = typeof v === 'boolean' ? (v ? '1' : '0') : String(v);
    }
    return out;
  };

  // Единственная точка аналитики нового URL. Virtual pageview = новый URL,
  // созданный пользовательским pushState (после debounce 1000 мс). Сюда НЕ
  // попадают: initial load, replaceState-нормализация, popstate/back-forward,
  // повторные server-расчёты — они pushState не делают.
  useCalculatorUrlState({
    spec,
    values: urlValues,
    onRestore: applyUrlValues,
    onUrlPushed: (nextUrl, previousUrl) => {
      // URL берём из pushState (pathname+search), referer — предыдущий URL
      // до этого push. Один pushState = один hit (duplicate не создаём).
      trackVirtualHit(nextUrl, { title: document.title, referer: previousUrl });

      const current = stringifyValues(urlValues);
      const prev = lastTracked.current ?? {};
      const changed = Object.entries(current)
        .filter(([k, v]) => prev[k] !== v)
        .map(([param, value]) => ({ param, value }));
      if (changed.length > 0) {
        trackGoal('calc_param_change', { service: config.serviceId, changed });
      }
      lastTracked.current = current;
    },
  });

  useEffect(() => {
    lastTracked.current = null;
    trackGoal('calc_open', { service: config.serviceId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.serviceId]);

  // Локальный предрасчёт (мгновенный отклик и фолбэк без backend). НЕ
  // источник истины для checkout — только preview, пока backend не ответил
  // (блок 2 п.4): реальная кнопка блокируется по remote.canAddToCart.
  const localResult = useMemo(() => calculate(config, state), [config, state]);

  // Расчёт на backend — единственный источник истины по цене, когда
  // определение существует (debounce 300 мс, retry 5 с — ТЗ §15.4). b2b
  // больше не отправляется — коммерческий контекст определяет сервер.
  const remoteBody = useMemo<CalculateRequestBody | null>(() => {
    if (!definition) return null;
    // Скрытые при текущем выборе параметры (lugstep при lugs≠custom, custom
    // w/h при стандартном формате) в запрос не включаются — preview и confirm
    // получают одинаковый «применимый» вход; сервер их всё равно отбросил бы.
    const hiddenNow = hiddenParamsFromDefinition(definition, toRuleValues(state.params, state.express));
    const parameters: Record<string, string | number | Record<string, number>> = {};
    for (const p of definition.parameters) {
      if (hiddenNow.has(p.urlKey)) continue;
      if (p.type === 'MULTI_QTY') {
        // Движок принимает ОБЪЕКТ machineKey → количество; компактная строка
        // «key:qty,…» — только представление состояния/URL. Пустой объект
        // отправляется явно: сервер ответит «добавьте хотя бы одну позицию»,
        // а не подставит дефолт заново.
        parameters[p.urlKey] = parseCounts(state.params[p.urlKey]);
        continue;
      }
      const v = p.urlKey === 'express' ? (state.express ? '1' : '0') : state.params[p.urlKey];
      if (v !== undefined && v !== null && v !== '') parameters[p.urlKey] = v;
    }
    parameters.qty = state.qty;
    return { parameters, upsells: state.upsells };
  }, [definition, state]);

  const remote = useServerCalculation(backendSlug, remoteBody, definition !== null, {
    onSucceeded: () => {
      // Успех расчёта — это goal, а не просмотр страницы. Virtual pageview
      // отправляется только на пользовательский pushState (см. onUrlPushed),
      // иначе hit летел бы на initial load, popstate и каждый пересчёт.
      trackGoal('calc_calculation_succeeded', { service: config.serviceId });
    },
    onFailed: (reason) => {
      // Ошибка расчёта — только цель "неудача", без виртуального просмотра.
      trackGoal('calc_calculation_failed', { service: config.serviceId, reason });
    },
  });

  const result = useMemo(() => {
    if (!remote.data) return localResult;
    const priceRub = remote.data.price.amountMinor / 100;
    return {
      ...localResult,
      price: priceRub,
      pricePerUnit: remote.data.unitPrice.amountMinor / 100,
      priceWithVat: remote.data.priceWithVat
        ? remote.data.priceWithVat.amountMinor / 100
        : Math.round(priceRub * 1.2 * 100) / 100,
      readyDateLabel: remote.data.production.readyDateLabel || localResult.readyDateLabel,
      cutoff: remote.data.production.cutoff,
    };
  }, [remote.data, localResult]);

  // Только backend определяет, можно ли оформлять заказ. Локальный демо-
  // расчёт разрешает checkout ТОЛЬКО вне production (услуги, ещё не
  // переведённые на движок); в production без definition заказ невозможен.
  const canCheckout = definition ? remote.canAddToCart : !requireBackend;
  const priceIsStale = definition !== null && remote.status === 'stale';

  // Definition — источник состава/порядка полей, опций, дефолтов и правил;
  // локальный конфиг здесь даёт только presentation (свотчи/бейджи/превью).
  const valuesForRules = useMemo(
    () => toRuleValues(state.params, state.express),
    [state.params, state.express],
  );
  const definitionGroups = useMemo(
    () => (definition ? buildGroupsFromDefinition(definition, config) : null),
    [definition, config],
  );
  const groups = definitionGroups ?? config.groups;
  const disabled = definition
    ? disabledOptionsFromDefinition(definition, valuesForRules)
    : config.getDisabled?.(state.params) ?? {};
  const hidden = definition
    ? hiddenParamsFromDefinition(definition, valuesForRules)
    : new Set(config.getHidden?.(state.params) ?? []);
  const minQty = definition
    ? qtyBoundsFromDefinition(definition, valuesForRules).min
    : minQtyFor(config, state.params);
  // Мультиколичество: тираж = сумма счётчиков, обычный слайдер скрыт.
  // Группа берётся из derived groups (definition — источник состава строк).
  const multiGroup = groups.find((g) => g.type === 'multi-qty');
  const multiQty = multiGroup
    ? Object.values(parseCounts(state.params[multiGroup.id])).reduce((s, n) => s + n, 0)
    : -1;
  const isMulti = multiQty >= 0;
  const effectiveQty = isMulti ? Math.max(1, multiQty) : state.qty;
  const express = definition
    ? expressAvailabilityFromDefinition(definition, valuesForRules, effectiveQty)
    : expressAvailability(config, { params: state.params, qty: effectiveQty });
  const expressOn = state.express && express.ok;

  // Upsells: состав и доступность — из definition (visibleIf); подпись
  // выгоды — presentation из локального конфига (реальную дельту цены
  // сообщает backend в appliedUpsells).
  const upsellItems = definition
    ? availableUpsellsFromDefinition(definition, valuesForRules).map((u) => ({ id: u.code, label: u.label }))
    : (config.upsells ?? []).map((u) => ({ id: u.id, label: u.label }));

  // Выбранный upsell, ставший недоступным после смены параметров, снимается —
  // иначе backend честно ответит 422 на недоступную опцию.
  useEffect(() => {
    if (!definition) return;
    const available = new Set(availableUpsellsFromDefinition(definition, valuesForRules).map((u) => u.code));
    setState((s) =>
      s.upsells.every((u) => available.has(u)) ? s : { ...s, upsells: s.upsells.filter((u) => available.has(u)) },
    );
  }, [definition, valuesForRules]);

  const setParam = (id: string, v: string | number) => {
    touched.current.add(id);
    setState((s) => {
      if (definition) {
        const params = normalizeSelectionWithDefinition(definition, { ...s.params, [id]: v });
        const bounds = qtyBoundsFromDefinition(definition, toRuleValues(params, s.express));
        return { ...s, params, qty: Math.max(s.qty, bounds.min) };
      }
      const params = normalizeParams(config, { ...s.params, [id]: v });
      // Минимальный тираж зависит от параметров (напр. пластиковые визитки — от 100).
      return { ...s, params, qty: Math.max(s.qty, minQtyFor(config, params)) };
    });
    // calc_param_change отправляется одним событием после debounce-pushState
    // (см. onUrlPushed) — не на каждый клик.
  };
  const toggleUpsell = (id: string) =>
    setState((s) => ({
      ...s,
      upsells: s.upsells.includes(id) ? s.upsells.filter((u) => u !== id) : [...s.upsells, id],
    }));

  const upsellHint = (id: string) => {
    const u = config.upsells?.find((x) => x.id === id);
    if (!u) return '';
    return u.add
      ? `+${u.add} ₽`
      : u.coeff
        ? `+${Math.round((u.coeff - 1) * 100)}%`
        : u.perUnitAdd
          ? `+${u.perUnitAdd} ₽/шт`
          : '';
  };

  const [confirming, setConfirming] = useState(false);

  const checkout = async () => {
    // Блок 2: без свежего подтверждённого backend-расчёта в корзину ничего
    // не попадает — клиентская сумма никогда не источник истины.
    if (!canCheckout || !remoteBody || confirming) return;
    // Цели Метрики по ТЗ: клик «к оформлению» + добавление в корзину.
    trackGoal('calc_to_checkout', { service: config.serviceId });

    // Snapshot создаётся только явным действием «в корзину»: backend
    // пересчитывает ТОТ ЖЕ вход, что и preview — parameters + upsells.
    setConfirming(true);
    let confirmed: { snapshotId: string; price: { amountMinor: number; currency: string } };
    try {
      confirmed = await postConfirmCalculation(backendSlug, remoteBody);
    } catch {
      trackGoal('calc_calculation_failed', { service: config.serviceId, reason: 'confirm' });
      setConfirming(false);
      return;
    }
    // В серверную корзину уходит ТОЛЬКО id подтверждённого расчёта — цену,
    // состав и суммы определяет backend. Локальная позиция не создаётся.
    try {
      await addToCart(confirmed.snapshotId);
    } catch {
      setConfirming(false);
      return; // ошибку показывает баннер корзины, состояние ввода не теряется
    }
    setConfirming(false);

    trackGoal('add_to_cart', { service: config.serviceId, snapshotId: confirmed.snapshotId });
    router.push('/korzina/');
  };

  // Актуальный shareable-URL для кнопки «Поделиться» — сериализуется
  // немедленно, не дожидаясь debounce-pushState.
  const currentShareUrl = () =>
    buildUrl(
      window.location.pathname,
      mergeSearch(spec, serializeUrlState(spec, urlValues), window.location.search),
    );

  return (
    <div>
      {/* Мобильное превью — статичное, прокручивается вместе со страницей. */}
      <div className="mb-4 lg:hidden">
        <div className="rounded-xl border border-border bg-gradient-to-br from-surface-2 to-bg-2 p-3">
          <ProductPreview config={config} state={state} />
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1.35fr_1fr]">
        {/* Параметры */}
        <div className="space-y-6 rounded-2xl border border-border bg-surface p-5 lg:p-7">
          <h2 className="text-lg font-bold">Параметры заказа</h2>

          {/* Пресеты размеров — быстрый выбор ширины×высоты (ТЗ п.4.1). */}
          {config.sizePresets && (
            <div>
              <p className="mb-2 text-sm text-muted">Готовые размеры</p>
              <div className="flex flex-wrap gap-2">
                {config.sizePresets.map((p) => {
                  const active = Number(state.params.w) === p.w && Number(state.params.h) === p.h;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        touched.current.add('w');
                        touched.current.add('h');
                        setState((s) => ({
                          ...s,
                          params: definition
                            ? normalizeSelectionWithDefinition(definition, { ...s.params, w: p.w, h: p.h })
                            : normalizeParams(config, { ...s.params, w: p.w, h: p.h }),
                        }));
                      }}
                      className={cn(
                        'h-10 rounded-xl border px-3.5 text-sm font-medium transition-colors',
                        active
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-fg hover:border-primary/50',
                      )}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {groups.map((g) =>
            hidden.has(g.id) ? null : (
              <div key={g.id}>
                {g.type !== 'dimension' && <p className="mb-2 text-sm text-muted">{g.label}</p>}
                {g.type === 'segmented' && (
                  <Segmented
                    group={g}
                    value={state.params[g.id]}
                    disabledIds={disabled[g.id]}
                    onChange={(v) => setParam(g.id, v)}
                  />
                )}
                {g.type === 'swatch' && (
                  <Swatches
                    group={g}
                    value={state.params[g.id]}
                    disabledIds={disabled[g.id]}
                    onChange={(v) => setParam(g.id, v)}
                  />
                )}
                {g.type === 'dimension' && (
                  <DimensionSlider
                    group={g}
                    value={Number(state.params[g.id])}
                    onChange={(v) => setParam(g.id, v)}
                  />
                )}
                {g.type === 'select' && (
                  <Select group={g} value={state.params[g.id]} onChange={(v) => setParam(g.id, v)} />
                )}
                {g.type === 'search-select' && (
                  <SearchSelect group={g} value={state.params[g.id]} onChange={(v) => setParam(g.id, v)} />
                )}
                {g.type === 'multi-qty' && (
                  <>
                    <MultiQty group={g} value={state.params[g.id]} onChange={(v) => setParam(g.id, v)} />
                    {minQty > 1 && multiQty < minQty && (
                      <p className="mt-2 text-xs text-warning">
                        Минимальный тираж для выбранных параметров — {minQty.toLocaleString('ru-RU')} шт.
                        (сейчас {multiQty}).
                      </p>
                    )}
                  </>
                )}
              </div>
            ),
          )}

          {/* Тираж (при мультиколичестве сумма считается по счётчикам выше). */}
          {!isMulti && (
            <div className="border-t border-border pt-5">
              <QtySlider
                tiers={config.qtyTiers}
                range={config.qtyRange}
                value={state.qty}
                label={config.qtyLabel}
                minQty={minQty}
                onChange={(v) => {
                  touched.current.add('qty');
                  setState((s) => ({ ...s, qty: Math.max(v, minQty) }));
                }}
              />
              {config.derivedNote && (
                <p className="mt-2 text-sm text-muted" aria-live="polite">
                  {config.derivedNote(state.params, state.qty)}
                </p>
              )}
            </div>
          )}
          {isMulti && (
            <div className="flex items-center justify-between border-t border-border pt-5">
              <span className="text-sm text-muted">{config.qtyLabel ?? 'Итого'}</span>
              <span className="text-lg font-bold tabular-nums">
                {effectiveQty.toLocaleString('ru-RU')} шт.
              </span>
            </div>
          )}

          {/* Срочность: правило и надбавка индивидуальны для услуги (ТЗ «Калькуляторы цен»).
              Плашка переносится на узких экранах — бейдж не вылезает за рамки карточки. */}
          {config.express && (
            <div className="border-t border-border pt-5">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                <Toggle
                  checked={expressOn}
                  disabled={!express.ok}
                  onChange={(v) => setState((s) => ({ ...s, express: v }))}
                  label="Срочное изготовление"
                />
                <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning">
                  <Zap size={13} />
                  {config.express.label ?? 'быстрее'}, +{Math.round((config.express.coeff - 1) * 100)}%
                </span>
              </div>
              {!express.ok && express.reason && (
                <p className="mt-2 text-xs text-muted">Срочное изготовление: {express.reason}.</p>
              )}
            </div>
          )}

          {/* Upsell-опции: состав из definition (или локальный фолбэк) */}
          {upsellItems.length > 0 && (
            <div className="border-t border-border pt-5">
              <p className="mb-2 text-sm text-muted">Дополнительно</p>
              <div className="flex flex-wrap gap-2">
                {upsellItems.map((u) => {
                  const active = state.upsells.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleUpsell(u.id)}
                      className={cn(
                        'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors',
                        active
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50',
                      )}
                    >
                      <span
                        className={cn(
                          'grid h-4 w-4 place-items-center rounded border',
                          active ? 'border-primary bg-primary text-primary-fg' : 'border-border',
                        )}
                      >
                        {active && '✓'}
                      </span>
                      {u.label}
                      <span className="text-xs text-muted">{upsellHint(u.id)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Десктоп: превью + цена (sticky). На мобиле превью — статичное сверху, здесь только цена. */}
        <div className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface-2 to-bg-2 p-6 lg:block">
            <ProductPreview config={config} state={state} />
          </div>
          {calculatorUnavailable ? (
            <div role="alert" className="rounded-2xl border border-border bg-surface p-6">
              <p className="text-lg font-bold">Онлайн-расчёт временно недоступен</p>
              <p className="mt-2 text-sm text-muted">
                Не удалось загрузить конфигурацию калькулятора. Обновите страницу или попробуйте
                позже — оформление заказа без серверного расчёта отключено.
              </p>
            </div>
          ) : (
            <PricePanel
              result={result}
              b2b={state.b2b}
              onB2b={(v) => setState((s) => ({ ...s, b2b: v }))}
              qty={effectiveQty}
              onCheckout={checkout}
              checkoutDisabled={!canCheckout || confirming}
              stale={priceIsStale}
              pricingMode={remote.data?.pricingMode ?? null}
            />
          )}

          {/* Построчная разбивка MULTI_QTY с сервера: цены за единицу и суммы
              строк считает ТОЛЬКО backend — клиент их не воспроизводит. */}
          {!calculatorUnavailable && remote.data?.lineItems && remote.data.lineItems.length > 0 && (
            <dl
              className={cn(
                'space-y-1.5 rounded-2xl border border-border bg-surface px-5 py-4 text-sm',
                priceIsStale && 'opacity-50',
              )}
            >
              {remote.data.lineItems.map((li) => (
                <div key={li.key} className="flex justify-between gap-3">
                  <dt className="text-muted">
                    {li.label} · {li.quantity.toLocaleString('ru-RU')} шт ×{' '}
                    {formatPrice(li.unitPrice.amountMinor / 100)}
                  </dt>
                  <dd className="font-medium tabular-nums">{formatPrice(li.lineTotal.amountMinor / 100)}</dd>
                </div>
              ))}
              {remote.data.totalQuantity !== undefined && (
                <div className="flex justify-between gap-3 border-t border-border pt-1.5">
                  <dt className="text-muted">Всего фотографий</dt>
                  <dd className="font-semibold tabular-nums">
                    {remote.data.totalQuantity.toLocaleString('ru-RU')} шт
                  </dd>
                </div>
              )}
            </dl>
          )}

          {/* Производные метрики с сервера (площадь/периметр/люверсы):
              preview их НЕ рассчитывает сам — только отображает backend-значения. */}
          {!calculatorUnavailable && remote.data?.derived && remote.data.derived.length > 0 && (
            <dl
              className={cn(
                'space-y-1.5 rounded-2xl border border-border bg-surface px-5 py-4 text-sm',
                priceIsStale && 'opacity-50',
              )}
            >
              {remote.data.derived.map((m) => (
                <div key={m.code} className="flex justify-between gap-3">
                  <dt className="text-muted">{m.label}</dt>
                  <dd className="font-medium tabular-nums">
                    {m.perItem !== m.total
                      ? `${m.perItem.toLocaleString('ru-RU')} × ${effectiveQty} = ${m.total.toLocaleString('ru-RU')} ${m.unit}`
                      : `${m.total.toLocaleString('ru-RU')} ${m.unit}`}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {/* Ошибки backend-валидации — inline возле цены (ТЗ §15.4). */}
          {remote.fieldErrors.length > 0 && (
            <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
              {remote.fieldErrors[0].message}
            </p>
          )}
          {remote.offline && (
            <p className="rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning">
              Нет связи с сервером — показана последняя известная цена. Повторяем запрос…
            </p>
          )}

          <ShareButton getUrl={currentShareUrl} />
        </div>

        {/* Мобильный фикс-бар (при недоступном расчёте не показывается) */}
        {!calculatorUnavailable && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur lg:hidden">
          <div>
            <p className="text-xs text-muted">Итого{state.b2b ? ' с НДС' : ''}</p>
            <AnimatedPrice
              value={state.b2b ? result.priceWithVat : result.price}
              className="text-xl font-extrabold"
            />
          </div>
          <button
            onClick={checkout}
            disabled={!canCheckout || confirming}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-fg disabled:cursor-not-allowed disabled:opacity-50"
          >
            Оформить <ArrowRight size={16} />
          </button>
        </div>
        )}
      </div>
    </div>
  );
}
