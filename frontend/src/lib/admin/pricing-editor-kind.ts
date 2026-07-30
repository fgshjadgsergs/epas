/**
 * Выбор специализированного редактора цен по definition.code эталонных
 * калькуляторов. Логика цен НЕ переносится на фронт — это лишь маппинг
 * «какой калькулятор → какая форма». Неизвестный тип → технический fallback.
 */
export type PricingEditorKind = 'tier' | 'metric' | 'multiqty' | 'technical';

const CODE_TO_EDITOR: Record<string, PricingEditorKind> = {
  'business-cards': 'tier',
  leaflets: 'tier',
  'banner-print': 'metric',
  'photo-print': 'multiqty',
  // Партия C2 — TIER-калькуляторы (тот же tier-редактор, что у эталонов).
  booklets: 'tier',
  postcards: 'tier',
  certificates: 'tier',
  menu: 'tier',
  'badges-blanks': 'tier',
  stickers: 'tier',
  labels: 'tier',
  'calendar-wall': 'tier',
  'calendar-desk': 'tier',
  'calendar-pocket': 'tier',
  // Партия C3 — AREA (тот же metric-редактор, что у banner-print).
  'poster-print': 'metric',
  'canvas-print': 'metric',
  'foam-board': 'metric',
  presswall: 'metric',
  'interior-print': 'metric',
  // Roll-up — фиксированные размеры (OPTION) → tier-редактор.
  rollup: 'tier',
  // Партия C4 — документы/постпечать/печати/фото на документы. Единая
  // TIER-механика (BASE_TIER + множители/надбавки), тот же tier-редактор:
  // оператор меняет реальную цену без разработчика.
  'document-print': 'tier',
  'document-copy': 'tier',
  lamination: 'tier',
  'binding-staple': 'tier',
  'hard-cover-binding': 'tier',
  'stamp-auto': 'tier',
  'stamp-pocket': 'tier',
  facsimile: 'tier',
  'id-photo': 'tier',
  // Партия C5 — сувениры/текстиль + фотокниги. Футболки — мультиразмер
  // (тот же multiqty-редактор, что у фотопечати); кружки/шопперы/фотокниги —
  // TIER (тот же tier-редактор): оператор меняет реальную цену без разработчика.
  'tshirt-print': 'multiqty',
  'mug-print': 'tier',
  'shopper-print': 'tier',
  photobook: 'tier',
};

export function pickPricingEditor(definitionCode: string | null | undefined): PricingEditorKind {
  if (!definitionCode) return 'technical';
  return CODE_TO_EDITOR[definitionCode] ?? 'technical';
}
