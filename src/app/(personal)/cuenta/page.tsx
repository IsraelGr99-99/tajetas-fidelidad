import type { Metadata } from "next";
import Link from "next/link";
import { selectBranchAction, selectBusinessAction } from "@/actions/staff-session";
import { Notice } from "@/components/staff/OperationParts";
import { MfaSetup } from "@/components/staff/Mfa";
import { SignOutButton } from "@/components/staff/SignOutButton";
import { ROLE_LABELS, capabilitiesOf } from "@/domain/staff/permissions";
import { safeNextPath } from "@/domain/staff/routes";
import { requireStaff } from "@/lib/staff/session";

export const metadata: Metadata = { title: "Cuenta" };

const CAPABILITY_TEXT: Record<string, string> = {
  earn_with_qr: "Registrar visitas",
  redeem: "Canjear recompensas",
  earn_without_qr: "Registrar sin QR (búsqueda)",
  reverse: "Revertir movimientos",
  adjust_stamps: "Ajustar sellos",
  manage_campaigns: "Catálogo y programa",
  manage_staff: "Equipo y sucursales",
  view_customers_pii: "Consultar clientes",
  view_branch_ledger: "Ver movimientos",
  view_audit_log: "Auditoría",
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string; siguiente?: string }> }) {
  const { membership, memberships, activeBranch, email } = await requireStaff();
  const { error, siguiente } = await searchParams;
  const returnTo = safeNextPath(siguiente);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="rounded-3xl bg-papel p-6">
        <p className="bitacora text-arcilla-texto">{membership.business_name}</p>
        <h1 className="mt-2 text-3xl text-tabaco">{membership.display_name}</h1>
        <p className="mt-1 text-tabaco/75">
          {ROLE_LABELS[membership.role]}
          {email ? ` · ${email}` : ""}
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {capabilitiesOf(membership.role).map((c) => (
            <li key={c} className="rounded-full bg-tabaco/5 px-3 py-1 text-xs font-semibold text-tabaco">
              {CAPABILITY_TEXT[c]}
            </li>
          ))}
        </ul>
      </section>

      {memberships.length > 1 ? <section aria-labelledby="negocios" className="space-y-3">
        <h2 id="negocios" className="text-2xl text-tabaco">Tus negocios</h2>
        <p className="text-sm leading-6 text-tabaco/75">Al cambiar de negocio, elegirás una sucursal de ese negocio antes de operar.</p>
        <ul className="grid gap-2">{memberships.map((item) => <li key={item.business_id}>
          <form action={selectBusinessAction}>
            <input type="hidden" name="businessId" value={item.business_id} />
            <input type="hidden" name="returnTo" value="/inicio" />
            <button type="submit" disabled={item.business_id === membership.business_id} aria-current={item.business_id === membership.business_id ? "true" : undefined}
              className="flex min-h-14 w-full items-center justify-between rounded-2xl border border-tabaco/15 bg-papel px-5 text-left text-tabaco transition hover:border-blue-400 disabled:cursor-default disabled:border-blue-300 disabled:bg-blue-50">
              <span className="font-semibold">{item.business_name}</span><span className="text-sm">{item.business_id === membership.business_id ? "Actual" : "Cambiar"}</span>
            </button>
          </form>
        </li>)}</ul>
      </section> : null}

      {membership.role === "owner" ? <p><Link href="/negocio/nuevo" className="inline-flex min-h-11 items-center rounded-xl border border-blue-200 bg-blue-50 px-5 text-sm font-bold text-blue-800 hover:bg-blue-100">Agregar otro negocio de prueba →</Link></p> : null}

      <section aria-labelledby="sucursales" className="space-y-3">
        <h2 id="sucursales" className="text-2xl text-tabaco">
          Sucursal de trabajo
        </h2>
        {error ? <Notice tone="error" title="No tienes acceso a esa sucursal. Elige una de la lista." /> : null}
        {!activeBranch && membership.branches.length > 0 ? <div role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 px-5 py-4 text-rose-950 shadow-sm">
          <p className="font-bold">Elige una sucursal para continuar</p>
          <p className="mt-1 text-sm leading-6">Todavía no hay una sucursal activa. Selecciona dónde vas a trabajar y {siguiente ? "te llevaremos a la pantalla que querías abrir" : "podrás usar caja, fidelidad e inventario"}.</p>
        </div> : null}
        {membership.branches.length === 0 ? (
          <Notice tone="info" title="Aún no tienes sucursales asignadas">
            Pide a administración que te asigne al menos una para operar.
          </Notice>
        ) : (
          <ul className="grid gap-2">
            {membership.branches.map((b) => {
              const current = activeBranch?.id === b.id;
              return (
                <li key={b.id}>
                  <form action={selectBranchAction}>
                    <input type="hidden" name="branchId" value={b.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <button
                      type="submit"
                      aria-current={current ? "true" : undefined}
                      className={`flex min-h-14 w-full items-center justify-between rounded-2xl border px-5 text-left ${
                        current ? "border-tabaco bg-tabaco text-crema" : "border-tabaco/15 bg-papel text-tabaco hover:border-tabaco"
                      }`}
                    >
                      <span className="font-display text-xl">{b.name}</span>
                      <span className="text-sm font-semibold">{current ? "Actual" : "Trabajar aquí"}</span>
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {membership.role === "owner" || membership.role === "admin" ? <MfaSetup /> : null}

      <SignOutButton className="btn w-full border border-tabaco/25 text-tabaco hover:border-tabaco" />
    </div>
  );
}
