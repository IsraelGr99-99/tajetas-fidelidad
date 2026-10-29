import Link from "next/link";
import { BranchSwitcher } from "@/components/staff/BranchSwitcher";
import { BottomNav, type NavGroup, type NavItem, SideNav } from "@/components/staff/ConsoleNav";
import { SignOutButton } from "@/components/staff/SignOutButton";
import { ROLE_LABELS, can } from "@/domain/staff/permissions";
import { requireStaff } from "@/lib/staff/session";

/** Navegación orientada a tareas: operación diaria primero, administración después. */
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { membership, memberships, activeBranch } = await requireStaff();
  const role = membership.role;
  const home: NavItem = { href: "/inicio", label: "Inicio", icon: "home" };
  const cash: NavItem = { href: "/caja", label: "Caja", icon: "cart" };
  const loyalty: NavItem = { href: "/barra", label: "Fidelidad", icon: "loyalty" };
  const groups: NavGroup[] = [
    { label: "Espacio de trabajo", items: [home] },
    { label: "Operación diaria", items: [cash, loyalty,
      ...(can(role, "view_branch_ledger") ? [{ href: "/movimientos", label: "Movimientos", icon: "activity" as const }] : [])] },
    ...(can(role, "manage_staff") ? [
      { label: "Control del negocio", items: [
        { href: "/negocio", label: "Resumen", icon: "chart" as const },
        { href: "/negocio/ventas", label: "Ventas de caja", icon: "cart" as const },
        { href: "/negocio/inventario", label: "Inventario e insumos", icon: "inventory" as const },
        { href: "/negocio/catalogo", label: "Catálogo y precios", icon: "products" as const },
        { href: "/negocio/finanzas", label: "Reportes y gastos", icon: "expenses" as const },
      ] },
      { label: "Relaciones y configuración", items: [
        { href: "/negocio/clientes", label: "Clientes", icon: "customers" as const },
        { href: "/negocio/programa", label: "Programa", icon: "campaign" as const },
        { href: "/negocio/equipo", label: "Equipo y sucursales", icon: "team" as const },
      ] },
    ] : []),
    { label: "Personal", items: [{ href: "/cuenta", label: "Mi cuenta", icon: "account" }] },
  ];

  const initial = membership.display_name.slice(0, 1).toUpperCase();

  return <div className="console-shell min-h-dvh lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
    <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto border-r border-slate-200/70 bg-white/70 px-4 py-5 text-slate-900 backdrop-blur-xl lg:flex">
      <Link href="/inicio" className="mb-6 flex items-center gap-2.5 px-2" aria-label="Loyalty, ir al inicio">
        <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-[0.6rem] bg-gradient-to-br from-[#2949da] to-[#7c5cff] text-xl text-white">✳</span>
        <span className="text-[1.35rem] font-extrabold tracking-[-0.06em]">Loyalty<span className="text-[#ed815d]">.</span></span>
      </Link>
      <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3 shadow-[0_10px_24px_-18px_rgb(11_18_32/.35)]">
        <p className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-[#2949da]">Tu negocio</p>
        <p className="mt-1 truncate text-sm font-bold text-slate-950">{membership.business_name}</p>
        {memberships.length > 1 ? <Link href="/cuenta" className="mt-1.5 inline-flex min-h-8 items-center text-xs font-bold text-[#2949da] hover:underline">Cambiar negocio →</Link> : null}
      </div>
      <nav aria-label="Navegación del espacio de trabajo" className="flex-1"><SideNav groups={groups} light /></nav>
      <div className="mt-6 border-t border-slate-200 pt-4">
        <div className="flex items-center gap-3 px-1">
          <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#2949da] to-[#7c5cff] text-sm font-bold text-white">{initial}</span>
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{membership.display_name}</p><p className="text-xs text-slate-500">{ROLE_LABELS[role]}</p></div>
        </div>
        <SignOutButton className="mt-3 min-h-10 w-full rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50" />
        <a href="https://iautomexa.com/" className="mt-3 flex min-h-8 items-center justify-center gap-1 text-[0.7rem] font-semibold text-slate-500 hover:text-[#2949da]">Una tecnología de <strong className="text-slate-700">iautomexa</strong> ↗</a>
      </div>
    </aside>

    <div className="min-w-0">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-[#fbfbfd]/80 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[80rem] items-center justify-between gap-3 px-4 sm:px-8">
          <div className="min-w-0 lg:hidden"><Link href="/inicio" className="flex items-center gap-2 text-sm font-bold text-slate-950">
            <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-[0.6rem] bg-gradient-to-br from-[#2949da] to-[#7c5cff] text-lg text-white">✳</span>
            <span className="truncate">{membership.business_name}</span></Link></div>
          <div className="hidden min-w-0 lg:block"><p className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-slate-500">Espacio de trabajo</p>
            <p className="truncate text-sm font-semibold text-slate-950">{membership.business_name}</p></div>
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden text-[0.66rem] font-bold uppercase tracking-[0.14em] text-slate-500 sm:block">Sucursal</span>
            <BranchSwitcher branches={membership.branches} activeId={activeBranch?.id ?? null} />
            <Link href="/cuenta" aria-label="Mi cuenta" className="hidden h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[#2949da] to-[#7c5cff] text-sm font-bold text-white shadow-[0_6px_16px_-8px_rgb(41_73_218/.8)] sm:grid">{initial}</Link>
          </div>
        </div>
      </header>

      {membership.mfa_pending && <p className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-950">
        Para administrar el negocio, <Link href="/cuenta/verificacion" className="font-bold underline underline-offset-2">confirma tu identidad</Link>. Caja y fidelidad siguen disponibles.
      </p>}
      {membership.is_demo && <div className="flex justify-center px-4 pt-4">
        <p className="inline-flex items-center gap-2 rounded-full border border-[#2949da]/15 bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-[0_6px_16px_-12px_rgb(41_73_218/.6)]">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#7c5cff]" />
          Entorno de demostración · las empresas, productos y cifras de ejemplo son ficticios
        </p>
      </div>}

      <main id="contenido" className="mx-auto max-w-[80rem] px-4 pb-28 pt-6 sm:px-8 lg:pb-14 lg:pt-8">{children}</main>
    </div>
    <BottomNav groups={groups} quick={[home, cash, loyalty]} />
  </div>;
}
