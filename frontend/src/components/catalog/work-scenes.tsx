/**
 * CSS-сцены «примеров работ» — миниатюры продуктов без изображений
 * (визитки, листовки, баннер, фотокнига, календарь, наклейки, фото).
 * Используются в галерее главной и блоках «Примеры наших работ»
 * на страницах услуг/категорий/фотокниг. Родитель должен иметь
 * класс `group` и `relative overflow-hidden`.
 */

export function SceneVizitka({ alt = false }: { alt?: boolean }) {
  return (
    <div
      className={`absolute inset-0 grid place-items-center bg-gradient-to-br ${alt ? 'from-accent/20 via-surface-2 to-bg-2' : 'from-primary/20 via-surface-2 to-bg-2'}`}
    >
      <div className="relative h-1/2 w-3/5">
        <div className="absolute inset-0 -rotate-6 rounded-lg bg-surface-2 shadow-lg" />
        <div className="absolute inset-0 rotate-3 rounded-lg bg-surface p-[9%] shadow-xl transition-transform duration-500 group-hover:rotate-1">
          <div className={`h-[12%] w-2/5 rounded-full bg-gradient-to-r ${alt ? 'from-accent to-primary' : 'from-primary to-accent'}`} />
          <div className="mt-[8%] h-[8%] w-4/5 rounded-full bg-border" />
          <div className="mt-[5%] h-[8%] w-3/5 rounded-full bg-border" />
          <div className="mt-[10%] flex items-center gap-[4%]">
            <div className={`aspect-square w-[14%] rounded-full ${alt ? 'bg-accent/30' : 'bg-primary/30'}`} />
            <div className="h-[8%] w-2/5 rounded-full bg-border" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SceneListovka() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-accent/15 via-surface-2 to-bg-2">
      <div className="h-3/4 w-1/2 -rotate-2 rounded-md bg-surface p-[7%] shadow-xl transition-transform duration-500 group-hover:rotate-0">
        <div className="h-1/3 rounded bg-gradient-to-br from-accent/60 to-primary/50" />
        <div className="mt-[8%] h-[5%] w-4/5 rounded-full bg-border" />
        <div className="mt-[5%] h-[5%] w-full rounded-full bg-border" />
        <div className="mt-[5%] h-[5%] w-3/5 rounded-full bg-border" />
        <div className="mt-[8%] h-[14%] w-1/2 rounded bg-primary/25" />
      </div>
    </div>
  );
}

export function SceneBanner() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-primary/15 via-surface-2 to-bg-2 p-[6%]">
      <div className="relative h-3/5 w-full rounded-md bg-surface p-[4%] shadow-xl">
        {/* Люверсы по углам */}
        {['left-[3%] top-[8%]', 'right-[3%] top-[8%]', 'left-[3%] bottom-[8%]', 'right-[3%] bottom-[8%]'].map(
          (pos) => (
            <div key={pos} className={`absolute ${pos} aspect-square h-[10%] rounded-full border-2 border-border bg-bg-2`} />
          ),
        )}
        <div className="ml-[8%] mt-[6%] h-[22%] w-1/2 rounded-full bg-gradient-to-r from-primary to-accent" />
        <div className="ml-[8%] mt-[7%] h-[12%] w-2/3 rounded-full bg-border" />
        <div className="ml-[8%] mt-[5%] h-[12%] w-2/5 rounded-full bg-border" />
      </div>
    </div>
  );
}

export function SceneBook() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-primary/15 via-surface-2 to-bg-2">
      <div className="grid h-1/2 w-3/4 grid-cols-2 gap-[2%] rounded-md bg-surface p-[3%] shadow-xl [transform:perspective(400px)_rotateX(18deg)] transition-transform duration-500 group-hover:[transform:perspective(400px)_rotateX(10deg)]">
        <div className="rounded-sm bg-gradient-to-br from-primary/40 to-accent/30" />
        <div className="grid grid-rows-2 gap-[6%]">
          <div className="rounded-sm bg-gradient-to-br from-accent/35 to-primary/25" />
          <div className="space-y-[8%] pt-[6%]">
            <div className="h-[14%] w-4/5 rounded-full bg-border" />
            <div className="h-[14%] w-3/5 rounded-full bg-border" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SceneCalendar() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-accent/15 via-surface-2 to-bg-2">
      <div className="h-3/4 w-3/5 rounded-md bg-surface p-[6%] shadow-xl">
        <div className="h-[16%] rounded bg-gradient-to-r from-accent/60 to-primary/50" />
        <div className="mt-[8%] grid grid-cols-7 gap-[4%]">
          {Array.from({ length: 28 }).map((_, i) => (
            <div
              key={i}
              className={`aspect-square rounded-[2px] ${i === 16 ? 'bg-primary' : 'bg-border/70'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SceneStickers() {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-surface-2 to-bg-2">
      <div className="absolute left-[14%] top-[18%] aspect-square w-[34%] rounded-full bg-gradient-to-br from-primary/70 to-primary/40 shadow-lg transition-transform duration-500 group-hover:-rotate-6" />
      <div className="absolute right-[16%] top-[36%] aspect-square w-[26%] rotate-12 rounded-2xl bg-gradient-to-br from-accent/70 to-accent/40 shadow-lg transition-transform duration-500 group-hover:rotate-6" />
      <div className="absolute bottom-[14%] left-[38%] aspect-square w-[22%] rounded-full border-4 border-surface bg-gradient-to-br from-accent/50 to-primary/50 shadow-lg" />
    </div>
  );
}

export function ScenePhoto({ alt = false }: { alt?: boolean }) {
  return (
    <div
      className={`absolute inset-0 grid place-items-center bg-gradient-to-br ${alt ? 'from-accent/15 via-surface-2 to-bg-2' : 'from-primary/15 via-surface-2 to-bg-2'}`}
    >
      <div className="h-2/3 w-3/5 rotate-2 rounded-md bg-surface p-[5%] shadow-xl transition-transform duration-500 group-hover:rotate-0">
        <div className="relative h-3/4 overflow-hidden rounded-sm bg-gradient-to-br from-primary/35 to-accent/25">
          {/* «Пейзаж»: солнце и холмы из фигур */}
          <div className={`absolute left-[14%] top-[16%] aspect-square h-1/4 rounded-full ${alt ? 'bg-accent/50' : 'bg-primary/50'}`} />
          <div className="absolute -bottom-1/4 -left-[10%] h-2/3 w-2/3 rotate-45 rounded-[20%] bg-accent/25" />
          <div className="absolute -bottom-1/3 right-[-15%] h-3/4 w-3/4 rotate-45 rounded-[20%] bg-primary/30" />
        </div>
        <div className="mt-[6%] h-[6%] w-1/2 rounded-full bg-border" />
      </div>
    </div>
  );
}
