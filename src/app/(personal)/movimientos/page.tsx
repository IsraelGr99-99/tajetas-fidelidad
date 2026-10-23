import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Notice } from "@/components/staff/OperationParts";
import { rpcErrorMessage } from "@/domain/loyalty/messages";
import { can } from "@/domain/staff/permissions";
import { NO_ACCESS_PATH } from "@/domain/staff/routes";
import { formatDateTime, formatMxn } from "@/lib/format";
import { LEDGER_PAGE_SIZE, type LedgerRow, getLedger } from "@/lib/staff/ledger";
import { requireStaffWithBranch } from "@/lib/staff/session";
import { ReverseButton } from "./ReverseButton";

export const metadata: Metadata = { title: "Movimientos" };

const TYPE_LABEL: Record<LedgerRow["event_type"], string> = {
  earn: "Sello",
  reward_issued: "Recompensa emitida",
  redeem: "Canje",
  reverse: "Reverso",
  manual_adjustment: "Ajuste manual",
};

const SOURCE_LABEL: Record<string, string> = {
  staff_qr: "QR",
  staff_nfc: "QR + sello NFC",
  staff_lookup: "Búsqueda (sin QR)",
  admin_console: "Consola",
  system: "Automático",
};

export default async function LedgerPage({ searchParams }: { searchParams: Promise<{ antes?: string; todas?: string }> }) {
  const { membership, activeBranch } = await requireStaffWithBranch();
  if (!can(membership.role, "view_branch_ledger")) redirect(NO_ACCESS_PATH);
  const params = await searchParams;
  const isAdmin = can(membership.role, "adjust_stamps");
  const allBranches = isAdmin && params.todas === "1";
  const before = params.antes && !Number.isNaN(Date.parse(params.antes)) ? new Date(params.antes).toISOString() : null;

  const result = await getLedger(membership.business_id, allBranches ? null : activeBranch.id, before);
  const events = result.ok ? result.events : [];
  const last = events.at(-1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="bitacora text-arcilla-texto">{allBranches ? "Todas las sucursales" : activeBranch.name}</p>
          <h1 className="mt-2 text-4xl text-tabaco">Movimientos</h1>
          <p className="mt-2 max-w-2xl leading-7 text-tabaco/75">
            Cada sello, canje y corrección con quién lo hizo. Para corregir un error se registra un reverso con motivo; nada se borra.
          </p>
        </div>
        {isAdmin ? (
          <Link href={allBranches ? "/movimientos" : "/movimientos?todas=1"} className="text-sm font-semibold underline underline-offset-4">
            {allBranches ? `Ver solo ${activeBranch.name}` : "Ver todas las sucursales"}
          </Link>
        ) : null}
      </div>

      {!result.ok ? <Notice tone="error" title={rpcErrorMessage(result.code)} /> : null}

      {result.ok && events.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-tabaco/25 bg-papel p-8 text-center">
          <p className="font-display text-2xl text-tabaco">{before ? "No hay movimientos anteriores." : "Todavía no hay movimientos."}</p>
          <p className="mt-2 text-tabaco/75">Aparecerán aquí en cuanto se registre la primera visita.</p>
        </div>
      ) : null}

      {events.length > 0 ? (
        <ol className="divide-y divide-tabaco/10 overflow-hidden rounded-3xl bg-papel">
          {events.map((e) => (
            <li key={e.id} className={`p-5 ${e.reversed ? "bg-tabaco/[0.03]" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-tabaco">
                    {TYPE_LABEL[e.event_type]}
                    <span className="ml-2 font-normal text-tabaco/75">{delta(e)}</span>
                    {e.reversed ? (
                      <span className="bitacora ml-2 rounded border border-tabaco/30 px-1.5 py-0.5 text-[0.6rem] text-tabaco/75">Revertido</span>
                    ) : null}
                  </p>
                  <p className="text-sm text-tabaco/80">
                    {e.customer_label}
                    {e.customer_contact_masked ? ` · ${e.customer_contact_masked}` : ""}
                  </p>
                  <p className="text-sm text-tabaco/75">
                    {[
                      e.actor_name ? `Por ${e.actor_name}` : null,
                      SOURCE_LABEL[e.source] ?? null,
                      allBranches && e.branch_name ? e.branch_name : null,
                      e.purchase_total_cents !== null ? `Ticket ${formatMxn(e.purchase_total_cents)}` : null,
                      e.reward_value_cap_cents !== null && e.event_type === "redeem" ? `Tope ${formatMxn(e.reward_value_cap_cents)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {e.reason ? <p className="mt-1 text-sm italic text-tabaco/80">Motivo: {e.reason}</p> : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <time dateTime={e.occurred_at} className="text-sm text-tabaco/75">
                    {formatDateTime(e.occurred_at)}
                  </time>
                  {e.reversible && can(membership.role, "reverse") ? <ReverseButton eventId={e.id} eventType={e.event_type} /> : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {events.length === LEDGER_PAGE_SIZE && last ? (
        <Link
          href={`/movimientos?antes=${encodeURIComponent(last.occurred_at)}${allBranches ? "&todas=1" : ""}`}
          className="btn w-full border border-tabaco/25 text-tabaco"
        >
          Ver movimientos anteriores
        </Link>
      ) : null}
    </div>
  );
}

function delta(e: LedgerRow) {
  const parts = [];
  if (e.stamps_delta) parts.push(`${e.stamps_delta > 0 ? "+" : ""}${e.stamps_delta} sello${Math.abs(e.stamps_delta) === 1 ? "" : "s"}`);
  if (e.rewards_delta) parts.push(`${e.rewards_delta > 0 ? "+" : ""}${e.rewards_delta} recompensa`);
  return parts.join(", ");
}
