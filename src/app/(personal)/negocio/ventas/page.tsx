import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { formatMxn } from "@/lib/format";
import { requireCapability } from "@/lib/staff/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ventas por empleado" };
const schema = z.object({ ok: z.literal(true),
  sales: z.array(z.object({ id: z.uuid(), branch_id: z.uuid(), staff_id: z.uuid(), staff_name: z.string(), total_cents: z.number(), payment_method: z.string(), created_at: z.string() })),
  by_staff: z.array(z.object({ staff_id: z.uuid(), staff_name: z.string(), sales_count: z.number(), total_cents: z.number() })),
});
const payment: Record<string, string> = { cash: "Efectivo", card_manual: "Tarjeta externa", transfer_manual: "Transferencia externa" };

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ sucursal?: string }> }) {
  const { membership } = await requireCapability("manage_staff");
  const requested = (await searchParams).sucursal;
  const branchId = membership.branches.find((b) => b.id === requested)?.id ?? null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <p>Ventas no configuradas: conecta Supabase.</p>;
  const { data, error } = await supabase.rpc("pos_sales_report", { p_business_id: membership.business_id, p_branch_id: branchId });
  if (error) return <p>Ventas de caja no disponibles. Aplica la migración de caja e inventario.</p>;
  const parsed = schema.safeParse(data);
  if (!parsed.success) return <p>No se pudo leer el reporte de ventas.</p>;
  const { sales, by_staff } = parsed.data;
  const total = by_staff.reduce((sum, row) => sum + row.total_cents, 0);
  return <div className="space-y-7">
    <header><p className="bitacora text-tabaco/60">Últimos 30 días · {membership.branches.find((b) => b.id === branchId)?.name ?? "todas las sucursales"}</p><h1 className="font-display text-4xl text-tabaco">Ventas de caja por empleado</h1>
      <p className="mt-2 text-sm text-tabaco/75">Solo incluye ventas registradas en esta caja. No suma archivos importados del POS ni acreditaciones de fidelidad.</p></header>
    <nav aria-label="Filtrar ventas por sucursal" className="flex flex-wrap gap-2 text-sm"><Link href="/negocio/ventas" aria-current={!branchId ? "page" : undefined} className="rounded-full border border-tabaco/20 px-4 py-2">Todas</Link>
      {membership.branches.map((b) => <Link key={b.id} href={`/negocio/ventas?sucursal=${b.id}`} aria-current={branchId === b.id ? "page" : undefined} className="rounded-full border border-tabaco/20 px-4 py-2">{b.name}</Link>)}</nav>
    <section className="rounded-3xl bg-tabaco p-6 text-crema"><p className="text-sm text-crema/70">Total registrado en 30 días</p><p className="font-display text-4xl">{formatMxn(total)}</p></section>
    <section className="rounded-3xl bg-papel p-5"><h2 className="text-xl font-semibold text-tabaco">Por empleado</h2>
      {by_staff.length === 0 ? <p className="mt-3 text-sm text-tabaco/70">Aún no hay ventas registradas.</p> : <ul className="mt-4 space-y-2">{by_staff.map((r) => <li key={r.staff_id} className="flex justify-between gap-3 rounded-xl bg-white p-3 text-sm"><span>{r.staff_name} · {r.sales_count} ventas</span><strong>{formatMxn(r.total_cents)}</strong></li>)}</ul>}</section>
    <section className="rounded-3xl bg-white p-5"><h2 className="text-xl font-semibold text-tabaco">Ventas recientes</h2>
      <ul className="mt-4 space-y-2">{sales.map((s) => <li key={s.id} className="flex flex-wrap justify-between gap-2 border-b border-tabaco/10 py-2 text-sm"><span>{new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" }).format(new Date(s.created_at))} · {s.staff_name} · {membership.branches.find((b) => b.id === s.branch_id)?.name ?? "Sucursal"}</span><span>{payment[s.payment_method] ?? s.payment_method} · <strong>{formatMxn(s.total_cents)}</strong></span></li>)}</ul>
    </section>
  </div>;
}
