'use client';

import { useState } from 'react';
import { Layout, Palette, Type, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditor } from './store';
import { LAYOUTS, getLayout } from './layouts';

const BG_COLORS = [
  '#ffffff',
  '#f5f5f4',
  '#e7e5e4',
  '#1f2937',
  '#0f172a',
  '#fdf2f8',
  '#f0f9ff',
  '#f7fee7',
  '#fef3c7',
  '#ede9fe',
];

type Tab = 'layout' | 'bg' | 'text';

export function Inspector() {
  const [tab, setTab] = useState<Tab>('layout');
  const spreads = useEditor((s) => s.spreads);
  const active = useEditor((s) => s.active);
  const setLayout = useEditor((s) => s.setLayout);
  const setBg = useEditor((s) => s.setBg);
  const addText = useEditor((s) => s.addText);
  const updateText = useEditor((s) => s.updateText);
  const removeText = useEditor((s) => s.removeText);
  const spread = spreads[active];

  const tabs: { id: Tab; label: string; icon: typeof Layout }[] = [
    { id: 'layout', label: 'Макет', icon: Layout },
    { id: 'bg', label: 'Фон', icon: Palette },
    { id: 'text', label: 'Текст', icon: Type },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-3 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium',
              tab === t.id ? 'border-b-2 border-primary text-primary' : 'text-muted',
            )}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'layout' && (
          <div className="grid grid-cols-3 gap-2">
            {LAYOUTS.map((l) => (
              <button
                key={l.id}
                onClick={() => setLayout(l.id)}
                className={cn(
                  'rounded-lg border p-1.5',
                  spread.layout === l.id
                    ? 'border-primary ring-1 ring-primary'
                    : 'border-border hover:border-primary/50',
                )}
                title={l.label}
              >
                <div className="relative aspect-[2/1] w-full rounded bg-surface-2">
                  {getLayout(l.id).cells.map((r, i) => (
                    <span
                      key={i}
                      className="absolute rounded-[1px] bg-primary/40"
                      style={{
                        left: `${r.x}%`,
                        top: `${r.y}%`,
                        width: `${r.w}%`,
                        height: `${r.h}%`,
                        margin: 1,
                      }}
                    />
                  ))}
                </div>
                <span className="mt-1 block text-center text-[10px] text-muted">{l.label}</span>
              </button>
            ))}
          </div>
        )}

        {tab === 'bg' && (
          <div>
            <p className="mb-2 text-xs text-muted">Цвет фона разворота</p>
            <div className="flex flex-wrap gap-2">
              {BG_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setBg(c)}
                  className={cn(
                    'h-9 w-9 rounded-lg border',
                    spread.bg === c ? 'border-primary ring-1 ring-primary' : 'border-border',
                  )}
                  style={{ background: c }}
                  aria-label={c}
                />
              ))}
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm">
              <span className="text-muted">Свой цвет</span>
              <input
                type="color"
                value={spread.bg}
                onChange={(e) => setBg(e.target.value)}
                className="h-8 w-12 rounded border border-border bg-transparent"
              />
            </label>
          </div>
        )}

        {tab === 'text' && (
          <div className="space-y-3">
            <button
              onClick={addText}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2.5 text-sm font-medium text-primary hover:border-primary"
            >
              <Plus size={15} /> Добавить текстовый блок
            </button>
            {spread.texts.length === 0 && (
              <p className="text-center text-xs text-subtle">Текстовых блоков пока нет</p>
            )}
            {spread.texts.map((t) => (
              <div key={t.id} className="space-y-2 rounded-xl border border-border p-3">
                <textarea
                  value={t.text}
                  onChange={(e) => updateText(t.id, { text: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-fg"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={10}
                    max={48}
                    value={t.size}
                    onChange={(e) => updateText(t.id, { size: Number(e.target.value) })}
                    className="h-1 flex-1 accent-primary"
                    aria-label="Размер"
                  />
                  <input
                    type="color"
                    value={t.color}
                    onChange={(e) => updateText(t.id, { color: e.target.value })}
                    className="h-7 w-8 rounded border border-border bg-transparent"
                  />
                  <div className="flex rounded-lg border border-border">
                    {(['left', 'center', 'right'] as const).map((a) => (
                      <button
                        key={a}
                        onClick={() => updateText(t.id, { align: a })}
                        className={cn('px-1.5 py-1 text-xs', t.align === a ? 'text-primary' : 'text-muted')}
                      >
                        {a === 'left' ? '⇤' : a === 'center' ? '↔' : '⇥'}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => removeText(t.id)}
                    className="text-muted hover:text-danger"
                    title="Удалить"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
