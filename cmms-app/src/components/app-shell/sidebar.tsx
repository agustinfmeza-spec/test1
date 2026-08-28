"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-config";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col bg-sidebar-bg text-sidebar-fg">
      <div className="flex h-12 items-center border-b border-sidebar-border px-4">
        <span className="text-sm font-semibold tracking-wide">CMMS / EAM</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mx-2 flex items-center rounded px-3 py-2 text-[13px] transition-colors ${
                isActive ? "bg-sidebar-active text-white" : "text-sidebar-fg-muted hover:bg-sidebar-active/60 hover:text-sidebar-fg"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
