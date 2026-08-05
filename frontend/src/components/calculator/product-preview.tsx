'use client';

import { useState } from 'react';
import { RotateCw } from 'lucide-react';
import type { CalcConfig, CalcState, SwatchMeta } from '@/lib/calc/types';

function selectedOption(config: CalcConfig, groupId: string, state: CalcState) {
  return config.groups.find((g) => g.id === groupId)?.options?.find((o) => o.id === state.params[groupId]);
}

function sheenOverlay(meta?: SwatchMeta): React.CSSProperties {
  switch (meta?.sheen) {
    case 'gloss':
      return { background: 'linear-gradient(120deg, rgba(255,255,255,.55), rgba(255,255,255,0) 38%)' };
    case 'soft':
      return { background: 'radial-gradient(70% 60% at 30% 25%, rgba(255,255,255,.3), rgba(0,0,0,.03))' };
    case 'matte':
      return { background: 'linear-gradient(180deg, rgba(255,255,255,.08), rgba(0,0,0,.05))' };
    default:
      return {};
  }
}

export function ProductPreview({ config, state }: { config: CalcConfig; state: CalcState }) {
  if (config.preview === 'card') return <CardPreview config={config} state={state} />;
  if (config.preview === 'banner') return <BannerPreview state={state} />;
  if (config.preview === 'generic') return <GenericPreview config={config} state={state} />;
  if (config.preview === 'idphoto') return <IdPhotoPreview config={config} state={state} />;
  return <SheetPreview config={config} state={state} />;
}

/* ---------- Фото на документы (сетка снимков) ---------- */
function IdPhotoPreview({ config, state }: { config: CalcConfig; state: CalcState }) {
  const doc = config.groups
    .find((g) => g.id === 'document')
    ?.options?.find((o) => o.id === state.params.document);
  return (
    <div className="grid place-items-center">
      <div className="rounded-2xl bg-white p-3 shadow-[0_24px_48px_-16px_rgba(0,0,0,.5)]">
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="relative h-16 w-12 overflow-hidden rounded-sm bg-gradient-to-b from-sky-100 to-slate-200"
            >
              {/* силуэт */}
              <span className="absolute left-1/2 top-3 h-5 w-5 -translate-x-1/2 rounded-full bg-slate-400" />
              <span className="absolute left-1/2 top-8 h-8 w-9 -translate-x-1/2 rounded-t-full bg-slate-400" />
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-center text-sm text-muted">
        {doc?.label ?? 'Документ'} · {doc?.note ?? 'формат по ГОСТу'}
      </p>
    </div>
  );
}

