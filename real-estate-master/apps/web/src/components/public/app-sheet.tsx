"use client";

import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

interface AppSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Универсальная «шторка» приложения: на мобильных выезжает снизу,
 * на десктопе — панелью справа. Используется для поиска и фильтров.
 */
export function AppSheet({ open, title, onClose, children }: AppSheetProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  // Портал в body: у липкого тулбара и нижней панели стоит backdrop-filter,
  // который делает предка containing block'ом для position:fixed — без
  // портала шторка позиционировалась бы относительно тулбара, а не окна.
  return createPortal(
    <div className="app-sheet" role="dialog" aria-modal="true" aria-label={title}>
      <div className="app-sheet__backdrop" onClick={onClose} />

      <div className="app-sheet__panel">
        <div className="app-sheet__grip" aria-hidden="true" />

        <header className="app-sheet__head">
          <h2 className="app-sheet__title">{title}</h2>
          <button type="button" className="app-sheet__close" aria-label="Закрыть" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="app-sheet__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
