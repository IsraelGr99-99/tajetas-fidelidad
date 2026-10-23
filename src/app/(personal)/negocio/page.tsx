import type { Metadata } from "next";
import { Notice } from "@/components/staff/OperationParts";
import { rpcErrorMessage } from "@/domain/loyalty/messages";
import { requireCapability } from "@/lib/staff/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Administración" };

type Summary = Record<
  "customers_total" | "customers_new_7d" | "earns_today" | "earns_7d" | "redeems_7d" | "reversals_7d" | "rewards_outstanding" | "staff_active",
  number
>;

export default async function AdminHome() {
  const { membership } = await requireCapability("manage_staff");
  const supabase = await createSupabaseServerClient();
  const { data, error } = (await supabase?.rpc("business_summary", { p_business_id: membership.business_id })) ?? { data: null, error: true };
  const ok = !error && data?.ok;
  const s = (ok ? data : null) as Summary | null;

  const tiles: { label: string; value: number | undefined; hint: string }[] = [
    { label: "Visitas hoy", value: s?.earns_today, hint: "Sellos registrados hoy" },
    { label: "Visitas 7 días", value: s?.earns_7d, hint: "Últimos 7 días" },
    { label: "Canjes 7 días", value: s?.redeems_7d, hint: "Recompensas entregadas" },
    { label: "Clientes", value: s?.customers_total, hint: `${s?.customers_new_7d ?? 0} nuevos en 7 días` },
    { label: "Recompensas pendientes", value: s?.rewards_outstanding, hint: "Ganadas y aún sin canjear" },
    { label: "Reversos 7 días", value: s?.reversals_7d, hint: "Correcciones con motivo" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="bitacora text-arcilla-texto">{membership.business_name}</p>
        <h1 className="mt-2 text-4xl text-tabaco">Resumen</h1>
        <p className="mt-2 max-w-2xl leading-7 text-tabaco/75">
          Cifras calculadas en vivo desde la bitácora. {membership.is_demo ? "Este es un entorno de demostración: los datos pueden ser de prueba." : null}
        </p>
      </div>
      {!ok ? <Notice tone="error" title={rpcErrorMessage(data?.code)} /> : null}
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-3xl bg-papel p-5">
            <dt className="text-sm text-tabaco/75">{t.label}</dt>
            <dd className="mt-1 font-display text-4xl text-tabaco tabular-nums">{t.value ?? "—"}</dd>
            <dd className="mt-1 text-xs text-tabaco/75">{t.hint}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-tabaco/75">Personal activo: {s?.staff_active ?? "—"}.</p>
    </div>
  );
}
