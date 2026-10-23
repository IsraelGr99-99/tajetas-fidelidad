"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { type EarnResult, type LookupResult, lookupCardAction, recordEarnAction } from "@/app/personal/operaciones";
import { CustomerBadge, Notice, Steps, newIdempotencyKey } from "@/components/staff/OperationParts";
import { QrScanner } from "@/components/staff/QrScanner";
import { formatMxn } from "@/lib/format";
import type { CatalogProduct } from "@/lib/staff/catalog";

type Line = { quantity: number; complimentary: boolean };
type Card = Extract<LookupResult, { ok: true }>;
type Phase =
  | { name: "ticket" }
  | { name: "scan"; error?: string }
  | { name: "identifying" }
  | { name: "confirm"; payload: string; card: Card; key: string; error?: Extract<EarnResult, { ok: false }> }
  | { name: "submitting"; payload: string; card: Card; key: string }
  | { name: "done"; card: Card; result: Extract<EarnResult, { ok: true }> };

const STEPS = ["Ticket", "Código del cliente", "Confirmar"];
const RESCAN_CODES = new Set(["token_invalid"]);
const FINAL_CODES = new Set(["duplicate_purchase", "too_soon", "daily_limit", "not_eligible", "card_inactive", "card_not_found", "idempotency_conflict"]);

/**
 * Registrar visita: 1) folio y productos del ticket, 2) QR del cliente (al final,
 * para que no caduque mientras se captura), 3) confirmación explícita.
 */
