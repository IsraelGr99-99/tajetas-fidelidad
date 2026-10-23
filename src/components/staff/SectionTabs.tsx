"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Pestañas de sección con estado activo (desplazables en el celular). */
export function SectionTabs({ tabs, label }: { tabs: { href: string; label: string; exact?: boolean }[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 rounded-full bg-tabaco/5 p-1">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold transition ${
                  active ? "bg-papel text-tabaco shadow" : "text-tabaco/75 hover:text-tabaco"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
