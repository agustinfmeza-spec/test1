"use client";

import { signOut } from "next-auth/react";
import { ThemeToggle } from "./theme-toggle";
import { ROLE_LABELS } from "@/lib/labels";

export function Topbar({ name, role }: { name: string; role: string }) {
  return (
    <header className="flex h-12 items-center justify-between border-b border-border bg-surface px-4">
      <div />
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <div className="flex items-center gap-2 border-l border-border pl-3">
          <div className="text-right leading-tight">
            <div className="text-[13px] font-medium text-foreground">{name}</div>
            <div className="text-[11px] text-muted-fg">{ROLE_LABELS[role] ?? role}</div>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Cerrar sesión"
            className="flex h-7 w-7 items-center justify-center rounded border border-border text-muted-fg hover:border-danger hover:text-danger"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
