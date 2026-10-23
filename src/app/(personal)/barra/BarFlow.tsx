"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type ClaimResult, type EarnResult, type RedeemResult, claimCardAction, recordEarnAction, redeemAction, releaseHoldAction } from "@/actions/bar";
import { Notice, newIdempotencyKey } from "@/components/staff/OperationParts";
import { QrScanner } from "@/components/staff/QrScanner";
import { formatMxn } from "@/lib/format";
import type { CatalogProduct } from "@/lib/staff/catalog";

type Claim = Extract<ClaimResult, { ok: true }>;
type Line = { quantity: number; complimentary: boolean };
type Phase =
  | { name: "scan"; error?: string }
  | { name: "claiming" }
  | { name: "visit"; claim: Claim; key: string; submitting?: boolean; error?: Extract<EarnResult, { ok: false }> }
  | { name: "redeem"; claim: Claim; key: string; submitting?: boolean; error?: Extract<RedeemResult, { ok: false }> }
  | { name: "done_earn"; claim: Claim; result: Extract<EarnResult, { ok: true }>; at: number }
  | { name: "done_redeem"; claim: Claim; result: Extract<RedeemResult, { ok: true }>; at: number };

const QUICK_COUNT = 6;
const AUTO_NEXT_SECONDS = 8;
/** Errores definitivos: no tiene sentido reintentar con el mismo apartado. */
const FINAL = new Set(["duplicate_purchase", "too_soon", "daily_limit", "card_inactive", "card_not_found", "idempotency_conflict", "token_invalid", "no_reward_available"]);

/**
 * Pantalla única de barra. El QR decide el flujo:
 *  - código normal  → visita: folio + productos → confirmar sello
 *  - código de canje → confirmar entrega de la recompensa
 * Al terminar vuelve sola a la cámara para el siguiente cliente.
 */
