'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Check, Eye, Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditor } from './store';
import { PhotoPanel } from './photo-panel';
import { SpreadCanvas } from './spread-canvas';
import { Inspector } from './inspector';
import { getLayout } from './layouts';

const STEPS = [
  { id: 'params', label: 'Параметры' },
  { id: 'design', label: 'Дизайн' },
  { id: 'order', label: 'Заказ' },
] as const;

export function Editor() {
  const step = useEditor((s) => s.step);
  const setStep = useEditor((s) => s.setStep);
  const save = useEditor((s) => s.save);
  const savedAt = useEditor((s) => s.savedAt);
  const [preview, setPreview] = useState(false);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col lg:h-[calc(100vh-7rem)]">
      {/* Тулбар */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-3 py-2">
        <nav className="flex items-center gap-1 text-sm">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setStep(s.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium',
                step === s.id ? 'bg-primary/10 text-primary' : 'text-muted hover:text-fg',
              )}
            >
              <span
                className={cn(
                  'grid h-5 w-5 place-items-center rounded-full text-xs',
                  step === s.id ? 'bg-primary text-primary-fg' : 'bg-surface-2',
                )}
              >
                {i + 1}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {savedAt && (
            <span className="hidden items-center gap-1 text-xs text-success sm:flex">
              <Check size={13} /> сохранено {savedAt}
            </span>
          )}
          <button
            onClick={save}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm hover:bg-surface-2"
          >
            <Save size={15} /> <span className="hidden sm:inline">Сохранить</span>
          </button>
          <button
            onClick={() => setPreview(true)}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm hover:bg-surface-2"
          >
            <Eye size={15} /> <span className="hidden sm:inline">Предпросмотр</span>
          </button>
          <button
            onClick={() => setStep('order')}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
          >
            Перейти к заказу
          </button>
        </div>
      </div>

      {/* 3 панели (десктоп) / стек (мобайл) */}
      <div className="grid flex-1 grid-rows-[auto_1fr_auto] overflow-hidden lg:grid-cols-[16rem_1fr_18rem] lg:grid-rows-1">
        <aside className="row-start-2 max-h-48 overflow-hidden border-border lg:row-auto lg:max-h-none lg:border-r">
          <PhotoPanel />
        </aside>
        <main className="row-start-1 min-h-0 overflow-hidden lg:row-auto">
          <SpreadCanvas />
        </main>
        <aside className="row-start-3 max-h-72 overflow-hidden border-t border-border lg:row-auto lg:max-h-none lg:border-l lg:border-t-0">
          <Inspector />
        </aside>
      </div>

      <PreviewDialog open={preview} onClose={() => setPreview(false)} />
    </div>
  );
}

function PreviewDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const spreads = useEditor((s) => s.spreads);
  const photos = useEditor((s) => s.photos);
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed inset-4 z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-bg shadow-pop focus:outline-none lg:inset-10">
          <div className="flex items-center justify-between border-b border-border p-4">
            <Dialog.Title className="font-bold">Предпросмотр книги</Dialog.Title>
            <Dialog.Close className="grid h-9 w-9 place-items-center rounded-lg hover:bg-surface-2">
              <X size={18} />
            </Dialog.Close>
          </div>
          <p className="border-b border-border bg-warning/10 px-4 py-2 text-xs text-warning">
            Финальный вид может незначительно отличаться. Цвета зависят от настроек монитора.
          </p>
          <div className="grid flex-1 grid-cols-2 gap-4 overflow-y-auto p-4 md:grid-cols-3 lg:grid-cols-4">
            {spreads.map((s, i) => {
              const layout = getLayout(s.layout);
              return (
                <div key={s.id}>
                  <div
                    className="relative aspect-[2/1] overflow-hidden rounded shadow-card"
                    style={{ background: s.bg }}
                  >
                    {layout.cells.map((r, ci) => {
                      const photo = s.cells[ci]?.photoId
                        ? photos.find((p) => p.id === s.cells[ci].photoId)
                        : null;
                      return (
                        <div
                          key={ci}
                          className="absolute p-0.5"
                          style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` }}
                        >
                          <div className="h-full w-full overflow-hidden rounded-[2px] bg-black/10">
                            {photo && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={photo.url} alt="" className="h-full w-full object-cover" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-center text-[11px] text-muted">
                    {s.cover ? 'Обложка' : `Разворот ${i}`}
                  </p>
                </div>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
