"use client";

import { Check, Palette } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "epas-crm-theme";

const THEMES = [
  { id: "asphalt", label: "Асфальт", swatch: "#232833" },
  { id: "night", label: "Ночь", swatch: "#0e1830" },
  { id: "onyx", label: "Оникс", swatch: "#1b1b1d" },
  { id: "emerald", label: "Изумруд", swatch: "#16211b" },
  { id: "day", label: "Дневная", swatch: "#f4f6fa" },
] as const;

type CrmThemeId = (typeof THEMES)[number]["id"];

function applyTheme(theme: CrmThemeId): void {
  if (theme === "asphalt") {
    document.documentElement.removeAttribute("data-crm-theme");
  } else {
    document.documentElement.setAttribute("data-crm-theme", theme);
  }
}

/**
 * Переключатель темы CRM. Независим от палитры публичного сайта:
 * свой атрибут data-crm-theme и свой ключ в localStorage; выбранная
 * тема применяется до первой отрисовки инлайн-скриптом в layout.
 */
export function CrmThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<CrmThemeId>("asphalt");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && THEMES.some((item) => item.id === stored)) {
      setTheme(stored as CrmThemeId);
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

  const selectTheme = (next: CrmThemeId): void => {
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
    <div className="crm-theme-switcher" ref={rootRef}>
      <button
        type="button"
        className="crm-theme-switcher__button"
        aria-label="Сменить тему CRM"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Palette aria-hidden="true" />
      </button>

      {open ? (
        <div className="crm-theme-switcher__menu" role="menu" aria-label="Тема CRM">
          {THEMES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitemradio"
              aria-checked={item.id === theme}
              className={`crm-theme-switcher__option${item.id === theme ? " is-active" : ""}`}
              onClick={() => selectTheme(item.id)}
            >
              <span className="crm-theme-switcher__swatch" style={{ background: item.swatch }} aria-hidden="true" />
              {item.label}
              {item.id === theme ? <Check className="crm-theme-switcher__check" aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