export function VisitFlow({ catalog }: { catalog: CatalogProduct[] }) {
  const [phase, setPhase] = useState<Phase>({ name: "ticket" });
  const [folio, setFolio] = useState("");
  const [lines, setLines] = useState<Record<string, Line>>({});
  const [ticketError, setTicketError] = useState<string | null>(null);

  const selected = useMemo(
    () => catalog.filter((p) => lines[p.id]?.quantity).map((p) => ({ product: p, ...lines[p.id] })),
    [catalog, lines],
  );
  const eligibleUnits = selected.filter((s) => s.product.eligible && !s.complimentary && s.product.priceCents > 0).reduce((n, s) => n + s.quantity, 0);
  const byCategory = useMemo(() => {
    const groups = new Map<string, CatalogProduct[]>();
    for (const p of catalog) groups.set(p.category, [...(groups.get(p.category) ?? []), p]);
    return [...groups.entries()];
  }, [catalog]);

  function setQuantity(id: string, quantity: number) {
    setLines((prev) => {
      const next = { ...prev };
      if (quantity <= 0) delete next[id];
      else next[id] = { quantity: Math.min(quantity, 20), complimentary: prev[id]?.complimentary ?? false };
      return next;
    });
  }

  function reset() {
    setFolio("");
    setLines({});
    setTicketError(null);
    setPhase({ name: "ticket" });
  }

  function goToScan() {
    if (!folio.trim()) return setTicketError("Escribe el folio impreso en el ticket.");
    if (selected.length === 0) return setTicketError("Agrega los productos del ticket.");
    setTicketError(null);
    setPhase({ name: "scan" });
  }

  async function onScan(payload: string) {
    setPhase({ name: "identifying" });
    let r: LookupResult;
    try {
      r = await lookupCardAction({ payload });
    } catch {
      return setPhase({ name: "scan", error: "Sin conexión con el servidor. Reintenta." });
    }
    if (!r.ok) return setPhase({ name: "scan", error: r.error });
    if (r.purpose === "redeem") {
      return setPhase({ name: "scan", error: "Ese es un código de canje. Para sumar sellos, pide al cliente su código normal (“Mostrar mi código”)." });
    }
    setPhase({ name: "confirm", payload, card: r, key: newIdempotencyKey("earn") });
  }

  async function submit() {
    if (phase.name !== "confirm") return;
    const { payload, card, key } = phase;
    setPhase({ name: "submitting", payload, card, key });
    let r: EarnResult;
    try {
      r = await recordEarnAction({
        payload,
        folio,
        idempotencyKey: key,
        items: selected.map((s) => ({ productId: s.product.id, quantity: s.quantity, complimentary: s.complimentary })),
      });
    } catch {
      r = { ok: false, error: "Sin conexión con el servidor. Puedes reintentar sin riesgo de duplicar.", code: "network" };
    }
    if (r.ok) setPhase({ name: "done", card, result: r });
    else setPhase({ name: "confirm", payload, card, key, error: r });
  }

  const stepIndex = phase.name === "ticket" ? 0 : phase.name === "scan" || phase.name === "identifying" ? 1 : 2;

  if (catalog.length === 0) {
    return (
      <div className="mt-8">
        <Notice tone="info" title="No hay productos en el catálogo">
          Administración debe dar de alta los productos antes de registrar visitas.
        </Notice>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-6">
      {phase.name !== "done" ? <Steps steps={STEPS} current={stepIndex} /> : null}

      {phase.name === "ticket" ? (
        <div className="space-y-6">
          <div>
            <label htmlFor="folio" className="block text-sm font-semibold text-tabaco">
              Folio del ticket
            </label>
            <input
              id="folio"
              value={folio}
              onChange={(e) => setFolio(e.target.value)}
              autoComplete="off"
              inputMode="text"
              maxLength={40}
              placeholder="Ej. A-10234"
              className="mt-2 block min-h-12 w-full rounded-xl border border-tabaco/25 bg-papel px-4 font-mono text-lg uppercase text-tinta outline-none placeholder:normal-case placeholder:text-tabaco/45 focus:border-tabaco focus-visible:outline-3 focus-visible:outline-mostaza"
            />
            <p className="mt-2 text-sm text-tabaco/75">Un ticket solo puede sumar un sello, aunque se intente registrar dos veces.</p>
          </div>

          <fieldset>
            <legend className="text-sm font-semibold text-tabaco">Productos del ticket</legend>
            <div className="mt-3 space-y-5">
              {byCategory.map(([category, products]) => (
                <div key={category}>
                  <p className="bitacora text-arcilla-texto">{category}</p>
                  <ul className="mt-2 divide-y divide-tabaco/10 rounded-2xl bg-papel">
                    {products.map((p) => {
                      const line = lines[p.id];
                      return (
                        <li key={p.id} className="px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-tabaco">{p.name}</p>
                              <p className="text-sm text-tabaco/75">
                                {formatMxn(p.priceCents)} · {p.eligible ? "suma sello" : "no suma sello"}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2" role="group" aria-label={`Cantidad de ${p.name}`}>
                              <button
                                type="button"
                                onClick={() => setQuantity(p.id, (line?.quantity ?? 0) - 1)}
                                disabled={!line}
                                aria-label={`Quitar un ${p.name}`}
                                className="grid h-11 w-11 place-items-center rounded-full border border-tabaco/25 text-xl text-tabaco disabled:opacity-40"
                              >
                                −
                              </button>
                              <span className="w-6 text-center font-semibold tabular-nums" aria-live="polite">
                                {line?.quantity ?? 0}
                              </span>
                              <button
                                type="button"
                                onClick={() => setQuantity(p.id, (line?.quantity ?? 0) + 1)}
                                aria-label={`Agregar un ${p.name}`}
                                className="grid h-11 w-11 place-items-center rounded-full bg-tabaco text-xl text-crema"
                              >
                                +
                              </button>
                            </div>
                          </div>
                          {line ? (
                            <label className="mt-2 flex items-center gap-2 text-sm text-tabaco/80">
                              <input
                                type="checkbox"
                                checked={line.complimentary}
                                onChange={(e) => setLines((prev) => ({ ...prev, [p.id]: { ...line, complimentary: e.target.checked } }))}
                                className="h-5 w-5 accent-[#3d2c24]"
                              />
                              Fue cortesía o bebida gratis (no suma)
                            </label>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </fieldset>

          <div className="sticky bottom-3 space-y-3 rounded-2xl bg-crema/95 p-1 backdrop-blur">
            {ticketError ? <Notice tone="error" title={ticketError} /> : null}
            {selected.length > 0 && eligibleUnits === 0 ? (
              <Notice tone="info" title="Este ticket no suma sello">
                Ningún producto elegible pagado. Puedes continuar, pero el servidor lo rechazará.
              </Notice>
            ) : null}
            <button type="button" onClick={goToScan} className="btn btn-oscuro w-full">
              Continuar: escanear al cliente
            </button>
          </div>
        </div>
      ) : null}

      {phase.name === "scan" || phase.name === "identifying" ? (
        <div className="space-y-4">
          {phase.name === "scan" && phase.error ? <Notice tone="error" title={phase.error} /> : null}
          {phase.name === "identifying" ? (
            <Notice tone="info" title="Verificando el código…" />
          ) : (
            <QrScanner onScan={onScan} />
          )}
          <button type="button" onClick={() => setPhase({ name: "ticket" })} className="btn w-full border border-tabaco/25 text-tabaco">
            Volver al ticket
          </button>
        </div>
      ) : null}

      {phase.name === "confirm" || phase.name === "submitting" ? (
        <div className="space-y-4">
          <CustomerBadge {...phase.card} />
          <div className="rounded-2xl border border-tabaco/15 p-5">
            <p className="text-sm text-tabaco/75">Ticket</p>
            <p className="font-mono text-lg text-tabaco">{folio.trim().toUpperCase()}</p>
            <ul className="mt-3 space-y-1 text-tabaco">
              {selected.map((s) => (
                <li key={s.product.id} className="flex justify-between gap-3">
                  <span>
                    {s.quantity} × {s.product.name}
                    {s.complimentary ? " (cortesía)" : ""}
                  </span>
                  <span className="text-tabaco/75">{s.complimentary ? "—" : formatMxn(s.product.priceCents * s.quantity)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-dashed border-tabaco/25 pt-3 font-semibold text-tabaco">
              {eligibleUnits > 0 ? "Se sumará 1 sello a esta tarjeta." : "Esta compra no suma sello."}
            </p>
          </div>

          {phase.name === "confirm" && phase.error ? (
            <Notice tone="error" title={phase.error.error}>
              {phase.error.code === "network" ? "Si se cortó la conexión, reintenta: no se duplicará el sello." : null}
            </Notice>
          ) : null}

          {phase.name === "confirm" && phase.error && RESCAN_CODES.has(phase.error.code ?? "") ? (
            <button type="button" onClick={() => setPhase({ name: "scan" })} className="btn btn-oscuro w-full">
              Escanear el código de nuevo
            </button>
          ) : phase.name === "confirm" && phase.error && FINAL_CODES.has(phase.error.code ?? "") ? (
            <button type="button" onClick={reset} className="btn btn-oscuro w-full">
              Empezar otra visita
            </button>
          ) : (
            <button type="button" onClick={submit} disabled={phase.name === "submitting"} className="btn btn-oscuro w-full disabled:cursor-wait disabled:opacity-70">
              {phase.name === "submitting" ? "Registrando…" : phase.name === "confirm" && phase.error ? "Reintentar" : "Confirmar y sumar sello"}
            </button>
          )}
          <button type="button" onClick={reset} disabled={phase.name === "submitting"} className="btn w-full border border-tabaco/25 text-tabaco">
            Cancelar
          </button>
        </div>
      ) : null}

      {phase.name === "done" ? (
        <div className="space-y-4 pt-4">
          <Notice tone="success" title={phase.result.replayed ? "Esta visita ya estaba registrada" : "Sello registrado"}>
            {phase.result.stampsBalance} de {phase.result.stampsRequired} sellos
            {phase.result.rewardsBalance > 0 ? ` · ${phase.result.rewardsBalance} recompensa(s) disponible(s)` : ""}
          </Notice>
          {phase.result.rewardsIssued > 0 ? (
            <div className="rounded-2xl bg-mostaza p-5 text-tabaco">
              <p className="font-display text-2xl">¡Completó su tarjeta!</p>
              <p className="mt-1 leading-6">Ya tiene una bebida de recompensa. Puede canjearla hoy o en su próxima visita.</p>
            </div>
          ) : null}
          <button type="button" onClick={reset} className="btn btn-oscuro w-full">
            Registrar otra visita
          </button>
          <Link href="/personal" className="btn w-full border border-tabaco/25 text-tabaco">
            Volver a la consola
          </Link>
        </div>
      ) : null}
    </div>
  );
}
