import type { Metadata } from "next";
import Link from "next/link";
import { DailyBars, RankBars } from "@/components/charts/Charts";
import { Notice } from "@/components/staff/OperationParts";
import { rpcErrorMessage } from "@/domain/loyalty/messages";
import { activeCustomerLabel } from "@/domain/loyalty/customer-display";
import { formatDateTime, formatMxn, lastDaysRange } from "@/lib/format";
import { requireCapability } from "@/lib/staff/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Resumen del negocio" };

const RANGES = [7, 30, 90] as const;

type Dashboard = {
  ok: true;
  has_pos_data: boolean;
  has_demo: boolean;
  totals: {
    pos_sales_cents: number;
    cogs_cents: number;
    cost_coverage: number | null;
    gross_profit_cents: number;
    expenses_cents: number;
    net_profit_cents: number;
    card_sales_cents: number;
    card_visits: number;
    card_share: number | null;
    avg_card_ticket_cents: number | null;
  };
  loyalty: { new_customers: number; redemptions: number; rewards_outstanding: number; rewards_outstanding_value_cents: number };
  by_day: { day: string; pos_sales_cents: number; expenses_cents: number; card_sales_cents: number }[];
  top_products: { name: string; category: string | null; quantity: number; revenue_cents: number; profit_cents: number | null }[];
  by_branch: { id: string; name: string; is_demo: boolean; pos_sales_cents: number; cogs_cents: number; expenses_cents: number; card_visits: number }[];
  by_category: { category: string; revenue_cents: number }[];
  expenses_by_category: { category: string; amount_cents: number }[];
  unallocated_expenses_cents: number;
};

