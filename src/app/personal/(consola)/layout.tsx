import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";
import { SignOutButton } from "@/components/staff/SignOutButton";
import { ROLE_LABELS } from "@/domain/staff/permissions";
import { BRANCH_PICKER_PATH, CONSOLE_HOME } from "@/domain/staff/routes";
import { requireStaff } from "@/lib/staff/session";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaff();
  const { membership, activeBranch } = session;

  return (
    <div className="min-h-dvh bg-crema">
      <header className="grain bg-tabaco text-crema">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href={CONSOLE_HOME} className="flex items-center gap-3 rounded-full" aria-label={`${membership.business_name}, inicio de la consola`}>
            <LogoMark className="h-10 w-10" />
            <span className="leading-tight">
              <span className="block font-display text-lg">{membership.business_name}</span>
              <span className="bitacora text-[0.65rem] text-mostaza">Consola del personal</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <p className="hidden text-right text-sm leading-tight sm:block">
              <span className="block font-semibold">{membership.display_name}</span>
              <span className="text-crema/75">{ROLE_LABELS[membership.role]}</span>
            </p>
            <SignOutButton />
          </div>
        </div>
        <div className="border-t border-crema/10">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm sm:px-8">
            <p>
              <span className="text-crema/75">Sucursal: </span>
              <strong>{activeBranch ? activeBranch.name : "sin elegir"}</strong>
              <span className="text-crema/75 sm:hidden"> · {ROLE_LABELS[membership.role]}</span>
            </p>
            {membership.branches.length > 1 ? (
              <Link href={BRANCH_PICKER_PATH} className="font-semibold text-mostaza underline-offset-4 hover:underline">
                Cambiar sucursal
              </Link>
            ) : null}
          </div>
        </div>
        {membership.is_demo ? (
          <p className="bg-mostaza px-5 py-1.5 text-center text-xs font-semibold text-tabaco">
            Entorno de demostración: los productos y precios son de ejemplo.
          </p>
        ) : null}
      </header>
      <main id="contenido" className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
        {children}
      </main>
    </div>
  );
}
