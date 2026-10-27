import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { activeCustomerLabel } from "@/domain/loyalty/customer-display";
import { formatDateTime } from "@/lib/format";
import { requireCapability } from "@/lib/staff/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CustomerSearch } from "./CustomerSearch";

export const metadata: Metadata = { title: "Clientes" };

const PAGE_SIZE = 20;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const { membership } = await requireCapability("view_customers_pii");
  const rawPage = (await searchParams).pagina;
  const page = typeof rawPage === "string" && /^[1-9]\d{0,3}$/.test(rawPage) ? Number(rawPage) : 1;
  const supabase = await createSupabaseServerClient();
  const { data: cards, count, error } = supabase
    ? await supabase.from("loyalty_cards")
      .select("id, public_serial, created_at, last_earn_at, stamps_balance, rewards_balance, customers!inner(display_name, status)", { count: "exact" })
      .eq("business_id", membership.business_id)
      .eq("customers.status", "active")
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    : { data: null, count: null, error: new Error("Supabase no configurado") };
  const total = count ?? 0;
  const { data: disabledAccounts, count: disabledCount, error: disabledError } = supabase
    ? await supabase.from("customers")
      .select("id, display_name, contact_email, contact_phone, disabled_at, closure_category, closure_reason", { count: "exact" })
      .eq("business_id", membership.business_id).eq("status", "disabled")
      .order("disabled_at", { ascending: false }).limit(50)
    : { data: null, count: null, error: new Error("Supabase no configurado") };
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (!error && page > totalPages) redirect(`/negocio/clientes?pagina=${totalPages}`);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl text-tabaco">Clientes</h1>
        <p className="mt-2 max-w-2xl leading-7 text-tabaco/75">
          Encuentra una tarjeta por nombre o por el correo que te indique el cliente. También puedes revisar abajo todas las tarjetas activas.
        </p>
      </div>
      <section aria-labelledby="buscar-cliente" className="workspace-card space-y-4 p-5 sm:p-6">
        <div><p className="workspace-kicker">Acción principal</p><h2 id="buscar-cliente" className="mt-1 text-xl font-semibold text-tabaco">Encontrar un cliente</h2>
          <p className="mt-1 text-sm text-slate-600">Si usas correo, escríbelo completo. La consulta queda registrada, pero no guardamos el dato buscado.</p></div>
        <CustomerSearch />
      </section>
      <section aria-labelledby="padron-title" className="workspace-card p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="workspace-kicker">Programa de fidelidad</p>
            <h2 id="padron-title" className="mt-1 text-xl font-semibold text-tabaco">Clientes con tarjeta activa</h2>
          </div>
          {!error && <p className="text-2xl font-semibold tabular-nums text-tabaco">{total}</p>}
        </div>
        {error ? <p role="alert" className="mt-4 text-sm text-red-700">No se pudo cargar el listado. Actualiza la página para reintentar.</p>
          : cards?.length ? <>
            <ul className="mt-4 divide-y divide-tabaco/10">
              {cards.map((card) => <li key={card.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-semibold text-tabaco">{activeCustomerLabel(card.customers, card.public_serial)}</p>
                  <p className="text-tabaco/70">Alta {formatDateTime(card.created_at)}{card.last_earn_at ? ` · último sello ${formatDateTime(card.last_earn_at)}` : ""}</p>
                </div>
                <p className="text-tabaco/75">{card.stamps_balance} sellos · {card.rewards_balance} recompensas</p>
              </li>)}
            </ul>
            <nav aria-label="Páginas de clientes" className="mt-4 flex items-center justify-between gap-3 border-t border-tabaco/10 pt-4 text-sm">
              {page > 1 ? <Link href={`/negocio/clientes?pagina=${page - 1}`} className="font-semibold text-blue-700">← Anterior</Link> : <span />}
              <span>Página {page} de {totalPages}</span>
              {page < totalPages ? <Link href={`/negocio/clientes?pagina=${page + 1}`} className="font-semibold text-blue-700">Siguiente →</Link> : <span />}
            </nav>
          </> : <p className="mt-4 text-sm text-tabaco/70">Aún no hay tarjetas activas en este negocio.</p>}
      </section>
      <section aria-labelledby="disabled-accounts" className="workspace-card p-5">
        <div className="flex flex-wrap items-end justify-between gap-3"><div>
          <p className="workspace-kicker">Control de cuentas</p>
          <h2 id="disabled-accounts" className="mt-1 text-xl font-semibold text-tabaco">Tarjetas desactivadas</h2>
          <p className="mt-1 text-sm text-slate-600">El cliente puede reactivarla al volver a entrar. Su historial y saldos permanecen guardados.</p>
        </div><span className="text-2xl font-bold tabular-nums text-tabaco">{disabledCount ?? "—"}</span></div>
        {disabledError ? <p role="alert" className="mt-4 text-sm text-red-700">No se pudo cargar este listado. Revisa que la migración de cuentas esté aplicada.</p>
          : disabledAccounts?.length ? <>
            <ul className="mt-4 divide-y divide-tabaco/10">{disabledAccounts.map((customer) => <li key={customer.id} className="py-4 text-sm">
              <p className="font-semibold text-tabaco">{customer.display_name || customer.contact_email || customer.contact_phone || "Cliente"}</p>
              {customer.display_name && (customer.contact_email || customer.contact_phone) ? <p className="text-slate-600">{customer.contact_email || customer.contact_phone}</p> : null}
              <p className="mt-1 text-slate-600">Desactivada {customer.disabled_at ? formatDateTime(customer.disabled_at) : "recientemente"}</p>
              <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-amber-950">Motivo: {customer.closure_reason || customer.closure_category || "No indicado"}</p>
            </li>)}</ul>
            {disabledCount && disabledCount > disabledAccounts.length ? <p className="mt-3 text-sm text-slate-600">Se muestran las 50 desactivaciones más recientes.</p> : null}
          </> : <p className="mt-4 text-sm text-slate-600">No hay tarjetas desactivadas.</p>}
      </section>
    </div>
  );
}
