import Link from "next/link";
import { BranchSwitcher } from "@/components/staff/BranchSwitcher";
import { BottomNav, type NavGroup, type NavItem, SideNav } from "@/components/staff/ConsoleNav";
import { SignOutButton } from "@/components/staff/SignOutButton";
import { ROLE_LABELS, can } from "@/domain/staff/permissions";
import { requireStaff } from "@/lib/staff/session";

/** Navegación orientada a tareas: operación diaria primero, administración después. */
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { membership, activeBranch } = await requireStaff();
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
        { href: "/negocio/inventario", label: "Inventario y recetas", icon: "inventory" as const },
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

  return <div className="console-shell min-h-dvh lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)]">
    <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto bg-[#14233b] px-4 py-6 text-white lg:flex">
      <Link href="/inicio" className="mb-8 flex items-center gap-3 px-2" aria-label="Loyalty, ir al inicio">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#3972e4] text-xl font-black text-white">L</span>
        <span><span className="block text-[0.65rem] font-bold uppercase tracking-[0.17em] text-sky-200">iautomexa</span>
          <span className="block text-lg font-bold leading-5">Loyalty</span></span>
      </Link>
      <div className="mb-6 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
        <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-slate-400">Espacio de</p>
        <p className="mt-1 truncate text-sm font-semibold text-white">{membership.business_name}</p>
      </div>
      <nav aria-label="Navegación del espacio de trabajo" className="flex-1"><SideNav groups={groups} /></nav>
      <div className="mt-8 space-y-3 border-t border-white/10 pt-5">
        <div className="px-2"><p className="text-sm font-semibold">{membership.display_name}</p><p className="text-xs text-slate-400">{ROLE_LABELS[role]}</p></div>
        <SignOutButton className="min-h-10 w-full rounded-lg border border-white/20 px-3 text-left text-sm font-semibold text-slate-200 hover:bg-white/10" />
      </div>
    </aside>

    <div className="min-w-0">
      <header className="sticky top-0 z-30 border-b border-[#e5eaf2] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[80rem] items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <div className="min-w-0 lg:hidden"><Link href="/inicio" className="flex items-center gap-2 text-sm font-bold text-[#14233b]">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#3972e4] text-white">L</span>
            <span className="truncate">{membership.business_name}</span></Link></div>
          <div className="hidden lg:block"><p className="text-[0.68rem] font-bold uppercase tracking-widest text-[#6380ad]">Espacio de trabajo</p>
            <p className="text-sm font-semibold text-[#14233b]">{membership.business_name}</p></div>
          <div className="flex min-w-0 items-center gap-3"><div className="hidden text-right sm:block"><p className="text-[0.68rem] font-bold uppercase tracking-wider text-slate-500">Sucursal activa</p></div>
            <BranchSwitcher branches={membership.branches} activeId={activeBranch?.id ?? null} />
            <Link href="/cuenta" aria-label="Mi cuenta" className="hidden h-9 w-9 place-items-center rounded-full border border-[#dce5f1] bg-[#edf2fb] text-sm font-bold text-[#315ca4] sm:grid">{membership.display_name.slice(0, 1).toUpperCase()}</Link>
          </div>
        </div>
      </header>

      {membership.mfa_pending && <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950">
        Para administrar el negocio, <Link href="/cuenta/verificacion" className="font-bold underline underline-offset-2">confirma tu identidad</Link>. Caja y fidelidad siguen disponibles.
      </p>}
      {membership.is_demo && <p className="border-b border-blue-100 bg-blue-50 px-4 py-2 text-center text-xs font-semibold text-blue-950">
        Entorno de demostración · productos y cifras marcados DEMO no son datos reales
      </p>}

      <main id="contenido" className="mx-auto max-w-[80rem] px-4 pb-28 pt-7 sm:px-8 lg:pb-14 lg:pt-9">{children}</main>
    </div>
    <BottomNav groups={groups} quick={[home, cash, loyalty]} />
  </div>;
}
