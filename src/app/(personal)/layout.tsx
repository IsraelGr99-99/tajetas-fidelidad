import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";
import { BranchSwitcher } from "@/components/staff/BranchSwitcher";
import { BottomNav, type NavItem, SideNav } from "@/components/staff/ConsoleNav";
import { SignOutButton } from "@/components/staff/SignOutButton";
import { ROLE_LABELS, can } from "@/domain/staff/permissions";
import { requireStaff } from "@/lib/staff/session";

/**
 * Estructura de la consola: barra lateral en computadora, barra inferior en el
 * celular y la sucursal siempre visible y cambiable desde el encabezado.
 */
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { membership, activeBranch } = await requireStaff();
  const role = membership.role;

  const items: NavItem[] = [
    ...(can(role, "earn_with_qr") || can(role, "redeem") ? [{ href: "/barra", label: "Barra", icon: "scan" as const }] : []),
    ...(can(role, "view_branch_ledger") ? [{ href: "/movimientos", label: "Movimientos", icon: "list" as const }] : []),
    ...(can(role, "manage_staff") ? [{ href: "/negocio", label: "Negocio", icon: "store" as const }] : []),
    { href: "/cuenta", label: "Cuenta", icon: "user" },
  ];

  return (
    <div className="min-h-dvh bg-crema lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Computadora */}
      <aside className="grain sticky top-0 hidden h-dvh flex-col justify-between bg-tabaco p-5 text-crema lg:flex">
        <div className="space-y-8">
          <Link href="/barra" className="flex items-center gap-3 rounded-2xl" aria-label={`${membership.business_name}, ir a la barra`}>
            <LogoMark className="h-11 w-11" />
            <span className="leading-tight">
              <span className="block font-display text-lg">{membership.business_name}</span>
              <span className="bitacora text-[0.6rem] text-mostaza">Consola</span>
            </span>
          </Link>
          <nav aria-label="Principal">
            <SideNav items={items} />
          </nav>
        </div>
        <div className="space-y-4 border-t border-crema/15 pt-4">
          <div>
            <p className="text-xs text-crema/70">Sucursal</p>
            <BranchSwitcher branches={membership.branches} activeId={activeBranch?.id ?? null} tone="dark" />
          </div>
          <div>
            <p className="font-semibold">{membership.display_name}</p>
            <p className="text-sm text-crema/75">{ROLE_LABELS[role]}</p>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <div className="min-w-0">
        {/* Celular */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-tabaco/10 bg-crema/95 px-4 py-3 backdrop-blur lg:hidden">
          <Link href="/barra" className="flex min-w-0 items-center gap-2" aria-label={`${membership.business_name}, ir a la barra`}>
            <LogoMark className="h-9 w-9 shrink-0" />
            <span className="truncate font-display text-lg text-tabaco">{membership.business_name}</span>
          </Link>
          <BranchSwitcher branches={membership.branches} activeId={activeBranch?.id ?? null} />
        </header>

        {membership.is_demo ? (
          <p className="bg-mostaza/80 px-4 py-1.5 text-center text-xs font-semibold text-tabaco">
            Entorno de demostración · productos, precios y datos marcados DEMO son de ejemplo
          </p>
        ) : null}

        <main id="contenido" className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-8 lg:pb-12 lg:pt-10">
          {children}
        </main>
      </div>

      <BottomNav items={items} />
    </div>
  );
}
