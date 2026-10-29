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
type OperationsDashboard = {
  ok: true;
  week_start: string;
  weekly_sales_cents: number;
  weekly_sales_count: number;
  low_stock_count: number;
  missing_stock_count: number;
  products_without_recipe: number;
  recent_events: { kind: "sale" | "stock"; label: string; created_at: string; amount_cents: number | null; quantity_delta: number | null }[];
};

const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)} %`);

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ rango?: string; demo?: string }> }) {
  const { membership, activeBranch } = await requireCapability("manage_staff");
  const params = await searchParams;
  const days = RANGES.find((r) => String(r) === params.rango) ?? 30;
  const includeDemo = params.demo !== "0";
  const { from, to } = lastDaysRange(days);

  const supabase = await createSupabaseServerClient();
  const [res, activeCards, operationsResult] = await Promise.all([
    supabase?.rpc("finance_dashboard", { p_business_id: membership.business_id, p_from: from, p_to: to, p_include_demo: includeDemo }),
    supabase?.from("loyalty_cards")
      .select("id, public_serial, created_at, customers!inner(display_name, status)", { count: "exact" })
      .eq("business_id", membership.business_id)
      .eq("customers.status", "active")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase?.rpc("operations_dashboard", { p_business_id: membership.business_id, p_branch_id: activeBranch?.id ?? null }),
  ]);
  const d = (res?.data?.ok ? res.data : null) as Dashboard | null;
  const operations = (operationsResult?.data?.ok ? operationsResult.data : null) as OperationsDashboard | null;
  const activeCardRows = activeCards?.error ? null : activeCards?.data ?? null;
  const activeBranchReport = d?.by_branch.find((branch) => branch.id === activeBranch?.id);
  const href = (r: number, demo: boolean) => `/negocio?rango=${r}${demo ? "" : "&demo=0"}`;

  const activeCount = activeCards?.count ?? 0;
  const branchMax = Math.max(0, ...(d?.by_branch.map((b) => b.pos_sales_cents) ?? []));

  return (
    <div className="space-y-6">
      {/* Encabezado: título, periodo y accesos */}
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          <p className="workspace-kicker">Resumen · {membership.business_name}</p>
          <h1 className="mt-1.5 text-3xl font-extrabold tracking-[-0.045em] text-slate-950 sm:text-[2.6rem] sm:leading-[1.05]">Resumen del negocio</h1>
          <p className="mt-2 max-w-2xl text-[0.95rem] text-slate-600">Así va {membership.business_name} en los últimos {days} días.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Periodo de los reportes" className="flex gap-1 rounded-full border border-slate-200/80 bg-white/80 p-1 shadow-[0_6px_16px_-12px_rgb(11_18_32/.4)]">
            {RANGES.map((r) => <Link key={r} href={href(r, includeDemo)} aria-current={r === days ? "page" : undefined} className={`inline-flex min-h-9 items-center rounded-full px-3.5 text-sm font-semibold transition ${r === days ? "bg-slate-950 text-white" : "text-slate-600 hover:text-slate-950"}`}>{r} días</Link>)}
          </nav>
          {d?.has_demo && <Link href={href(days, !includeDemo)} className="inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-white/80 px-4 text-sm font-semibold text-slate-700 hover:border-slate-300">{includeDemo ? "Ocultar DEMO" : "Mostrar DEMO"}</Link>}
        </div>
      </header>

      <nav aria-label="Acciones de administración" className="flex flex-wrap gap-2">
        <QuickLink href="/negocio/ventas" icon="cart" label="Ventas y empleados" />
        <QuickLink href="/negocio/inventario" icon="box" label="Existencias y alertas" />
        <QuickLink href="/negocio/finanzas" icon="doc" label="Importaciones y gastos" />
      </nav>

      {/* Fuentes de las cifras: un aviso compacto en lugar de varios párrafos */}
      <details className="group rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-1 text-sm text-slate-600">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-semibold text-slate-800 [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="grid h-6 w-6 place-items-center rounded-full bg-[#2949da]/10 text-xs font-bold text-[#2949da]">i</span>
          ¿De dónde salen estas cifras?
          {d?.has_demo && includeDemo ? <span className="rounded-full bg-[#7c5cff]/10 px-2.5 py-0.5 text-xs font-bold text-[#5b3fd6]">Incluye reportes ficticios</span> : null}
          <span aria-hidden="true" className="ml-auto text-slate-400 transition group-open:rotate-180">⌄</span>
        </summary>
        <ul className="mb-3 mt-1 space-y-1.5 border-t border-slate-100 pt-3 leading-6">
          <li><strong className="text-slate-800">Ventas, gastos y gráficas</strong> usan los reportes importados del punto de venta externo y los gastos registrados, según el periodo elegido.</li>
          <li><strong className="text-slate-800">Esta semana</strong> muestra las ventas de la caja de Loyalty desde el lunes. No se suman a los reportes importados para evitar duplicados.</li>
          <li><strong className="text-slate-800">Clientes con tarjeta</strong> es el total histórico de clientes vigentes; no depende del periodo.</li>
          {d?.has_demo && includeDemo ? <li><strong className="text-slate-800">Reportes ficticios:</strong> las ventas importadas y los gastos de este entorno ilustran cómo se vería un negocio en operación; no son transacciones reales. Puedes ocultarlos con «Ocultar DEMO».</li> : null}
        </ul>
      </details>

      {!d ? <Notice tone="error" title={rpcErrorMessage(res?.data?.code)} /> : null}

      {d && !d.has_pos_data ? (
        <Notice tone="info" title="Aún no hay ventas del punto de venta en este periodo">
          Importa tu reporte en{" "}
          <Link href="/negocio/finanzas" className="font-semibold underline underline-offset-4">
            Ventas y gastos
          </Link>{" "}
          o genera datos DEMO para ver el panel completo. Las cifras de fidelidad sí son reales.
        </Notice>
      ) : null}

      {/* Cifras clave del periodo */}
      {d ? (
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Ventas importadas (POS)" value={formatMxn(d.totals.pos_sales_cents)} hint={`Reporte externo · últimos ${days} días`} strong />
          <Kpi label="Ganancia bruta" value={formatMxn(d.totals.gross_profit_cents)} hint={d.totals.cost_coverage === null ? "Sin ventas" : `Costo conocido en ${pct(d.totals.cost_coverage)} de las ventas`} />
          <Kpi label="Gastos" value={formatMxn(d.totals.expenses_cents)} hint="Registrados e importados" />
          <Kpi
            label="Utilidad neta"
            value={formatMxn(d.totals.net_profit_cents)}
            hint={d.totals.net_profit_cents < 0 ? "Pérdida en el periodo" : "Ventas − costo − gastos"}
            tone={d.totals.net_profit_cents < 0 ? "negative" : "positive"}
          />
        </dl>
      ) : null}

      {/* Tendencia y productos */}
      {d ? (
        <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
          <section aria-labelledby="ventas-dia" className="workspace-card p-5 sm:p-6 lg:col-span-2">
            <PanelHead id="ventas-dia" kicker={`Últimos ${days} días`} title="Ventas por día" text="Reporte del punto de venta. Pasa el cursor o el foco sobre una barra para ver el monto." />
            <div className="mt-5">
              <DailyBars title="Ventas por día" points={d.by_day.map((x) => ({ day: x.day, value: x.pos_sales_cents }))} emptyText="Sin ventas importadas en este periodo." />
            </div>
          </section>
          <section aria-labelledby="top" className="workspace-card p-5 sm:p-6">
            <PanelHead id="top" kicker={`Últimos ${days} días`} title="Lo más vendido" />
            <div className="mt-5">
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
        </div>
      ) : null}

      {/* Sucursales */}
      <section id="comparar-sucursales" aria-labelledby="comparar-title" className="workspace-card scroll-mt-24 p-5 sm:p-6">
        <PanelHead id="comparar-title" kicker={`Últimos ${days} días`} title="Comparar sucursales" text="Reportes importados y gastos asignados a cada local. Los gastos generales sin sucursal quedan fuera." />
        {activeBranch && <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-[#2949da]/15 bg-[#2949da]/[0.04] px-4 py-3 text-sm text-slate-700">
          <strong className="text-slate-950">Tu sucursal activa: {activeBranch.name}.</strong>
          <span>Ventas importadas: <b className="tabular-nums text-slate-950">{formatMxn(activeBranchReport?.pos_sales_cents ?? 0)}</b></span>
          <span>Gastos: <b className="tabular-nums text-slate-950">{formatMxn(activeBranchReport?.expenses_cents ?? 0)}</b></span>
          <span>Resultado estimado: <b className="tabular-nums text-slate-950">{formatMxn((activeBranchReport?.pos_sales_cents ?? 0) - (activeBranchReport?.cogs_cents ?? 0) - (activeBranchReport?.expenses_cents ?? 0))}</b></span>
        </p>}
        {d?.by_branch.length ? <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Ventas, gastos, resultado estimado y visitas con tarjeta por sucursal</caption>
            <thead className="text-xs uppercase tracking-wider text-slate-500"><tr>
              <th scope="col" className="px-3 pb-2 font-bold">Sucursal</th>
              <th scope="col" className="px-3 pb-2 text-right font-bold">Ventas importadas</th>
              <th scope="col" className="px-3 pb-2 text-right font-bold">Gastos</th>
              <th scope="col" className="px-3 pb-2 text-right font-bold">Resultado estimado</th>
              <th scope="col" className="px-3 pb-2 text-right font-bold">Visitas con tarjeta</th>
            </tr></thead>
            <tbody>{d.by_branch.map((branch) => {
              const result = branch.pos_sales_cents - branch.cogs_cents - branch.expenses_cents;
              const active = branch.id === activeBranch?.id;
              return <tr key={branch.id} className={`border-t border-slate-100 ${active ? "bg-[#2949da]/[0.04]" : ""}`}>
                <th scope="row" className="px-3 py-3 font-semibold text-slate-900">
                  {branch.name}
                  {branch.is_demo ? <span className="ml-2 rounded-full bg-[#7c5cff]/10 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-[#5b3fd6]">DEMO</span> : null}
                  {active ? <span className="ml-2 rounded-full bg-[#2949da]/10 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-[#2949da]">Activa</span> : null}
                </th>
                <td className="px-3 py-3 text-right">
                  <span className="font-semibold tabular-nums text-slate-950">{formatMxn(branch.pos_sales_cents)}</span>
                  <span aria-hidden="true" className="ml-auto mt-1.5 block h-1.5 w-28 rounded-full bg-slate-100"><span className="block h-full rounded-full bg-gradient-to-r from-[#2949da] to-[#7c5cff]" style={{ width: `${branchMax ? Math.max(3, (branch.pos_sales_cents / branchMax) * 100) : 0}%` }} /></span>
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-700">{formatMxn(branch.expenses_cents)}</td>
                <td className={`px-3 py-3 text-right font-semibold tabular-nums ${result < 0 ? "text-red-700" : "text-emerald-700"}`}>{formatMxn(result)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-700">{branch.card_visits}</td>
              </tr>;
            })}</tbody>
          </table>
        </div> : <EmptyState text="Aún no hay datos de sucursales para comparar." action={{ href: "/negocio/finanzas", label: "Importar un reporte" }} />}
        <p className="mt-3 text-xs text-slate-500">Resultado estimado = ventas importadas − costos conocidos − gastos asignados. Si faltan costos, la ganancia real puede ser menor.</p>
        {d && d.unallocated_expenses_cents > 0 ? <p className="mt-1 text-xs text-slate-500">Gastos generales sin sucursal: {formatMxn(d.unallocated_expenses_cents)} (no incluidos en la tabla).</p> : null}
      </section>

      {/* Operación de la semana */}
      <section id="operacion-semana" aria-labelledby="operacion-semana-title" className="workspace-card scroll-mt-24 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <PanelHead id="operacion-semana-title" kicker={`Desde el lunes · ${activeBranch?.name ?? "todas las sucursales"}`} title="Esta semana en la operación" text="Ventas registradas en la caja de Loyalty y pendientes de inventario. No incluye reportes importados." />
          <Link href="/negocio/inventario" className="inline-flex min-h-10 items-center text-sm font-semibold text-[#2949da] hover:underline">Abrir inventario →</Link>
        </div>
        {!operations ? <p role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">No se pudo cargar el tablero operativo. Revisa la conexión y la migración del tablero.</p> : <>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Ventas de caja esta semana" value={formatMxn(Number(operations.weekly_sales_cents))} note={`${operations.weekly_sales_count} venta(s)`} tone="blue" />
            <Stat label="Insumos en mínimo" value={String(operations.low_stock_count)} note={operations.low_stock_count ? "Revisa y reabastece" : "Todo en orden"} tone={operations.low_stock_count ? "amber" : "green"} />
            <Stat label="Insumos sin conteo" value={String(operations.missing_stock_count)} note={operations.missing_stock_count ? "Registra su existencia" : "Todo en orden"} tone={operations.missing_stock_count ? "amber" : "green"} />
            <Stat label="Productos sin receta" value={String(operations.products_without_recipe)} note={operations.products_without_recipe ? "No descuentan inventario" : "Todo en orden"} tone={operations.products_without_recipe ? "amber" : "green"} />
          </dl>
          <div className="mt-6 border-t border-slate-100 pt-5">
            <h3 className="text-base font-bold text-slate-950">Registros recientes</h3>
            {operations.recent_events.length ? <ul className="mt-2 divide-y divide-slate-100">{operations.recent_events.map((event, index) => <li key={`${event.kind}-${event.created_at}-${index}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <span className="flex items-center gap-2.5 font-medium text-slate-800">
                <span aria-hidden="true" className={`h-2 w-2 rounded-full ${event.kind === "sale" ? "bg-[#2949da]" : "bg-[#7c5cff]"}`} />
                {event.kind === "sale" ? `Venta · ${event.label}` : `Inventario · ${event.label}`}
              </span>
              <span className="tabular-nums text-slate-500">{event.kind === "sale" && event.amount_cents !== null ? formatMxn(event.amount_cents) : `${event.quantity_delta && event.quantity_delta > 0 ? "+" : ""}${event.quantity_delta ?? 0}`} · {formatDateTime(event.created_at)}</span>
            </li>)}</ul>
              : <EmptyState text="Aún no hay ventas ni movimientos de stock esta semana." action={{ href: "/caja", label: "Registrar una venta en Caja" }} />}
          </div>
        </>}
      </section>

      {/* Fidelidad */}
      <section id="clientes-activos" aria-labelledby="clientes-activos-title" className="workspace-card scroll-mt-24 overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <PanelHead id="clientes-activos-title" kicker="Fidelidad · total histórico" title="Clientes con tarjeta activa" text={`Clientes vigentes de ${membership.business_name}; no depende del periodo.`} />
              <Link href="/negocio/clientes" className="workspace-action-secondary min-h-10 px-4">Ver todos →</Link>
            </div>
            {activeCardRows === null ? (
              <p role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">No se pudo consultar el padrón de fidelidad. Intenta actualizar la página.</p>
            ) : (
              <div className="mt-5">
                <p className="text-5xl font-extrabold tracking-[-0.04em] tabular-nums text-slate-950" aria-label={`${activeCount} clientes con tarjeta activa`}>{activeCount}</p>
                {activeCardRows.length ? (
                  <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                    {activeCardRows.map((card) => (
                      <li key={card.id} className="rounded-2xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-600">
                        <span className="block font-semibold text-slate-950">{activeCustomerLabel(card.customers, card.public_serial)}</span>
                        <span>Alta {formatDateTime(card.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                ) : <EmptyState text="Aún no hay clientes con tarjeta activa. Comparte el QR de tu programa para que se registren." action={{ href: "/negocio/programa", label: "Ir a Programa" }} />}
              </div>
            )}
          </div>
          {d ? <div className="border-t border-slate-100 bg-gradient-to-br from-[#2a1f6b] via-[#3b2ea8] to-[#5b3fd6] p-5 text-white sm:p-6 lg:border-l lg:border-t-0">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-white/70">Programa de fidelidad · últimos {days} días</p>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
              <Mini label="Clientes nuevos" value={String(d.loyalty.new_customers)} />
              <Mini label="Visitas con tarjeta" value={String(d.totals.card_visits)} />
              <Mini label="Canjes" value={String(d.loyalty.redemptions)} />
              <Mini label="Ticket promedio" value={d.totals.avg_card_ticket_cents === null ? "—" : formatMxn(d.totals.avg_card_ticket_cents)} />
              <Mini label="Ventas con tarjeta" value={formatMxn(d.totals.card_sales_cents)} note={d.totals.card_share !== null ? `${pct(d.totals.card_share)} del POS` : undefined} />
              <Mini label="Recompensas pendientes" value={String(d.loyalty.rewards_outstanding)} note={`Valor máximo ${formatMxn(d.loyalty.rewards_outstanding_value_cents)}`} />
            </dl>
          </div> : null}
        </div>
      </section>

      {/* Categorías */}
      {d ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="categorias" className="workspace-card p-5 sm:p-6">
            <PanelHead id="categorias" kicker={`Últimos ${days} días`} title="Ventas por categoría" />
            <div className="mt-5"><RankBars emptyText="Sin ventas en este periodo." items={d.by_category.map((c) => ({ label: c.category, value: c.revenue_cents }))} /></div>
          </section>
          <section aria-labelledby="gastos-cat" className="workspace-card p-5 sm:p-6">
            <PanelHead id="gastos-cat" kicker={`Últimos ${days} días`} title="Gastos por categoría" />
            <div className="mt-5"><RankBars emptyText="Sin gastos en este periodo." items={d.expenses_by_category.map((c) => ({ label: c.category, value: c.amount_cents }))} /></div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function PanelHead({ id, kicker, title, text }: { id: string; kicker: string; title: string; text?: string }) {
  return (
    <div className="min-w-0">
      <p className="workspace-kicker">{kicker}</p>
      <h2 id={id} className="mt-1 text-xl font-bold tracking-[-0.03em] text-slate-950 sm:text-2xl">{title}</h2>
      {text ? <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{text}</p> : null}
    </div>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: "cart" | "box" | "doc"; label: string }) {
  return (
    <Link href={href} className="group inline-flex min-h-11 items-center gap-2.5 rounded-full border border-slate-200/80 bg-white/80 py-1.5 pl-1.5 pr-4 text-sm font-semibold text-slate-800 shadow-[0_6px_16px_-12px_rgb(11_18_32/.4)] transition hover:-translate-y-px hover:border-slate-300 hover:bg-white">
      <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-600 transition group-hover:bg-[#2949da] group-hover:text-white">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {icon === "cart" && <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 14h3M8 17h7" /></>}
          {icon === "box" && <path d="m3 7 9-4 9 4-9 4-9-4ZM3 7v10l9 4 9-4V7M12 11v10" />}
          {icon === "doc" && <path d="M4 4h16v16H4zM7 9h10M7 13h10M7 17h6" />}
        </svg>
      </span>
      {label}
      <span aria-hidden="true" className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[#2949da]">→</span>
    </Link>
  );
}

function EmptyState({ text, action }: { text: string; action?: { href: string; label: string } }) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-4 text-sm text-slate-600">
      <p>{text}</p>
      {action ? <Link href={action.href} className="inline-flex min-h-10 items-center rounded-full bg-white px-4 font-semibold text-[#2949da] shadow-sm ring-1 ring-slate-200 hover:ring-[#2949da]/40">{action.label} →</Link> : null}
    </div>
  );
}

function Kpi({ label, value, hint, strong, tone = "neutral" }: { label: string; value: string; hint: string; strong?: boolean; tone?: "neutral" | "positive" | "negative" }) {
  return (
    <div className={`rounded-[1.5rem] p-5 ${strong ? "bg-slate-950 bg-[radial-gradient(circle_at_100%_0%,rgb(41_73_218/.55),transparent_60%)] text-white shadow-[0_24px_48px_-28px_rgb(11_18_32/.8)]" : "workspace-card"}`}>
      <dt className={`text-sm font-semibold ${strong ? "text-white/70" : "text-slate-500"}`}>{label}</dt>
      <dd className={`mt-2 text-[1.65rem] font-extrabold tracking-[-0.04em] tabular-nums sm:text-3xl ${tone === "negative" ? "text-red-700" : strong ? "text-white" : "text-slate-950"}`}>{value}</dd>
      <dd className={`mt-1 text-xs ${strong ? "text-white/65" : tone === "positive" ? "text-emerald-700" : "text-slate-500"}`}>{hint}</dd>
    </div>
  );
}

function Stat({ label, value, note, tone }: { label: string; value: string; note: string; tone: "blue" | "amber" | "green" }) {
  const tones = {
    blue: "border-[#2949da]/15 bg-[#2949da]/[0.05] [&_dd]:text-slate-950 [&_.dot]:bg-[#2949da]",
    amber: "border-amber-200 bg-amber-50 [&_dd]:text-amber-950 [&_.dot]:bg-amber-500",
    green: "border-emerald-100 bg-emerald-50/60 [&_dd]:text-slate-950 [&_.dot]:bg-emerald-500",
  } as const;
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <dt className="flex items-center gap-2 text-sm font-semibold text-slate-700"><span aria-hidden="true" className="dot h-2 w-2 rounded-full" />{label}</dt>
      <dd className="mt-2 text-2xl font-extrabold tracking-[-0.03em] tabular-nums">{value}</dd>
      <dd className="mt-0.5 text-xs !text-slate-600">{note}</dd>
    </div>
  );
}

function Mini({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-white/70">{label}</dt>
      <dd className="mt-1 text-2xl font-extrabold tracking-[-0.03em] tabular-nums">{value}</dd>
      {note ? <dd className="mt-0.5 text-[0.7rem] text-white/60">{note}</dd> : null}
    </div>
  );
}
