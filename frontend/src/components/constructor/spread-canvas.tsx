'use client';

import { Plus, Trash2, ImageIcon, X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditor, type Photo } from './store';
import { getLayout } from './layouts';

function pageWidthCm(size: string): number {
  return Number(size.split('x')[0]) || 20;
}

function dpiFor(photo: Photo, cellWpct: number, spreadWcm: number): number | null {
  if (!photo.width) return null;
  const cellCm = (spreadWcm * cellWpct) / 100;
  return Math.round(photo.width / (cellCm / 2.54));
}

export function SpreadCanvas() {
  const spreads = useEditor((s) => s.spreads);
  const active = useEditor((s) => s.active);
  const photos = useEditor((s) => s.photos);
  const selectedCell = useEditor((s) => s.selectedCell);
  const params = useEditor((s) => s.params);
  const { clickCell, clearCell, adjustCell, setActive, addSpread, removeSpread } = useEditor.getState();

  const spread = spreads[active];
  const layout = getLayout(spread.layout);
  const spreadWcm = pageWidthCm(params.size) * 2;

  return (
    <div className="flex h-full flex-col">
      {/* Холст разворота */}
      <div className="flex flex-1 items-center justify-center overflow-auto bg-bg-2 p-4 lg:p-8">
        <div
          className="relative w-full max-w-3xl shadow-pop"
          style={{ aspectRatio: '2 / 1', background: spread.bg }}
        >
          {/* Корешок */}
          {!spread.cover && (
            <div className="absolute inset-y-0 left-1/2 z-10 w-3 -translate-x-1/2 bg-[repeating-linear-gradient(45deg,rgba(0,0,0,.06),rgba(0,0,0,.06)_4px,transparent_4px,transparent_8px)]" />
          )}

          {/* Текстовая зона (для text_page) */}
          {layout.textZone && (
            <div
              className="absolute grid place-items-center p-4 text-center text-xs text-gray-400"
              style={{
                left: `${layout.textZone.x}%`,
                top: `${layout.textZone.y}%`,
                width: `${layout.textZone.w}%`,
                height: `${layout.textZone.h}%`,
              }}
            >
              Текстовая страница
            </div>
          )}

          {/* Ячейки */}
          {layout.cells.map((rect, ci) => {
            const cell = spread.cells[ci];
            const photo = cell?.photoId ? photos.find((p) => p.id === cell.photoId) : null;
            const dpi = photo ? dpiFor(photo, rect.w, spreadWcm) : null;
            const isSel = selectedCell === ci;
            return (
              <div
                key={ci}
                className="absolute p-1"
                style={{ left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%` }}
              >
                <div
                  onClick={() => clickCell(ci)}
                  data-cell={ci}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const pid = e.dataTransfer.getData('text/photo');
                    if (pid) {
                      useEditor.setState((st) => ({
                        spreads: st.spreads.map((s, i) =>
                          i === active
                            ? {
                                ...s,
                                cells: s.cells.map((c, idx) =>
                                  idx === ci ? { ...c, photoId: pid, zoom: 1, offX: 50, offY: 50 } : c,
                                ),
                              }
                            : s,
                        ),
                        selectedCell: ci,
                      }));
                    }
                  }}
                  className={cn(
                    'group relative h-full w-full cursor-pointer overflow-hidden rounded-sm',
                    isSel ? 'ring-2 ring-primary ring-offset-1' : 'ring-1 ring-black/10',
                    !photo && 'grid place-items-center bg-black/5',
                  )}
                >
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.url}
                      alt=""
                      className="h-full w-full object-cover"
                      style={{
                        transform: `scale(${cell.zoom})`,
                        objectPosition: `${cell.offX}% ${cell.offY}%`,
                      }}
                    />
                  ) : (
                    <span className="text-gray-400">
                      <ImageIcon size={20} />
                    </span>
                  )}

                  {/* DPI-предупреждение */}
                  {dpi !== null && dpi < 150 && (
                    <span
                      className={cn(
                        'absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full text-white',
                        dpi < 100 ? 'bg-danger' : 'bg-warning',
                      )}
                      title={
                        dpi < 100
                          ? `Слишком низкое разрешение (~${dpi} DPI)`
                          : `Низкое разрешение (~${dpi} DPI)`
                      }
                    >
                      <AlertTriangle size={12} />
                    </span>
                  )}

                  {/* Управление выбранной заполненной ячейкой */}
                  {isSel && photo && (
                    <div
                      className="absolute inset-x-1 bottom-1 flex items-center gap-2 rounded-lg bg-black/70 px-2 py-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="range"
                        min={1}
                        max={2.5}
                        step={0.05}
                        value={cell.zoom}
                        onChange={(e) => adjustCell(ci, { zoom: Number(e.target.value) })}
                        className="h-1 flex-1 accent-primary"
                        aria-label="Масштаб фото"
                      />
                      <button
                        onClick={() => clearCell(ci)}
                        className="text-white/80 hover:text-white"
                        title="Очистить"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Текстовые блоки */}
          {spread.texts.map((t) => (
            <div
              key={t.id}
              className="absolute select-none px-1"
              style={{
                left: `${t.xPct}%`,
                top: `${t.yPct}%`,
                fontSize: t.size,
                color: t.color,
                textAlign: t.align,
              }}
            >
              {t.text}
            </div>
          ))}
        </div>
      </div>

      {/* Навигация по разворотам */}
      <div className="flex items-center gap-2 overflow-x-auto border-t border-border bg-surface p-3">
        {spreads.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              'relative h-12 w-20 shrink-0 overflow-hidden rounded border text-[10px]',
              i === active ? 'border-primary ring-1 ring-primary' : 'border-border',
            )}
            style={{ background: s.bg }}
            title={s.cover ? 'Обложка' : `Разворот ${i}`}
          >
            <MiniSpread index={i} />
            <span className="absolute inset-x-0 bottom-0 bg-black/50 text-center text-[9px] text-white">
              {s.cover ? 'Обложка' : i}
            </span>
          </button>
        ))}
        <div className="flex shrink-0 gap-1">
          <button
            onClick={addSpread}
            className="grid h-12 w-10 place-items-center rounded border border-dashed border-border text-muted hover:border-primary hover:text-primary"
            title="Добавить разворот"
          >
            <Plus size={16} />
          </button>
          {!spread.cover && (
            <button
              onClick={() => removeSpread(active)}
              className="grid h-12 w-10 place-items-center rounded border border-border text-muted hover:border-danger hover:text-danger"
              title="Удалить разворот"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Мини-превью разворота в навигаторе. */
function MiniSpread({ index }: { index: number }) {
  const spread = useEditor((s) => s.spreads[index]);
  const photos = useEditor((s) => s.photos);
  if (!spread) return null;
  const layout = getLayout(spread.layout);
  return (
    <div className="absolute inset-0">
      {layout.cells.map((rect, ci) => {
        const cell = spread.cells[ci];
        const photo = cell?.photoId ? photos.find((p) => p.id === cell.photoId) : null;
        return (
          <div
            key={ci}
            className="absolute"
            style={{
              left: `${rect.x}%`,
              top: `${rect.y}%`,
              width: `${rect.w}%`,
              height: `${rect.h}%`,
              padding: 1,
            }}
          >
            <div className="h-full w-full overflow-hidden rounded-[1px] bg-black/10">
              {photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.url} alt="" className="h-full w-full object-cover" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
