/** 9 макетов разворота (ТЗ конструктора, п.4.4). Ячейки — в % площади разворота. */

export type LayoutId =
  | 'full'
  | 'half_lr'
  | 'top_bot'
  | 'grid_4'
  | 'grid_6'
  | 'one_big'
  | 'one_big_3'
  | 'text_page'
  | 'blank';

export interface CellRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutDef {
  id: LayoutId;
  label: string;
  cells: CellRect[];
  /** Текстовая зона (для text_page). */
  textZone?: CellRect;
}

export const LAYOUTS: LayoutDef[] = [
  { id: 'full', label: '1 фото', cells: [{ x: 0, y: 0, w: 100, h: 100 }] },
  {
    id: 'half_lr',
    label: '2 рядом',
    cells: [
      { x: 0, y: 0, w: 50, h: 100 },
      { x: 50, y: 0, w: 50, h: 100 },
    ],
  },
  {
    id: 'top_bot',
    label: 'Верх/низ',
    cells: [
      { x: 0, y: 0, w: 100, h: 50 },
      { x: 0, y: 50, w: 100, h: 50 },
    ],
  },
  {
    id: 'grid_4',
    label: 'Сетка 2×2',
    cells: [
      { x: 0, y: 0, w: 50, h: 50 },
      { x: 50, y: 0, w: 50, h: 50 },
      { x: 0, y: 50, w: 50, h: 50 },
      { x: 50, y: 50, w: 50, h: 50 },
    ],
  },
  {
    id: 'grid_6',
    label: 'Сетка 3×2',
    cells: [
      { x: 0, y: 0, w: 33.33, h: 50 },
      { x: 33.33, y: 0, w: 33.33, h: 50 },
      { x: 66.66, y: 0, w: 33.34, h: 50 },
      { x: 0, y: 50, w: 33.33, h: 50 },
      { x: 33.33, y: 50, w: 33.33, h: 50 },
      { x: 66.66, y: 50, w: 33.34, h: 50 },
    ],
  },
  {
    id: 'one_big',
    label: '1 большое + 2',
    cells: [
      { x: 0, y: 0, w: 66, h: 100 },
      { x: 66, y: 0, w: 34, h: 50 },
      { x: 66, y: 50, w: 34, h: 50 },
    ],
  },
  {
    id: 'one_big_3',
    label: '1 большое + 3',
    cells: [
      { x: 0, y: 0, w: 60, h: 100 },
      { x: 60, y: 0, w: 40, h: 33.33 },
      { x: 60, y: 33.33, w: 40, h: 33.33 },
      { x: 60, y: 66.66, w: 40, h: 33.34 },
    ],
  },
  {
    id: 'text_page',
    label: 'Текст + фото',
    cells: [{ x: 50, y: 0, w: 50, h: 100 }],
    textZone: { x: 0, y: 0, w: 50, h: 100 },
  },
  { id: 'blank', label: 'Пустой', cells: [] },
];

export function getLayout(id: LayoutId): LayoutDef {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}
