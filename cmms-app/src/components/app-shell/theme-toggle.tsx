"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/theme-provider";

const MEDIA_QUERY = "(prefers-color-scheme: dark)";

function subscribeToSystemScheme(callback: () => void) {
  const mql = window.matchMedia(MEDIA_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSystemScheme(): "light" | "dark" {
  return window.matchMedia(MEDIA_QUERY).matches ? "dark" : "light";
}

function getServerScheme(): "light" | "dark" {
  return "light";
}

/** Deriva el tema resuelto (sistema o explícito) sin estado propio: useSyncExternalStore evita el falso-positivo de "setState en efecto". */
function useResolvedTheme(theme: "light" | "dark" | "system") {
  const systemScheme = useSyncExternalStore(subscribeToSystemScheme, getSystemScheme, getServerScheme);
  return theme === "system" ? systemScheme : theme;
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const resolved = useResolvedTheme(theme);

  return (
    <button
      type="button"
      onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}
      title={resolved === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="flex h-7 w-7 items-center justify-center rounded border border-border text-muted-fg hover:border-border-strong hover:text-foreground"
    >
      {resolved === "dark" ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
