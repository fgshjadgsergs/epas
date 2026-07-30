'use client';

import { create } from 'zustand';
import { getLayout, type LayoutId } from './layouts';

export interface Photo {
  id: string;
  url: string;
  name: string;
  width: number;
  height: number;
}

export interface Cell {
  photoId: string | null;
  zoom: number;
  offX: number;
  offY: number;
}

export interface TextBlock {
  id: string;
  text: string;
  xPct: number;
  yPct: number;
  size: number;
  align: 'left' | 'center' | 'right';
  color: string;
}

export interface Spread {
  id: string;
  layout: LayoutId;
  cells: Cell[];
  bg: string;
  texts: TextBlock[];
  cover?: boolean;
}

export interface BookParams {
  binding: 'layflat' | 'hardcover' | 'softcover';
  size: '20x20' | '25x25' | '30x30';
  paper: 'coated-170' | 'coated-200' | 'layflat-170';
  cover: 'standard' | 'leatherette' | 'design';
  copies: number;
}

type Step = 'params' | 'design' | 'order';

const uid = () => Math.random().toString(36).slice(2, 9);
const emptyCell = (): Cell => ({ photoId: null, zoom: 1, offX: 50, offY: 50 });

function makeSpread(layout: LayoutId = 'full', cover = false): Spread {
  const n = getLayout(layout).cells.length;
  return { id: uid(), layout, cells: Array.from({ length: n }, emptyCell), bg: '#ffffff', texts: [], cover };
}

function resizeCells(spread: Spread, layout: LayoutId): Cell[] {
  const n = getLayout(layout).cells.length;
  const next = Array.from({ length: n }, (_, i) => spread.cells[i] ?? emptyCell());
  return next;
}

interface State {
  step: Step;
  params: BookParams;
  photos: Photo[];
  spreads: Spread[];
  active: number;
  activePhotoId: string | null;
  selectedCell: number | null;
  savedAt: string | null;

  setStep: (s: Step) => void;
  setParams: (p: Partial<BookParams>) => void;
  initSpreads: (innerCount: number) => void;

  addPhotos: (files: FileList) => void;
  removePhoto: (id: string) => void;
  selectPhoto: (id: string | null) => void;

  setActive: (i: number) => void;
  addSpread: () => void;
  removeSpread: (i: number) => void;
  setLayout: (layout: LayoutId) => void;
  setBg: (color: string) => void;

  clickCell: (cellIdx: number) => void;
  clearCell: (cellIdx: number) => void;
  selectCell: (cellIdx: number | null) => void;
  adjustCell: (cellIdx: number, patch: Partial<Cell>) => void;

  addText: () => void;
  updateText: (id: string, patch: Partial<TextBlock>) => void;
  removeText: (id: string) => void;

  save: () => void;
  usage: (photoId: string) => number;
}

