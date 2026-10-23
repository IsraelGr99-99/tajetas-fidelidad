"use client";

import Link from "next/link";
import { useState } from "react";
import { type LookupResult, type RedeemResult, lookupCardAction, redeemAction } from "@/app/personal/operaciones";
import { CustomerBadge, Notice, Steps, newIdempotencyKey } from "@/components/staff/OperationParts";
import { QrScanner } from "@/components/staff/QrScanner";
import { formatMxn } from "@/lib/format";

type Card = Extract<LookupResult, { ok: true }>;
type Phase =
  | { name: "scan"; error?: string }
  | { name: "identifying" }
  | { name: "confirm"; payload: string; card: Card; key: string; error?: Extract<RedeemResult, { ok: false }> }
  | { name: "submitting"; payload: string; card: Card; key: string }
  | { name: "done"; card: Card; result: Extract<RedeemResult, { ok: true }> };

/** Canje: QR de canje del cliente (su confirmación) → confirmación del barista → entrega. */
export function RedeemFlow() {
  const [phase, setPhase] = useState<Phase>({ name: "scan" });

  async function onScan(payload: string) {
    setPhase({ name: "identifying" });
    let r: LookupResult;
    try {
      r = await lookupCardAction({ payload });
    } catch {
      return setPhase({ name: "scan", error: "Sin conexión con el servidor. Reintenta." });
    }
    if (!r.ok) return setPhase({ name: "scan", error: r.error });
    if (r.purpose !== "redeem") {
      return setPhase({
        name: "scan",
        error: "Ese es el código normal de la tarjeta. Para canjear, el cliente debe tocar “Canjear mi recompensa” y confirmar en su teléfono.",
      });
    }
    if (r.rewardsBalance < 1) return setPhase({ name: "scan", error: "Esta tarjeta no tiene recompensas disponibles." });
    setPhase({ name: "confirm", payload, card: r, key: newIdempotencyKey("redeem") });
  }

  async function submit() {
    if (phase.name !== "confirm") return;
    const { payload, card, key } = phase;
    setPhase({ name: "submitting", payload, card, key });
    let r: RedeemResult;
    try {
      r = await redeemAction({ payload, idempotencyKey: key });
    } catch {
      r = { ok: false, error: "Sin conexión con el servidor. Puedes reintentar sin riesgo de duplicar.", code: "network" };
    }
    if (r.ok) setPhase({ name: "done", card, result: r });
    else setPhase({ name: "confirm", payload, card, key, error: r });
  }

  const step = phase.name === "scan" || phase.name === "identifying" ? 0 : phase.name === "done" ? 2 : 1;
  const retryable = phase.name === "confirm" && (!phase.error || phase.error.code === "network");

  return (
    <div className="mt-2 space-y-6">
      <Steps steps={["Código de canje", "Confirmar", "Entregar"]} current={step} />

      {phase.name === "scan" || phase.name === "identifying" ? (
        <div className="space-y-4">
          {phase.name === "scan" && phase.error ? <Notice tone="error" title={phase.error} /> : null}
          {phase.name === "identifying" ? <Notice tone="info" title="Verificando el código…" /> : <QrScanner onScan={onScan} label="Escanea el código de canje del cliente" />}
        </div>
      ) : null}

      {phase.name === "confirm" || phase.name === "submitting" ? (
        <div className="space-y-4">
          <CustomerBadge {...phase.card} />
          <Notice tone="info" title="Se canjeará 1 recompensa">
            El cliente confirmó el canje desde su teléfono. Al continuar se descuenta de su tarjeta.
          </Notice>
          {phase.name === "confirm" && phase.error ? <Notice tone="error" title={phase.error.error} /> : null}
          {retryable || phase.name === "submitting" ? (
            <button type="button" onClick={submit} disabled={phase.name === "submitting"} className="btn btn-oscuro w-full disabled:cursor-wait disabled:opacity-70">
              {phase.name === "submitting" ? "Canjeando…" : phase.name === "confirm" && phase.error ? "Reintentar" : "Confirmar canje"}
            </button>
          ) : (
            <button type="button" onClick={() => setPhase({ name: "scan" })} className="btn btn-oscuro w-full">
              Escanear otro código
            </button>
          )}
          <button type="button" onClick={() => setPhase({ name: "scan" })} disabled={phase.name === "submitting"} className="btn w-full border border-tabaco/25 text-tabaco">
            Cancelar
          </button>
        </div>
      ) : null}

      {phase.name === "done" ? (
        <div className="space-y-4">
          <div className="rounded-2xl bg-mostaza p-6 text-tabaco">
            <p className="font-display text-3xl">{phase.result.replayed ? "Este canje ya estaba registrado" : "Canje registrado"}</p>
            <p className="mt-2 text-lg leading-7">
              Entrega: <strong>{(phase.result.rewardDescription ?? "bebida de recompensa").toLowerCase()}</strong>
              {phase.result.rewardValueCapCents !== null ? (
                <>
                  {" "}
                  con valor de hasta <strong>{formatMxn(phase.result.rewardValueCapCents)}</strong>
                </>
              ) : null}
              .
            </p>
            <p className="mt-2 text-sm">
              Le quedan {phase.result.rewardsBalance} recompensa(s) en su tarjeta.
            </p>
          </div>
          <button type="button" onClick={() => setPhase({ name: "scan" })} className="btn btn-oscuro w-full">
            Canjear otra
          </button>
          <Link href="/personal" className="btn w-full border border-tabaco/25 text-tabaco">
            Volver a la consola
          </Link>
        </div>
      ) : null}
    </div>
  );
}
