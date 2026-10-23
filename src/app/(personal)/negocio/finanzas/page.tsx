import type { Metadata } from "next";
import { ExpenseImport, SalesImport } from "@/components/imports/Importers";
import { Notice } from "@/components/staff/OperationParts";
import { formatDate, formatMxn, lastDaysRange } from "@/lib/format";
import { requireCapability } from "@/lib/staff/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DeleteRecordButton, DemoControls, ExpenseForm } from "./FinanceControls";

export const metadata: Metadata = { title: "Ventas y gastos" };

type ImportRow = {
  id: string;
  file_name: string;
  branch_name: string;
  row_count: number;
  total_cents: number;
  period_start: string;
  period_end: string;
  is_demo: boolean;
};
type ExpenseRow = { id: string; spent_on: string; category: string; description: string | null; amount_cents: number; is_demo: boolean; branch_name: string | null };

const day = (d: string) => formatDate(`${d}T12:00:00-06:00`);

export default async function FinancePage() {
  const { membership } = await requireCapability("manage_staff");
  const supabase = await createSupabaseServerClient();
  const [records, branchesRes] = await Promise.all([
    supabase?.rpc("finance_records", { p_business_id: membership.business_id }),
    supabase?.from("branches").select("id, name, is_demo").eq("business_id", membership.business_id).order("name"),
  ]);
  const imports = (records?.data?.ok ? records.data.imports : []) as ImportRow[];
  const expenses = (records?.data?.ok ? records.data.expenses : []) as ExpenseRow[];
  const branches = ((branchesRes?.data ?? []) as { id: string; name: string; is_demo: boolean }[]).filter((b) => !b.is_demo);
  const hasDemo = imports.some((i) => i.is_demo) || expenses.some((e) => e.is_demo);
  const today = lastDaysRange(1).to;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl text-tabaco">Ventas y gastos</h1>
        <p className="mt-2 max-w-2xl leading-7 text-tabaco/75">
          Alimenta el panel con el reporte de ventas de tu punto de venta y tus gastos. Las ventas con tarjeta de fidelidad se registran solas desde la
          barra.
        </p>
      </div>

      <section aria-labelledby="demo" className={`rounded-3xl p-6 ${hasDemo ? "bg-mostaza/25" : "bg-papel"}`}>
        <h2 id="demo" className="text-2xl text-tabaco">
          Datos de demostración
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-tabaco/80">
          {hasDemo
            ? "Hay datos DEMO cargados (ventas, gastos y una sucursal ficticia). Se muestran rotulados en el panel y puedes borrarlos con un clic."
            : "Para presentar el panel sin datos reales, genera 60 días de ventas y gastos de ejemplo con tu catálogo. Quedan marcados como DEMO."}
        </p>
        <div className="mt-4">
          <DemoControls hasDemo={hasDemo} />
        </div>
      </section>

      <SalesImport branches={branches} />

      <section aria-labelledby="historial-ventas">
        <h2 id="historial-ventas" className="text-2xl text-tabaco">
          Reportes importados
        </h2>
        {imports.length === 0 ? (
          <p className="mt-2 text-tabaco/75">Todavía no hay reportes de ventas.</p>
        ) : (
          <ul className="mt-3 divide-y divide-tabaco/10 rounded-3xl bg-papel">
            {imports.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold text-tabaco">
                    {i.file_name}
                    {i.is_demo ? <span className="bitacora ml-2 rounded bg-mostaza px-1.5 py-0.5 text-[0.6rem] text-tabaco">DEMO</span> : null}
                  </p>
                  <p className="text-sm text-tabaco/75">
                    {i.branch_name} · {day(i.period_start)} – {day(i.period_end)} · {i.row_count} renglones · {formatMxn(i.total_cents)}
                  </p>
                </div>
                {!i.is_demo ? <DeleteRecordButton kind="import" id={i.id} label={`el reporte “${i.file_name}”`} /> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="nuevo-gasto" className="rounded-3xl bg-papel p-6">
        <h2 id="nuevo-gasto" className="text-2xl text-tabaco">
          Registrar un gasto
        </h2>
        <div className="mt-4">
          <ExpenseForm branches={branches} today={today} />
        </div>
      </section>

      <ExpenseImport branches={branches} />

      <section aria-labelledby="gastos-recientes">
        <h2 id="gastos-recientes" className="text-2xl text-tabaco">
          Gastos recientes
        </h2>
        {expenses.length === 0 ? (
          <Notice tone="info" title="Aún no hay gastos registrados" />
        ) : (
          <ul className="mt-3 divide-y divide-tabaco/10 rounded-3xl bg-papel">
            {expenses.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold text-tabaco">
                    {e.category}
                    {e.description ? <span className="font-normal text-tabaco/80"> · {e.description}</span> : null}
                    {e.is_demo ? <span className="bitacora ml-2 rounded bg-mostaza px-1.5 py-0.5 text-[0.6rem] text-tabaco">DEMO</span> : null}
                  </p>
                  <p className="text-sm text-tabaco/75">
                    {day(e.spent_on)} · {e.branch_name ?? "General"}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold tabular-nums text-tabaco">{formatMxn(e.amount_cents)}</span>
                  {!e.is_demo ? <DeleteRecordButton kind="expense" id={e.id} label="este gasto" /> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