const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)} %`);

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ rango?: string; demo?: string }> }) {
  const { membership } = await requireCapability("manage_staff");
  const params = await searchParams;
  const days = RANGES.find((r) => String(r) === params.rango) ?? 30;
  const includeDemo = params.demo !== "0";
  const { from, to } = lastDaysRange(days);

  const supabase = await createSupabaseServerClient();
  const [res, activeCards] = await Promise.all([
    supabase?.rpc("finance_dashboard", { p_business_id: membership.business_id, p_from: from, p_to: to, p_include_demo: includeDemo }),
    supabase?.from("loyalty_cards")
      .select("id, public_serial, created_at, customers!inner(display_name, status)", { count: "exact" })
      .eq("business_id", membership.business_id)
      .eq("customers.status", "active")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  const d = (res?.data?.ok ? res.data : null) as Dashboard | null;
  const activeCardRows = activeCards?.error ? null : activeCards?.data ?? null;
  const href = (r: number, demo: boolean) => `/negocio?rango=${r}${demo ? "" : "&demo=0"}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="workspace-kicker">Control del negocio · {membership.business_name}</p>
          <h1 className="mt-1 text-3xl text-slate-950 sm:text-4xl">Resumen del negocio</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">Revisa el desempeño y sigue cada operación desde su módulo correspondiente.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Periodo" className="flex gap-1 rounded-full bg-tabaco/5 p-1">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={href(r, includeDemo)}
                aria-current={r === days ? "page" : undefined}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${r === days ? "bg-papel text-tabaco shadow" : "text-tabaco/75"}`}
              >
                {r} días
              </Link>
            ))}
          </nav>
          {d?.has_demo ? (
            <Link href={href(days, !includeDemo)} className="rounded-full border border-tabaco/20 px-3 py-1.5 text-sm font-semibold text-tabaco">
              {includeDemo ? "Ocultar DEMO" : "Mostrar DEMO"}
            </Link>
          ) : null}
        </div>
      </div>

      <nav aria-label="Acciones de administración" className="grid gap-3 sm:grid-cols-3">
        <Link href="/negocio/ventas" className="workspace-card group p-4 hover:border-blue-300"><span className="workspace-kicker">Caja</span><strong className="mt-2 block text-slate-950 group-hover:text-blue-700">Ventas y empleados →</strong><span className="mt-1 block text-xs text-slate-600">Operaciones registradas en esta caja.</span></Link>
        <Link href="/negocio/inventario" className="workspace-card group p-4 hover:border-blue-300"><span className="workspace-kicker">Inventario</span><strong className="mt-2 block text-slate-950 group-hover:text-blue-700">Existencias y alertas →</strong><span className="mt-1 block text-xs text-slate-600">Revisa mínimos, insumos y recetas.</span></Link>
        <Link href="/negocio/finanzas" className="workspace-card group p-4 hover:border-blue-300"><span className="workspace-kicker">Reportes</span><strong className="mt-2 block text-slate-950 group-hover:text-blue-700">Importaciones y gastos →</strong><span className="mt-1 block text-xs text-slate-600">Carga reportes del POS externo y gastos.</span></Link>
      </nav>

      <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-950"><strong>Cómo leer este panel:</strong> los indicadores “POS” vienen de reportes externos importados. Las ventas registradas en la caja de Loyalty aparecen en “Ventas y empleados”. No se suman automáticamente aquí ni deben interpretarse como la misma fuente.</p>

      {!d ? <Notice tone="error" title={rpcErrorMessage(res?.data?.code)} /> : null}

      <section aria-labelledby="clientes-activos" className="workspace-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="workspace-kicker">Fidelidad · total histórico</p>
            <h2 id="clientes-activos" className="mt-1 text-2xl font-semibold text-slate-950">Clientes con tarjeta activa</h2>
            <p className="mt-1 text-sm text-slate-600">Solo clientes vigentes de {membership.business_name}; no depende del periodo de ventas.</p>
          </div>
          <Link href="/negocio/clientes" className="btn border border-tabaco/20 px-4 text-tabaco">Ver todos →</Link>
        </div>
        {activeCardRows === null ? (
          <p role="alert" className="mt-4 text-sm text-red-700">No se pudo consultar el padrón de fidelidad. Intenta actualizar la página.</p>
        ) : (
          <div className="mt-4 grid gap-5 sm:grid-cols-[9rem_1fr]">
            <p className="font-display text-5xl tabular-nums text-slate-950" aria-label={`${activeCards?.count ?? 0} clientes con tarjeta activa`}>{activeCards?.count ?? 0}</p>
            {activeCardRows.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {activeCardRows.map((card) => (
                  <li key={card.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span className="block font-semibold text-slate-950">{activeCustomerLabel(card.customers, card.public_serial)}</span>
                    <span>Alta {formatDateTime(card.created_at)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-600">Aún no hay clientes con tarjeta activa.</p>}
          </div>
        )}
      </section>

      {d && d.has_demo && includeDemo ? (
        <p className="rounded-2xl bg-mostaza/30 px-4 py-3 text-sm text-tabaco">
          <strong>Incluye datos DEMO</strong> (ventas, gastos y la sucursal “Angelópolis (DEMO)” son ficticios). Bórralos en{" "}
          <Link href="/negocio/finanzas" className="font-semibold underline underline-offset-4">
            Ventas y gastos
          </Link>
          .
        </p>
      ) : null}

      {d && !d.has_pos_data ? (
        <Notice tone="info" title="Aún no hay ventas del punto de venta en este periodo">
          Importa tu reporte en{" "}
          <Link href="/negocio/finanzas" className="font-semibold underline underline-offset-4">
            Ventas y gastos
          </Link>{" "}
          o genera datos DEMO para ver el panel completo. Las cifras de fidelidad sí son reales.
        </Notice>
      ) : null}

      {d ? (
        <>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Kpi label="Ventas importadas (POS)" value={formatMxn(d.totals.pos_sales_cents)} hint={`Reporte externo · últimos ${days} días`} strong />
            <Kpi
              label="Ganancia bruta"
              value={formatMxn(d.totals.gross_profit_cents)}
              hint={d.totals.cost_coverage === null ? "Sin ventas" : `Costo conocido en ${pct(d.totals.cost_coverage)} de las ventas`}
            />
            <Kpi label="Gastos" value={formatMxn(d.totals.expenses_cents)} hint="Registrados e importados" />
            <Kpi
              label="Utilidad neta"
              value={formatMxn(d.totals.net_profit_cents)}
              hint={d.totals.net_profit_cents < 0 ? "Pérdida en el periodo" : "Ventas − costo − gastos"}
              tone={d.totals.net_profit_cents < 0 ? "negative" : "neutral"}
            />
            <Kpi
              label="Ventas con tarjeta"
              value={formatMxn(d.totals.card_sales_cents)}
              hint={`${d.totals.card_visits} visitas${d.totals.card_share !== null ? ` · ${pct(d.totals.card_share)} del POS` : ""}`}
            />
            <Kpi
              label="Recompensas pendientes"
              value={String(d.loyalty.rewards_outstanding)}
              hint={`Valor máximo ${formatMxn(d.loyalty.rewards_outstanding_value_cents)}`}
            />
          </dl>

          <section aria-labelledby="ventas-dia" className="rounded-3xl bg-papel p-6">
            <h2 id="ventas-dia" className="text-2xl text-tabaco">
              Ventas por día
            </h2>
            <p className="text-sm text-tabaco/75">Reporte del punto de venta. Pasa el cursor sobre una barra para ver el monto.</p>
            <div className="mt-4">
              <DailyBars
                title="Ventas por día"
                points={d.by_day.map((x) => ({ day: x.day, value: x.pos_sales_cents }))}
                emptyText="Sin ventas importadas en este periodo."
              />
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-labelledby="top" className="rounded-3xl bg-papel p-6">
              <h2 id="top" className="text-2xl text-tabaco">
                Lo más vendido
              </h2>
              <div className="mt-4">
                <RankBars
                  emptyText="Sin ventas en este periodo."
                  items={d.top_products.map((p) => ({
                    label: p.name,
                    value: p.revenue_cents,
                    note: `${Number(p.quantity).toLocaleString("es-MX")} vendidos${p.profit_cents !== null ? ` · ganancia ${formatMxn(p.profit_cents)}` : " · sin costo"}`,
                  }))}
                />
              </div>
            </section>

            <section aria-labelledby="sucursales-rank" className="rounded-3xl bg-papel p-6">
              <h2 id="sucursales-rank" className="text-2xl text-tabaco">
                Ventas por sucursal
              </h2>
              <div className="mt-4">
                <RankBars
                  emptyText="Sin ventas por sucursal en este periodo."
                  items={d.by_branch.map((b) => ({
                    label: b.name,
                    value: b.pos_sales_cents,
                    tag: b.is_demo ? "DEMO" : undefined,
                    note: `Utilidad ${formatMxn(b.pos_sales_cents - b.cogs_cents - b.expenses_cents)} · ${b.card_visits} visitas con tarjeta`,
                  }))}
                />
                {d.unallocated_expenses_cents > 0 ? (
                  <p className="mt-3 text-xs text-tabaco/75">Gastos generales sin sucursal: {formatMxn(d.unallocated_expenses_cents)} (no incluidos arriba).</p>
                ) : null}
              </div>
            </section>

            <section aria-labelledby="categorias" className="rounded-3xl bg-papel p-6">
              <h2 id="categorias" className="text-2xl text-tabaco">
                Ventas por categoría
              </h2>
              <div className="mt-4">
                <RankBars emptyText="Sin ventas en este periodo." items={d.by_category.map((c) => ({ label: c.category, value: c.revenue_cents }))} />
              </div>
            </section>

            <section aria-labelledby="gastos-cat" className="rounded-3xl bg-papel p-6">
              <h2 id="gastos-cat" className="text-2xl text-tabaco">
                Gastos por categoría
              </h2>
              <div className="mt-4">
                <RankBars emptyText="Sin gastos en este periodo." items={d.expenses_by_category.map((c) => ({ label: c.category, value: c.amount_cents }))} />
              </div>
            </section>
          </div>

          <section aria-labelledby="fidelidad" className="rounded-3xl bg-tabaco p-6 text-crema">
            <h2 id="fidelidad" className="text-2xl">
              Programa de fidelidad
            </h2>
            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Mini label="Clientes nuevos" value={String(d.loyalty.new_customers)} />
              <Mini label="Visitas con tarjeta" value={String(d.totals.card_visits)} />
              <Mini label="Canjes" value={String(d.loyalty.redemptions)} />
              <Mini label="Ticket promedio" value={d.totals.avg_card_ticket_cents === null ? "—" : formatMxn(d.totals.avg_card_ticket_cents)} />
            </dl>
          </section>
        </>
      ) : null}
    </div>
  );
}

function Kpi({ label, value, hint, strong, tone = "neutral" }: { label: string; value: string; hint: string; strong?: boolean; tone?: "neutral" | "negative" }) {
  return (
    <div className={`rounded-3xl p-5 ${strong ? "bg-tabaco text-crema" : "bg-papel text-tabaco"}`}>
      <dt className={`text-sm ${strong ? "text-crema/80" : "text-tabaco/75"}`}>{label}</dt>
      <dd className={`mt-1 font-display text-3xl tabular-nums ${tone === "negative" ? "text-alerta" : ""}`}>{value}</dd>
      <dd className={`mt-1 text-xs ${strong ? "text-crema/75" : "text-tabaco/75"}`}>{hint}</dd>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-crema/75">{label}</dt>
      <dd className="font-display text-3xl tabular-nums">{value}</dd>
    </div>
  );
}
