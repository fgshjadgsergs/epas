"use client";

import { Check, Palette } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "epas-theme";

const THEMES = [
  { id: "night", label: "Ночь", swatch: "#0b1a36" },
  { id: "graphite", label: "Графит", swatch: "#232323" },
  { id: "malachite", label: "Малахит", swatch: "#0d3020" },
  { id: "light", label: "Светлая", swatch: "#f2f5fa" },
  { id: "sand", label: "Песочная", swatch: "#efe6d6" },
  { id: "jade", label: "Жадеит", swatch: "#dcebe1" },
] as const;

type ThemeId = (typeof THEMES)[number]["id"];

function applyTheme(theme: ThemeId): void {
  if (theme === "night") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

/**
 * Переключатель палитры. Выбор хранится в localStorage и применяется до
 * первой отрисовки инлайн-скриптом в корневом layout — без мигания темы.
 */
export function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeId>("night");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && THEMES.some((item) => item.id === stored)) {
      setTheme(stored as ThemeId);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent): void => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const selectTheme = (next: ThemeId): void => {
    setTheme(next);
    applyTheme(next);

    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // приватный режим — тема просто не сохранится
    }

    setOpen(false);
  };

  return (
    <div className="theme-switcher" ref={rootRef}>
      <button
        type="button"
        className="theme-switcher__button"
        aria-label="Сменить палитру"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Palette aria-hidden="true" />
      </button>

      {open ? (
        <div className="theme-switcher__menu" role="menu" aria-label="Палитра">
          {THEMES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitemradio"
              aria-checked={item.id === theme}
              className={`theme-switcher__option${item.id === theme ? " is-active" : ""}`}
              onClick={() => selectTheme(item.id)}
            >
              <span className="theme-switcher__swatch" style={{ background: item.swatch }} aria-hidden="true" />
              {item.label}
              {item.id === theme ? <Check className="theme-switcher__check" aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