export const useEditor = create<State>((set, get) => ({
  step: 'params',
  params: { binding: 'hardcover', size: '20x20', paper: 'coated-200', cover: 'standard', copies: 1 },
  photos: [],
  spreads: [makeSpread('full', true), ...Array.from({ length: 10 }, () => makeSpread('full'))],
  active: 0,
  activePhotoId: null,
  selectedCell: null,
  savedAt: null,

  setStep: (s) => set({ step: s }),
  setParams: (p) => set((st) => ({ params: { ...st.params, ...p } })),

  initSpreads: (innerCount) =>
    set((st) => {
      const cover = st.spreads.find((s) => s.cover) ?? makeSpread('full', true);
      const inner = st.spreads.filter((s) => !s.cover);
      const next = [...inner];
      while (next.length < innerCount) next.push(makeSpread('full'));
      next.length = innerCount;
      return { spreads: [cover, ...next], active: 0 };
    }),

  addPhotos: (files) => {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const id = uid();
      const url = URL.createObjectURL(file);
      // Добавляем сразу, размеры дочитываем по onload (нужно для DPI-проверки).
      set((st) => ({ photos: [...st.photos, { id, url, name: file.name, width: 0, height: 0 }] }));
      const img = new Image();
      img.onload = () =>
        set((st) => ({
          photos: st.photos.map((p) =>
            p.id === id ? { ...p, width: img.naturalWidth, height: img.naturalHeight } : p,
          ),
        }));
      img.src = url;
    });
  },
  removePhoto: (id) =>
    set((st) => ({
      photos: st.photos.filter((p) => p.id !== id),
      spreads: st.spreads.map((s) => ({
        ...s,
        cells: s.cells.map((c) => (c.photoId === id ? emptyCell() : c)),
      })),
      activePhotoId: st.activePhotoId === id ? null : st.activePhotoId,
    })),
  selectPhoto: (id) => set({ activePhotoId: id }),

  setActive: (i) => set({ active: i, selectedCell: null }),
  addSpread: () =>
    set((st) => {
      const spreads = [...st.spreads];
      spreads.splice(st.active + 1, 0, makeSpread('full'));
      return { spreads, active: st.active + 1 };
    }),
  removeSpread: (i) =>
    set((st) => {
      if (st.spreads[i]?.cover) return st;
      const inner = st.spreads.filter((s) => !s.cover).length;
      if (inner <= 10) return st; // минимум 10 разворотов (ТЗ)
      const spreads = st.spreads.filter((_, idx) => idx !== i);
      return { spreads, active: Math.max(0, Math.min(st.active, spreads.length - 1)) };
    }),
  setLayout: (layout) =>
    set((st) => ({
      spreads: st.spreads.map((s, i) =>
        i === st.active ? { ...s, layout, cells: resizeCells(s, layout) } : s,
      ),
      selectedCell: null,
    })),
  setBg: (color) =>
    set((st) => ({ spreads: st.spreads.map((s, i) => (i === st.active ? { ...s, bg: color } : s)) })),

  clickCell: (cellIdx) =>
    set((st) => {
      if (st.activePhotoId) {
        const spreads = st.spreads.map((s, i) =>
          i === st.active
            ? {
                ...s,
                cells: s.cells.map((c, ci) =>
                  ci === cellIdx ? { ...emptyCell(), photoId: st.activePhotoId } : c,
                ),
              }
            : s,
        );
        return { spreads, selectedCell: cellIdx };
      }
      return { selectedCell: cellIdx };
    }),
  clearCell: (cellIdx) =>
    set((st) => ({
      spreads: st.spreads.map((s, i) =>
        i === st.active ? { ...s, cells: s.cells.map((c, ci) => (ci === cellIdx ? emptyCell() : c)) } : s,
      ),
    })),
  selectCell: (cellIdx) => set({ selectedCell: cellIdx }),
  adjustCell: (cellIdx, patch) =>
    set((st) => ({
      spreads: st.spreads.map((s, i) =>
        i === st.active
          ? { ...s, cells: s.cells.map((c, ci) => (ci === cellIdx ? { ...c, ...patch } : c)) }
          : s,
      ),
    })),

  addText: () =>
    set((st) => ({
      spreads: st.spreads.map((s, i) =>
        i === st.active
          ? {
              ...s,
              texts: [
                ...s.texts,
                { id: uid(), text: 'Текст', xPct: 30, yPct: 45, size: 24, align: 'center', color: '#1f2937' },
              ],
            }
          : s,
      ),
    })),
  updateText: (id, patch) =>
    set((st) => ({
      spreads: st.spreads.map((s, i) =>
        i === st.active ? { ...s, texts: s.texts.map((t) => (t.id === id ? { ...t, ...patch } : t)) } : s,
      ),
    })),
  removeText: (id) =>
    set((st) => ({
      spreads: st.spreads.map((s, i) =>
        i === st.active ? { ...s, texts: s.texts.filter((t) => t.id !== id) } : s,
      ),
    })),

  save: () => {
    // Демо-автосохранение структуры проекта в localStorage.
    // На проде проект (включая фото в S3) сохраняется через POST /api/v1/photobook/project/save.
    const { params, spreads } = get();
    try {
      const payload = {
        params,
        spreads: spreads.map((s) => ({ ...s, cells: s.cells.map((c) => ({ ...c })) })),
      };
      localStorage.setItem('photobook-project', JSON.stringify(payload));
    } catch {
      /* localStorage недоступен/переполнен */
    }
    set({ savedAt: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) });
  },
  usage: (photoId) =>
    get().spreads.reduce((n, s) => n + s.cells.filter((c) => c.photoId === photoId).length, 0),
}));