/* ---------- Универсальное превью (сувениры, штампы и пр.) ---------- */
function GenericPreview({ config, state }: { config: CalcConfig; state: CalcState }) {
  // Тонируем по первому выбранному цветному свотчу (цвет изделия/чернил/материала).
  let tint = '#1d4ed8';
  for (const g of config.groups) {
    const o = g.options?.find((x) => x.id === state.params[g.id]);
    if (o?.swatch?.color && !o.swatch.color.includes('gradient')) {
      tint = o.swatch.color;
      break;
    }
  }
  return (
    <div className="grid place-items-center">
      <div
        className="relative grid aspect-[4/3] w-[min(320px,80%)] place-items-center overflow-hidden rounded-2xl"
        style={{
          background: `linear-gradient(145deg, ${tint}, rgba(0,0,0,.35))`,
          boxShadow: '0 24px 48px -16px rgba(0,0,0,.5)',
        }}
      >
        <div className="text-center text-white">
          <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-xl bg-white/20 text-2xl font-black">
            ★
          </div>
          <div className="text-sm font-semibold">Ваш логотип / макет</div>
          <div className="text-[11px] text-white/80">предпросмотр условный</div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Визитка с переворотом ---------- */
function CardPreview({ config, state }: { config: CalcConfig; state: CalcState }) {
  const [flipped, setFlipped] = useState(false);
  // «Свой размер» берёт габариты из слайдеров customW/customH.
  const isCustom = state.params.format === 'custom';
  const [w, h] = isCustom
    ? [Number(state.params.customW) || 90, Number(state.params.customH) || 50]
    : String(state.params.format ?? '90x50')
        .split('x')
        .map(Number);
  const isPlastic = state.params.subtype === 'plastic';
  const paper = selectedOption(config, 'paper', state);
  const coating = selectedOption(config, 'coating', state);
  const foil = state.params.subtype === 'foil' ? selectedOption(config, 'foil', state) : undefined;
  const rounded = state.upsells.includes('rounded-corners');
  const doubleSided = state.params.sides === 'double';

  const paperColor = isPlastic ? '#fdfdfd' : (paper?.swatch?.color ?? '#f3f1ea');
  const foilBg = foil?.swatch?.color ?? 'linear-gradient(135deg,#f7d774,#b8860b)';

  const face = (back: boolean): React.CSSProperties => ({
    background: paperColor,
    borderRadius: rounded ? 16 : 6,
    backfaceVisibility: 'hidden',
    transform: back ? 'rotateY(180deg)' : undefined,
  });

  return (
    <div className="flex flex-col items-center">
      <div style={{ perspective: 1200 }} className="grid w-full place-items-center">
        <div
          className="relative transition-transform duration-500"
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            width: 'min(330px, 78%)',
            aspectRatio: `${w} / ${h}`,
            boxShadow: '0 24px 48px -16px rgba(0,0,0,.55)',
            borderRadius: rounded ? 16 : 6,
          }}
        >
          {/* Лицо */}
          <div className="absolute inset-0 overflow-hidden p-4" style={face(false)}>
            <div className="flex h-full flex-col justify-between">
              <div className="h-5 w-5 rounded" style={{ background: foil ? foilBg : '#1d4ed8' }} />
              <div>
                <div
                  className="text-[13px] font-bold"
                  style={
                    foil
                      ? {
                          backgroundImage: foilBg,
                          WebkitBackgroundClip: 'text',
                          backgroundClip: 'text',
                          color: 'transparent',
                        }
                      : { color: '#1f2937' }
                  }
                >
                  Иван Петров
                </div>
                <div className="text-[8px] text-gray-500">Директор · ПРИНТЕРА</div>
                <div className="mt-1.5 h-px w-2/3" style={{ background: foil ? foilBg : '#cbd5e1' }} />
                <div className="mt-1 text-[7px] text-gray-400">+7 495 000-00-00 · printera.ru</div>
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0" style={sheenOverlay(coating?.swatch)} />
          </div>
          {/* Оборот */}
          <div className="absolute inset-0 overflow-hidden" style={face(true)}>
            {doubleSided ? (
              <div className="grid h-full place-items-center" style={{ background: paperColor }}>
                <div className="h-7 w-7 rounded" style={{ background: foil ? foilBg : '#1d4ed8' }} />
                <div className="pointer-events-none absolute inset-0" style={sheenOverlay(coating?.swatch)} />
              </div>
            ) : (
              <div className="grid h-full place-items-center bg-gray-100 text-[9px] text-gray-400">
                Без печати (1 сторона)
              </div>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-fg"
      >
        <RotateCw size={13} /> {flipped ? 'Лицо' : 'Оборот'}
      </button>
    </div>
  );
}

/* ---------- Лист (листовка) ---------- */
function SheetPreview({ config, state }: { config: CalcConfig; state: CalcState }) {
  const ratios: Record<string, number> = { A4: 0.707, A5: 0.707, A6: 0.707, DL: 0.46 };
  const ratio = ratios[String(state.params.format)] ?? 0.707;
  const paper = selectedOption(config, 'paper', state);
  const coating = selectedOption(config, 'coating', state);
  const color = String(state.params.color ?? '4+4');
  const colored = color.startsWith('4');
  const paperColor = paper?.swatch?.color ?? '#f1efe9';

  return (
    <div className="grid place-items-center">
      <div
        className="relative overflow-hidden"
        style={{
          background: paperColor,
          height: 'min(240px, 60vw)',
          aspectRatio: `${ratio}`,
          borderRadius: 4,
          boxShadow: '0 24px 48px -16px rgba(0,0,0,.5)',
        }}
      >
        <div className="flex h-full flex-col gap-1.5 p-4">
          <div
            className="h-12 rounded"
            style={{ background: colored ? 'linear-gradient(135deg,#2563eb,#7c3aed)' : '#9ca3af' }}
          />
          <div className="h-2 w-3/4 rounded" style={{ background: colored ? '#1f2937' : '#6b7280' }} />
          <div className="h-1.5 w-full rounded bg-gray-300" />
          <div className="h-1.5 w-5/6 rounded bg-gray-300" />
          <div
            className="mt-auto h-6 w-1/2 rounded"
            style={{ background: colored ? '#16a34a' : '#9ca3af' }}
          />
        </div>
        <div className="pointer-events-none absolute inset-0" style={sheenOverlay(coating?.swatch)} />
      </div>
    </div>
  );
}

/* ---------- Баннер ---------- */
function BannerPreview({ state }: { state: CalcState }) {
  // urlKey w/h — как в backend definition и примерах ТЗ URL (/bannery/?w=2&h=1).
  const w = Number(state.params.w) || 2;
  const h = Number(state.params.h) || 1;
  const withLugs = state.params.lugs != null && state.params.lugs !== 'none';
  const area = (w * h).toFixed(2);

  return (
    <div className="grid place-items-center">
      <div className="relative" style={{ width: 'min(340px, 84%)' }}>
        <div
          className="relative overflow-hidden rounded-sm bg-gradient-to-br from-blue-600 to-violet-600"
          style={{ aspectRatio: `${w} / ${h}`, boxShadow: '0 24px 48px -16px rgba(0,0,0,.5)' }}
        >
          <div className="grid h-full place-items-center text-center">
            <div>
              <div className="text-sm font-black text-white">ВАШ БАННЕР</div>
              <div className="text-[10px] text-white/80">широкоформатная печать</div>
            </div>
          </div>
          {/* Люверсы по углам */}
          {withLugs &&
            ['left-1.5 top-1.5', 'right-1.5 top-1.5', 'left-1.5 bottom-1.5', 'right-1.5 bottom-1.5'].map(
              (pos) => (
                <span
                  key={pos}
                  className={`absolute ${pos} h-2 w-2 rounded-full bg-white/90 ring-1 ring-black/20`}
                />
              ),
            )}
        </div>
        <p className="mt-3 text-center text-sm text-muted">
          {w.toFixed(1)} × {h.toFixed(1)} м · {area} м²{withLugs ? ' · люверсы' : ''}
        </p>
      </div>
    </div>
  );
}
