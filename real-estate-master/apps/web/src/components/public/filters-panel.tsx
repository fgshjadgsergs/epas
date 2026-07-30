"use client";

import { useRouter } from "next/navigation";
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import noUiSlider from "nouislider";
import "nouislider/dist/nouislider.css";
import {
  PUBLIC_AREA_RANGE,
  PUBLIC_DEAL_TYPES,
  PUBLIC_LOCATIONS,
  PUBLIC_PRICE_RANGE,
  PublicDealTypeKey,
  PublicFiltersDraft,
  PublicLocationKey,
  buildPublicFilterSearchUpdates,
  buildPublicFiltersDraft,
  formatNumberRu,
  resolveSliderRange,
  sanitizeNumericDraft,
  validatePublicFiltersDraft,
} from "@/lib/public-filters";
import { SearchParamsRecord, buildPathWithSearchParams } from "@/lib/public-query";

interface FiltersPanelProps {
  searchParams: SearchParamsRecord;
  submitPath?: string;
  /** hero — стеклянная панель на главной; sheet — внутри шторки приложения */
  variant?: "hero" | "sheet";
  /** вызывается после перехода к выдаче — шторка закрывает себя */
  onSubmitted?: () => void;
}

type SliderHost = HTMLDivElement & {
  noUiSlider?: SliderApi;
};

interface SliderApi {
  on: (event: string, callback: (values: string[]) => void) => void;
  set: (values: [number, number]) => void;
  get: () => string[];
  destroy: () => void;
}

function rangesEqual(left: [number, number], right: [number, number]): boolean {
  return left[0] === right[0] && left[1] === right[1];
}

