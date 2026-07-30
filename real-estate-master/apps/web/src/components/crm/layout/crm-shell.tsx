"use client";

import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { CrmUser } from "@/lib/crm-api";
import { getCrmRoleLabel } from "@/lib/crm-role";
import { CrmLogoutButton } from "./crm-logout-button";
import { CrmNav } from "./crm-nav";

/**
 * Каркас CRM. Структура прежняя (сайдбар + контент); для мобильных
 * добавлены бургер в шапке и подложка — сайдбар выезжает панелью.
 */
export function CrmShell({ user, children }: { user: CrmUser; children: ReactNode }) {
  const displayName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || user.email;
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle("crm-nav-open", navOpen);

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setNavOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.classList.remove("crm-nav-open");
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [navOpen]);

  return (
    <div className="crm-shell">
      <aside className="crm-shell__sidebar">
        <div className="crm-brand">
          <div className="crm-brand__eyebrow">EPAS CRM</div>
          <div className="crm-brand__title">Панель оператора</div>
          <div className="crm-brand__subtitle">{getCrmRoleLabel(user)}</div>
        </div>

        <button
          type="button"
          className="crm-sidebar-close"
          aria-label="Закрыть меню"
          onClick={() => setNavOpen(false)}
        >
          <X aria-hidden="true" />
        </button>

        <CrmNav user={user} />

        <div className="crm-shell__sidebar-footer">
          <CrmLogoutButton />
        </div>
      </aside>

      <div className="crm-shell__backdrop" onClick={() => setNavOpen(false)} aria-hidden="true" />

      <div className="crm-shell__content">
        <header className="crm-shell__header">
          <button
            type="button"
            className="crm-burger"
            aria-label="Открыть меню"
            aria-expanded={navOpen}
            onClick={() => setNavOpen(true)}
          >
            <Menu aria-hidden="true" />
          </button>

          <div>
            <div className="crm-shell__user">{displayName}</div>
            <div className="crm-shell__role">{user.email}</div>
          </div>
        </header>

        <main className="crm-shell__main">{children}</main>
      </div>
    </div>
  );
}
