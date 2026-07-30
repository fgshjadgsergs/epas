'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Upload, X, AlertTriangle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditor } from './store';

export function PhotoPanel() {
  const photos = useEditor((s) => s.photos);
  const activePhotoId = useEditor((s) => s.activePhotoId);
  const addPhotos = useEditor((s) => s.addPhotos);
  const removePhoto = useEditor((s) => s.removePhoto);
  const selectPhoto = useEditor((s) => s.selectPhoto);
  const usage = useEditor((s) => s.usage);
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const used = photos.filter((p) => usage(p.id) > 0).length;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-3">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (e.dataTransfer.files) addPhotos(e.dataTransfer.files);
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed p-4 text-center text-xs transition-colors',
            drag ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50',
          )}
        >
          <Upload size={18} className="text-primary" />
          <span className="font-medium text-fg">Перетащите фото сюда</span>
          <span className="text-subtle">или нажмите для выбора (JPG, PNG, HEIC)</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && addPhotos(e.target.files)}
          />
        </label>
      </div>

      <div className="flex items-center justify-between px-3 py-2 text-xs text-muted">
        <span>{photos.length} фото</span>
        <span>
          {used} из {photos.length} использовано
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {photos.length === 0 ? (
          <div className="grid place-items-center py-10 text-center text-xs text-subtle">
            <ImagePlus size={28} className="mb-2 opacity-50" />
            Загрузите фото, чтобы начать
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p) => {
              const uses = usage(p.id);
              const lowRes = p.width > 0 && p.width < 1200;
              const active = activePhotoId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/photo', p.id)}
                  onClick={() => selectPhoto(active ? null : p.id)}
                  className={cn(
                    'group relative aspect-square overflow-hidden rounded-lg border-2',
                    active ? 'border-primary' : 'border-transparent hover:border-border',
                  )}
                  title={p.name}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.name} className="h-full w-full object-cover" />
                  {uses > 0 && (
                    <span className="absolute left-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-fg">
                      {uses}
                    </span>
                  )}
                  {lowRes && (
                    <span
                      className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-warning text-bg"
                      title="Низкое разрешение"
                    >
                      <AlertTriangle size={10} />
                    </span>
                  )}
                  {active && (
                    <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-primary/90 py-0.5 text-[10px] font-medium text-primary-fg">
                      <Check size={10} /> выбрано
                    </span>
                  )}
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.stopPropagation();
                      removePhoto(p.id);
                    }}
                    className="absolute right-1 bottom-1 hidden h-5 w-5 place-items-center rounded-full bg-black/60 text-white group-hover:grid"
                  >
                    <X size={11} />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {activePhotoId && (
        <div className="border-t border-border bg-primary/10 px-3 py-2 text-center text-[11px] text-primary">
          Нажмите на ячейку разворота, чтобы разместить фото
        </div>
      )}
    </div>
  );
}