export function BarFlow({
  catalog,
  branchName,
  initialClaim,
}: {
  catalog: CatalogProduct[];
  branchName: string;
  /** Solo para vistas previas y pruebas: arranca con una tarjeta ya apartada (el servidor valida el apartado igual). */
  initialClaim?: Claim;
}) {
  const [phase, setPhase] = useState<Phase>(() =>
    initialClaim
      ? initialClaim.purpose === "redeem"
        ? { name: "redeem", claim: initialClaim, key: "preview-redeem-key" }
        : { name: "visit", claim: initialClaim, key: "preview-earn-key" }
      : { name: "scan" },
  );
  const [folio, setFolio] = useState("");
  const [lines, setLines] = useState<Record<string, Line>>({});
  const [now, setNow] = useState(() => Date.now());

  const resetTicket = () => {
    setFolio("");
    setLines({});
  };
  const next = useCallback(() => {
    resetTicket();
    setPhase({ name: "scan" });
  }, []);

  // Reloj para el apartado y el regreso automático.
  useEffect(() => {
    if (phase.name === "scan" || phase.name === "claiming") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [phase.name]);

  async function onScan(payload: string) {
    setPhase({ name: "claiming" });
    let r: ClaimResult;
    try {
      r = await claimCardAction({ payload });
    } catch {
      return setPhase({ name: "scan", error: "Sin conexión con el servidor. Vuelve a escanear." });
    }
    if (!r.ok) return setPhase({ name: "scan", error: r.error });
    setNow(Date.now());
    resetTicket();
    setPhase(r.purpose === "redeem" ? { name: "redeem", claim: r, key: newIdempotencyKey("redeem") } : { name: "visit", claim: r, key: newIdempotencyKey("earn") });
  }

  async function cancel(claim: Claim) {
    void releaseHoldAction({ hold: claim.hold }).catch(() => undefined);
    next();
  }

  // ----- Visita -----
  const selected = useMemo(() => catalog.filter((p) => lines[p.id]?.quantity).map((p) => ({ product: p, ...lines[p.id] })), [catalog, lines]);
  const eligibleUnits = selected.filter((s) => s.product.eligible && !s.complimentary && s.product.priceCents > 0).reduce((n, s) => n + s.quantity, 0);
  const total = selected.filter((s) => !s.complimentary).reduce((n, s) => n + s.product.priceCents * s.quantity, 0);
  const quick = catalog.filter((p) => p.eligible).slice(0, QUICK_COUNT);
  const others = catalog.filter((p) => !quick.includes(p));

  function add(id: string, delta: number) {
    setLines((prev) => {
      const q = Math.max(0, Math.min(20, (prev[id]?.quantity ?? 0) + delta));
      const copy = { ...prev };
      if (q === 0) delete copy[id];
      else copy[id] = { quantity: q, complimentary: prev[id]?.complimentary ?? false };
      return copy;
    });
  }

  async function submitEarn() {
    if (phase.name !== "visit") return;
    const { claim, key } = phase;
    setPhase({ ...phase, submitting: true, error: undefined });
    let r: EarnResult;
    try {
      r = await recordEarnAction({
        hold: claim.hold,
        folio,
        idempotencyKey: key,
        items: selected.map((s) => ({ productId: s.product.id, quantity: s.quantity, complimentary: s.complimentary })),
      });
    } catch {
      r = { ok: false, error: "Sin conexión. Reintenta: no se duplicará el sello.", code: "network" };
    }
    if (r.ok) {
      const at = Date.now();
      setNow(at);
      setPhase({ name: "done_earn", claim, result: r, at });
    } else setPhase({ name: "visit", claim, key, error: r });
  }

  async function submitRedeem() {
    if (phase.name !== "redeem") return;
    const { claim, key } = phase;
    setPhase({ ...phase, submitting: true, error: undefined });
    let r: RedeemResult;
    try {
      r = await redeemAction({ hold: claim.hold, idempotencyKey: key });
    } catch {
      r = { ok: false, error: "Sin conexión. Reintenta: no se duplicará el canje.", code: "network" };
    }
    if (r.ok) {
      const at = Date.now();
      setNow(at);
      setPhase({ name: "done_redeem", claim, result: r, at });
    } else setPhase({ name: "redeem", claim, key, error: r });
  }

  // ----- Regreso automático tras éxito -----
  const doneAt = phase.name === "done_earn" || phase.name === "done_redeem" ? phase.at : null;
  const autoLeft = doneAt ? Math.max(0, AUTO_NEXT_SECONDS - Math.floor((now - doneAt) / 1000)) : 0;
  useEffect(() => {
    if (!doneAt) return;
    const t = setTimeout(next, AUTO_NEXT_SECONDS * 1000);
    return () => clearTimeout(t);
  }, [doneAt, next]);

  const holdLeft = "claim" in phase ? Math.max(0, Math.floor((Date.parse(phase.claim.holdExpiresAt) - now) / 1000)) : 0;
  const holdExpired = (phase.name === "visit" || phase.name === "redeem") && holdLeft === 0;

  // ================= Render =================
  if (phase.name === "scan" || phase.name === "claiming") {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <header className="text-center">
          <h1 className="text-3xl text-tabaco sm:text-4xl">Escanea al cliente</h1>
          <p className="mt-1 text-tabaco/75">Visita o canje se detectan solos · {branchName}</p>
        </header>
        {phase.name === "scan" && phase.error ? <Notice tone="error" title={phase.error} /> : null}
        {phase.name === "claiming" ? (
          <div role="status" className="grid aspect-square place-items-center rounded-3xl bg-tabaco text-crema">
            Verificando tarjeta…
          </div>
        ) : (
          <QrScanner onScan={onScan} label="Apunta al código del teléfono del cliente" />
        )}
        {catalog.length === 0 ? (
          <Notice tone="info" title="El catálogo está vacío">
            Administración debe agregar productos en Negocio → Catálogo para registrar visitas.
          </Notice>
        ) : null}
      </div>
    );
  }

  const claim = phase.claim;
  const customer = (
    <div className="rounded-3xl bg-tabaco p-5 text-crema">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-2xl">{claim.displayName ?? "Cliente"}</p>
          {claim.contactMasked ? <p className="text-sm text-crema/75">{claim.contactMasked}</p> : null}
        </div>
        {phase.name === "visit" || phase.name === "redeem" ? (
          <p className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${holdLeft < 60 ? "bg-mostaza text-tabaco" : "bg-crema/10"}`} aria-live="polite">
            Apartada {Math.floor(holdLeft / 60)}:{String(holdLeft % 60).padStart(2, "0")}
          </p>
        ) : null}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-crema/15" aria-hidden="true">
          <div className="h-full rounded-full bg-mostaza" style={{ width: `${Math.min(100, (claim.stampsBalance / claim.stampsRequired) * 100)}%` }} />
        </div>
        <p className="shrink-0 text-sm font-semibold">
          {claim.stampsBalance} de {claim.stampsRequired}
          {claim.rewardsBalance > 0 ? ` · ${claim.rewardsBalance} recompensa${claim.rewardsBalance === 1 ? "" : "s"}` : ""}
        </p>
      </div>
    </div>
  );

  if (phase.name === "done_earn" || phase.name === "done_redeem") {
    const earn = phase.name === "done_earn" ? phase.result : null;
    const redeem = phase.name === "done_redeem" ? phase.result : null;
    return (
      <div className="mx-auto max-w-md space-y-4" role="status">
        <div className="rounded-3xl bg-exito p-6 text-center text-crema">
          <p className="text-5xl" aria-hidden="true">
            ✓
          </p>
          <p className="mt-2 font-display text-3xl">
            {earn ? (earn.replayed ? "Ya estaba registrada" : "Sello registrado") : redeem?.replayed ? "Canje ya registrado" : "Canje registrado"}
          </p>
          <p className="mt-1 text-crema/90">
            {claim.displayName ?? "Cliente"} ·{" "}
            {earn ? `${earn.stampsBalance} de ${earn.stampsRequired} sellos` : `le quedan ${redeem?.rewardsBalance ?? 0} recompensa(s)`}
          </p>
        </div>
        {earn && earn.rewardsIssued > 0 ? (
          <div className="rounded-3xl bg-mostaza p-5 text-tabaco">
            <p className="font-display text-2xl">¡Completó su tarjeta!</p>
            <p className="mt-1">Ya tiene una bebida de recompensa para canjear cuando quiera.</p>
          </div>
        ) : null}
        {redeem ? (
          <div className="rounded-3xl bg-papel p-5 text-tabaco">
            <p className="text-sm text-tabaco/75">Entrega</p>
            <p className="font-display text-2xl">{redeem.rewardDescription ?? claim.rewardDescription ?? "Bebida de recompensa"}</p>
            {redeem.rewardValueCapCents !== null ? <p className="mt-1">Valor máximo: {formatMxn(redeem.rewardValueCapCents)}</p> : null}
          </div>
        ) : null}
        <button type="button" onClick={next} className="btn btn-oscuro w-full">
          Siguiente cliente ({autoLeft} s)
        </button>
      </div>
    );
  }

  if (phase.name === "redeem") {
    const final = phase.error && FINAL.has(phase.error.code ?? "");
    return (
      <div className="mx-auto max-w-md space-y-4">
        {customer}
        <div className="rounded-3xl bg-mostaza p-6 text-tabaco">
          <p className="bitacora">Canje confirmado por el cliente</p>
          <p className="mt-2 font-display text-3xl">{claim.rewardDescription ?? "Bebida de recompensa"}</p>
          <p className="mt-2 leading-6">Al confirmar se descuenta 1 recompensa de su tarjeta.</p>
        </div>
        {phase.error ? <Notice tone="error" title={phase.error.error} /> : null}
        {holdExpired ? <Notice tone="error" title="El apartado venció. Pide al cliente un código nuevo." /> : null}
        {final || holdExpired ? (
          <button type="button" onClick={next} className="btn btn-oscuro w-full">
            Escanear de nuevo
          </button>
        ) : (
          <button type="button" onClick={submitRedeem} disabled={phase.submitting} className="btn btn-oscuro min-h-14 w-full text-lg disabled:opacity-70">
            {phase.submitting ? "Canjeando…" : phase.error ? "Reintentar canje" : "Entregar recompensa"}
          </button>
        )}
        <button type="button" onClick={() => cancel(claim)} disabled={phase.submitting} className="w-full py-2 text-sm text-tabaco/80 underline underline-offset-4">
          Cancelar
        </button>
      </div>
    );
  }

  // Visita
  const final = phase.error && FINAL.has(phase.error.code ?? "");
  const ready = folio.trim().length > 0 && selected.length > 0 && eligibleUnits > 0;
  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-40">
      {customer}

      <div>
        <label htmlFor="folio" className="block text-sm font-semibold text-tabaco">
          Folio del ticket
        </label>
        <input
          id="folio"
          value={folio}
          onChange={(e) => setFolio(e.target.value)}
          autoFocus
          autoComplete="off"
          maxLength={40}
          placeholder="Ej. A-10234"
          className="mt-2 block min-h-14 w-full rounded-2xl border border-tabaco/25 bg-papel px-4 font-mono text-xl uppercase text-tinta outline-none placeholder:normal-case placeholder:text-tabaco/45 focus:border-tabaco focus-visible:outline-3 focus-visible:outline-mostaza"
        />
      </div>

      <section aria-labelledby="mas-vendidos">
        <h2 id="mas-vendidos" className="font-sans text-sm font-semibold tracking-normal text-tabaco">
          ¿Qué compró? <span className="font-normal text-tabaco/75">Toca para agregar</span>
        </h2>
        <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {quick.map((p) => {
            const q = lines[p.id]?.quantity ?? 0;
            return (
              <li key={p.id} className="relative">
                <button
                  type="button"
                  onClick={() => add(p.id, 1)}
                  aria-label={`Agregar ${p.name}${q ? `, llevas ${q}` : ""}`}
                  className={`flex min-h-20 w-full flex-col items-start justify-between rounded-2xl border p-3 text-left transition ${
                    q ? "border-tabaco bg-tabaco text-crema" : "border-tabaco/15 bg-papel text-tabaco hover:border-tabaco"
                  }`}
                >
                  <span className="font-semibold leading-tight">{p.name}</span>
                  <span className={`text-sm ${q ? "text-crema/80" : "text-tabaco/75"}`}>{formatMxn(p.priceCents)}</span>
                </button>
                {q ? (
                  <span className="pointer-events-none absolute right-2 top-2 grid h-7 min-w-7 place-items-center rounded-full bg-mostaza px-2 text-sm font-bold text-tabaco">
                    {q}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>

        {others.length > 0 ? (
          <details className="mt-3 rounded-2xl border border-tabaco/10 bg-papel">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-tabaco">Otros productos ({others.length})</summary>
            <ul className="divide-y divide-tabaco/10">
              {others.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2">
                  <span className="text-tabaco">
                    {p.name}
                    <span className="block text-xs text-tabaco/75">
                      {formatMxn(p.priceCents)} · {p.eligible ? "suma sello" : "no suma"}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <button type="button" onClick={() => add(p.id, -1)} disabled={!lines[p.id]} aria-label={`Quitar ${p.name}`} className="grid h-10 w-10 place-items-center rounded-full border border-tabaco/25 disabled:opacity-40">
                      −
                    </button>
                    <span className="w-5 text-center tabular-nums">{lines[p.id]?.quantity ?? 0}</span>
                    <button type="button" onClick={() => add(p.id, 1)} aria-label={`Agregar ${p.name}`} className="grid h-10 w-10 place-items-center rounded-full bg-tabaco text-crema">
                      +
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      {selected.length > 0 ? (
        <section aria-labelledby="ticket" className="rounded-2xl border border-tabaco/15 bg-papel p-4">
          <h2 id="ticket" className="font-sans text-sm font-semibold tracking-normal text-tabaco">
            Ticket
          </h2>
          <ul className="mt-2 space-y-2">
            {selected.map((s) => (
              <li key={s.product.id} className="flex flex-wrap items-center justify-between gap-2 text-tabaco">
                <span className="flex items-center gap-2">
                  <button type="button" onClick={() => add(s.product.id, -1)} aria-label={`Quitar un ${s.product.name}`} className="grid h-8 w-8 place-items-center rounded-full border border-tabaco/25 text-sm">
                    −
                  </button>
                  {s.quantity} × {s.product.name}
                </span>
                <label className="flex items-center gap-2 text-xs text-tabaco/80">
                  <input
                    type="checkbox"
                    checked={s.complimentary}
                    onChange={(e) => setLines((prev) => ({ ...prev, [s.product.id]: { ...prev[s.product.id], complimentary: e.target.checked } }))}
                    className="h-4 w-4 accent-[#3d2c24]"
                  />
                  Cortesía
                </label>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Confirmación visible y fija antes de acreditar */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-tabaco/10 bg-crema/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-64">
        <div className="mx-auto max-w-2xl space-y-2">
          {phase.error ? <Notice tone="error" title={phase.error.error} /> : null}
          {holdExpired ? <Notice tone="error" title="El apartado venció. Escanea de nuevo el código del cliente." /> : null}
          <p className="text-sm text-tabaco" aria-live="polite">
            {selected.length === 0
              ? "Agrega lo que compró."
              : eligibleUnits === 0
                ? "Este ticket no suma sello (sin bebidas elegibles pagadas)."
                : `Total ${formatMxn(total)} · se sumará 1 sello (${claim.stampsBalance} → ${Math.min(claim.stampsBalance + 1, claim.stampsRequired)} de ${claim.stampsRequired})`}
            {!folio.trim() && selected.length > 0 ? " · falta el folio" : ""}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => cancel(claim)} disabled={phase.submitting} className="btn border border-tabaco/25 px-4 text-tabaco">
              Cancelar
            </button>
            {final || holdExpired ? (
              <button type="button" onClick={next} className="btn btn-oscuro flex-1">
                Escanear de nuevo
              </button>
            ) : (
              <button type="button" onClick={submitEarn} disabled={!ready || phase.submitting} className="btn btn-oscuro min-h-14 flex-1 text-lg disabled:opacity-50">
                {phase.submitting ? "Registrando…" : phase.error ? "Reintentar" : "Sumar sello"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
