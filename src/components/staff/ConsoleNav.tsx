"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type NavIcon = "home" | "cart" | "loyalty" | "activity" | "chart" | "inventory" | "products" | "customers" | "campaign" | "team" | "expenses" | "account" | "menu";
export type NavItem = { href: string; label: string; icon: NavIcon };
export type NavGroup = { label: string; items: NavItem[] };

const ICONS: Record<NavIcon, React.ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5V21H3V10.5Z" /><path d="M9 21v-7h6v7" /></>,
  cart: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 14h3M8 17h7" /></>,
  loyalty: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M8 15h3M16 14h.01" /></>,
  activity: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="7" cy="6" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="17" cy="18" r="1" /></>,
  chart: <><path d="M4 20V4M4 20h16M8 16l4-5 3 2 4-7" /></>,
  inventory: <><path d="m3 7 9-4 9 4-9 4-9-4ZM3 7v10l9 4 9-4V7M12 11v10" /></>,
  products: <><path d="M4 5h16v14H4zM4 10h16M9 10v9" /></>,
  customers: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M17 5a3 3 0 0 1 0 6M17 14a6 6 0 0 1 4 6" /></>,
  campaign: <><path d="M4 10h4l10-5v14L8 14H4v-4ZM8 14l2 6h3" /></>,
  team: <><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2" /><path d="M2 20a6 6 0 0 1 12 0M15 15a5 5 0 0 1 7 5" /></>,
  expenses: <><path d="M4 4h16v16H4zM7 9h10M7 13h10M7 17h6" /></>,
  account: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
};

export function NavGlyph({ name, className = "h-5 w-5" }: { name: NavIcon; className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>;
}

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/negocio" && pathname.startsWith(`${href}/`));
}

export function SideNav({ groups, light = false, onNavigate }: { groups: NavGroup[]; light?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return <div className="space-y-5">{groups.map((group) => <div key={group.label}>
    <p className={`mb-1.5 px-3 text-[0.66rem] font-bold uppercase tracking-[0.14em] ${light ? "text-slate-500" : "text-slate-400"}`}>{group.label}</p>
    <ul className="space-y-0.5">{group.items.map((item) => {
      const active = isActive(pathname, item.href);
      return <li key={item.href}><Link href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
        className={`group flex min-h-10 items-center gap-3 rounded-full px-3 text-[0.9rem] font-semibold transition ${light
          ? active ? "bg-white text-[#2949da] shadow-[0_6px_18px_-10px_rgb(11_18_32/.35)] ring-1 ring-slate-200/80" : "text-slate-600 hover:bg-white/70 hover:text-slate-950"
          : active ? "bg-white/13 text-white" : "text-slate-300 hover:bg-white/8 hover:text-white"}`}>
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition ${light ? active ? "bg-gradient-to-br from-[#2949da] to-[#7c5cff] text-white" : "bg-slate-100 text-slate-500 group-hover:text-slate-800" : ""}`}><NavGlyph name={item.icon} className="h-4 w-4" /></span>
        <span>{item.label}</span>
      </Link></li>;
    })}</ul>
  </div>)}</div>;
}

/** Tres tareas frecuentes visibles; el resto se abre en un menú completo y legible. */
export function BottomNav({ groups, quick }: { groups: NavGroup[]; quick: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
      if (event.key !== "Tab" || !panel.current) return;
      const focusables = Array.from(panel.current.querySelectorAll<HTMLElement>("button, a[href]"));
      if (!focusables.length) return;
      if (event.shiftKey && document.activeElement === focusables[0]) { event.preventDefault(); focusables.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === focusables.at(-1)) { event.preventDefault(); focusables[0]?.focus(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const moreActive = !quick.some((item) => isActive(pathname, item.href));
  return <>
    <nav aria-label="Acciones principales" className="fixed inset-x-3 bottom-3 z-40 rounded-[1.6rem] border border-white/80 bg-white/90 pb-[env(safe-area-inset-bottom)] shadow-[0_18px_40px_-18px_rgb(11_18_32/.45)] backdrop-blur-xl lg:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-4 p-1">{quick.map((item) => {
        const active = isActive(pathname, item.href);
        return <li key={item.href}><Link href={item.href} aria-current={active ? "page" : undefined}
          className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-[1.25rem] text-[0.7rem] font-semibold transition ${active ? "bg-[#2949da]/8 text-[#2949da]" : "text-slate-600"}`}>
          <NavGlyph name={item.icon} className="h-5 w-5" />{item.label}
        </Link></li>;
      })}<li><button ref={trigger} type="button" aria-expanded={open} aria-controls="mobile-workspace-menu" onClick={() => setOpen(true)}
        className={`flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-[1.25rem] text-[0.7rem] font-semibold transition ${open || moreActive ? "bg-[#2949da]/8 text-[#2949da]" : "text-slate-600"}`}>
        <NavGlyph name="menu" />Menú
      </button></li></ul>
    </nav>
    {open && <div className="fixed inset-0 z-50 lg:hidden"><button type="button" className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" aria-label="Cerrar menú" onClick={() => setOpen(false)} />
      <div id="mobile-workspace-menu" ref={panel} role="dialog" aria-modal="true" aria-label="Menú del espacio de trabajo"
        className="absolute inset-y-2 right-2 w-[min(90vw,23rem)] overflow-y-auto rounded-[1.75rem] bg-[#fbfbfd] px-4 pb-10 pt-5 shadow-2xl">
        <div className="mb-6 flex items-center justify-between px-1"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2949da]">Loyalty</p><h2 className="text-xl font-bold text-slate-900">Espacio de trabajo</h2></div>
          <button type="button" onClick={() => { setOpen(false); trigger.current?.focus(); }} className="min-h-10 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">Cerrar</button></div>
        <SideNav groups={groups} light onNavigate={() => setOpen(false)} />
      </div></div>}
  </>;
}