export default function FiltersPanel({
  searchParams,
  submitPath = "/listing",
  variant = "hero",
  onSubmitted,
}: FiltersPanelProps) {
  const router = useRouter();

  const priceRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);

  const syncingPriceSliderRef = useRef(false);
  const syncingAreaSliderRef = useRef(false);

  const searchParamsKey = useMemo(() => JSON.stringify(searchParams), [searchParams]);
  const initialDraft = useMemo(() => buildPublicFiltersDraft(searchParams), [searchParamsKey]);

  const [draft, setDraft] = useState<PublicFiltersDraft>(initialDraft);
  const [errors, setErrors] = useState<{ priceRange?: string; areaRange?: string }>({});

  useEffect(() => {
    setDraft(initialDraft);
    setErrors({});
  }, [initialDraft]);

  useEffect(() => {
    const sliderHost = priceRef.current;

    if (!sliderHost || (sliderHost as SliderHost).noUiSlider) {
      return;
    }

    noUiSlider.create(sliderHost, {
      start: resolveSliderRange(initialDraft.priceFrom, initialDraft.priceTo, PUBLIC_PRICE_RANGE),
      connect: true,
      range: {
        min: PUBLIC_PRICE_RANGE.min,
        max: PUBLIC_PRICE_RANGE.max,
      },
      step: PUBLIC_PRICE_RANGE.step,
    });

    const slider = (sliderHost as SliderHost).noUiSlider;

    // noUiSlider синхронно шлёт "update" в момент подписки — без гварда
    // пустой драфт заполняется границами диапазона (0 и 500 000 000),
    // и «Найти» добавляет фильтр, который пользователь не ставил.
    syncingPriceSliderRef.current = true;
    slider?.on("update", (values) => {
      if (syncingPriceSliderRef.current) {
        return;
      }

      const nextRange: [number, number] = [
        Math.round(Number(values[0])),
        Math.round(Number(values[1])),
      ];

      setDraft((currentDraft) => {
        const nextPriceFrom = String(nextRange[0]);
        const nextPriceTo = String(nextRange[1]);

        if (currentDraft.priceFrom === nextPriceFrom && currentDraft.priceTo === nextPriceTo) {
          return currentDraft;
        }

        return {
          ...currentDraft,
          priceFrom: nextPriceFrom,
          priceTo: nextPriceTo,
        };
      });

      setErrors((currentErrors) => ({
        ...currentErrors,
        priceRange: undefined,
      }));
    });
    syncingPriceSliderRef.current = false;

    return () => {
      slider?.destroy();
    };
  }, [initialDraft.priceFrom, initialDraft.priceTo]);

  useEffect(() => {
    const sliderHost = areaRef.current;

    if (!sliderHost || (sliderHost as SliderHost).noUiSlider) {
      return;
    }

    noUiSlider.create(sliderHost, {
      start: resolveSliderRange(initialDraft.areaFrom, initialDraft.areaTo, PUBLIC_AREA_RANGE),
      connect: true,
      range: {
        min: PUBLIC_AREA_RANGE.min,
        max: PUBLIC_AREA_RANGE.max,
      },
      step: PUBLIC_AREA_RANGE.step,
    });

    const slider = (sliderHost as SliderHost).noUiSlider;

    // см. комментарий у ценового слайдера
    syncingAreaSliderRef.current = true;
    slider?.on("update", (values) => {
      if (syncingAreaSliderRef.current) {
        return;
      }

      const nextRange: [number, number] = [
        Math.round(Number(values[0])),
        Math.round(Number(values[1])),
      ];

      setDraft((currentDraft) => {
        const nextAreaFrom = String(nextRange[0]);
        const nextAreaTo = String(nextRange[1]);

        if (currentDraft.areaFrom === nextAreaFrom && currentDraft.areaTo === nextAreaTo) {
          return currentDraft;
        }

        return {
          ...currentDraft,
          areaFrom: nextAreaFrom,
          areaTo: nextAreaTo,
        };
      });

      setErrors((currentErrors) => ({
        ...currentErrors,
        areaRange: undefined,
      }));
    });
    syncingAreaSliderRef.current = false;

    return () => {
      slider?.destroy();
    };
  }, [initialDraft.areaFrom, initialDraft.areaTo]);

  useEffect(() => {
    const sliderHost = priceRef.current as SliderHost | null;
    const slider = (sliderHost?.noUiSlider as SliderApi | null | undefined) ?? null;

    if (!slider) {
      return;
    }

    const nextRange = resolveSliderRange(draft.priceFrom, draft.priceTo, PUBLIC_PRICE_RANGE);
    const currentRange = slider.get().map((value) => Math.round(Number(value))) as [number, number];

    if (rangesEqual(currentRange, nextRange)) {
      return;
    }

    syncingPriceSliderRef.current = true;
    slider.set(nextRange);
    syncingPriceSliderRef.current = false;
  }, [draft.priceFrom, draft.priceTo]);

  useEffect(() => {
    const sliderHost = areaRef.current as SliderHost | null;
    const slider = (sliderHost?.noUiSlider as SliderApi | null | undefined) ?? null;

    if (!slider) {
      return;
    }

    const nextRange = resolveSliderRange(draft.areaFrom, draft.areaTo, PUBLIC_AREA_RANGE);
    const currentRange = slider.get().map((value) => Math.round(Number(value))) as [number, number];

    if (rangesEqual(currentRange, nextRange)) {
      return;
    }

    syncingAreaSliderRef.current = true;
    slider.set(nextRange);
    syncingAreaSliderRef.current = false;
  }, [draft.areaFrom, draft.areaTo]);

  function handleDealTypeChange(nextDealType: PublicDealTypeKey): void {
    setDraft((currentDraft) => ({
      ...currentDraft,
      dealType: currentDraft.dealType === nextDealType ? "" : nextDealType,
    }));
  }

  function handleLocationChange(nextLocation: PublicLocationKey): void {
    setDraft((currentDraft) => ({
      ...currentDraft,
      location: currentDraft.location === nextLocation ? "" : nextLocation,
    }));
  }

  function handleNumericDraftChange(
    field: keyof Pick<PublicFiltersDraft, "priceFrom" | "priceTo" | "areaFrom" | "areaTo">,
    value: string,
  ): void {
    const normalizedValue = sanitizeNumericDraft(value);

    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: normalizedValue,
    }));

    if (field === "priceFrom" || field === "priceTo") {
      setErrors((currentErrors) => ({
        ...currentErrors,
        priceRange: undefined,
      }));
    } else {
      setErrors((currentErrors) => ({
        ...currentErrors,
        areaRange: undefined,
      }));
    }
  }

  function handleSearch(): void {
    const validationErrors = validatePublicFiltersDraft(draft);

    if (validationErrors.priceRange || validationErrors.areaRange) {
      setErrors(validationErrors);
      return;
    }

    const updates = buildPublicFilterSearchUpdates(draft);
    router.push(buildPathWithSearchParams(submitPath, searchParams, updates));
    onSubmitted?.();
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSearch();
    }
  }

  function handleReset(): void {
    setDraft({
      searchByAddress: "",
      dealType: "",
      location: "",
      priceFrom: "",
      priceTo: "",
      areaFrom: "",
      areaTo: "",
    });
    setErrors({});
  }

  return (
    <div className={`filters-panel ${variant === "sheet" ? "filters-panel--sheet" : "filters-panel--hero"}`}>
      <div className="filters-search">
        <input
          type="text"
          value={draft.searchByAddress}
          placeholder="Поиск"
          onKeyDown={handleSearchKeyDown}
          onChange={(event) => {
            setDraft((currentDraft) => ({
              ...currentDraft,
              searchByAddress: event.target.value,
            }));
          }}
        />

        <button type="button" aria-label="Найти" onClick={handleSearch}>
          <span>⌕</span>
        </button>
      </div>

      <div className="fp-group">
        <span className="fp-label">Тип сделки</span>

        <div className="filters-row filters-row--deal-types">
          {Object.values(PUBLIC_DEAL_TYPES).map((item) => (
            <button
              key={item.key}
              type="button"
              className={`filter-btn ${draft.dealType === item.key ? "active" : ""}`}
              onClick={() => {
                handleDealTypeChange(item.key);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="filters-row filters-row--sliders">
        <div className="slider-block">
          <span className="slider-label">Цена, ₽</span>

          <div className="slider-inputs">
            <label className="range-field">
              <span>от</span>
              <input
                type="text"
                inputMode="numeric"
                value={formatNumberRu(draft.priceFrom)}
                placeholder="0"
                onChange={(event) => {
                  handleNumericDraftChange("priceFrom", event.target.value);
                }}
              />
            </label>

            <label className="range-field">
              <span>до</span>
              <input
                type="text"
                inputMode="numeric"
                value={formatNumberRu(draft.priceTo)}
                placeholder="любой"
                onChange={(event) => {
                  handleNumericDraftChange("priceTo", event.target.value);
                }}
              />
            </label>
          </div>

          <div className="filters-slider" ref={priceRef} />

          {errors.priceRange ? (
            <div className="filters-panel__error">{errors.priceRange}</div>
          ) : null}
        </div>

        <div className="slider-block">
          <span className="slider-label">Площадь, м²</span>

          <div className="slider-inputs">
            <label className="range-field">
              <span>от</span>
              <input
                type="text"
                inputMode="numeric"
                value={formatNumberRu(draft.areaFrom)}
                placeholder="0"
                onChange={(event) => {
                  handleNumericDraftChange("areaFrom", event.target.value);
                }}
              />
            </label>

            <label className="range-field">
              <span>до</span>
              <input
                type="text"
                inputMode="numeric"
                value={formatNumberRu(draft.areaTo)}
                placeholder="любой"
                onChange={(event) => {
                  handleNumericDraftChange("areaTo", event.target.value);
                }}
              />
            </label>
          </div>

          <div className="filters-slider" ref={areaRef} />

          {errors.areaRange ? (
            <div className="filters-panel__error">{errors.areaRange}</div>
          ) : null}
        </div>
      </div>

      <div className="filters-row filters-bottom">
        <div className="fp-group">
          <span className="fp-label">Расположение</span>

          <div className="region-buttons">
            {Object.values(PUBLIC_LOCATIONS).map((item) => (
              <button
                key={item.key}
                type="button"
                className={`filter-btn ${draft.location === item.key ? "active" : ""}`}
                onClick={() => {
                  handleLocationChange(item.key);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="fp-actions">
          <button type="button" className="fp-reset" onClick={handleReset}>
            Сбросить
          </button>

          <button type="button" className="search-btn" onClick={handleSearch}>
            Найти
          </button>
        </div>
      </div>
    </div>
  );
}
