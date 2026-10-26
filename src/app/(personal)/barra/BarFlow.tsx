"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type ClaimResult, type EarnResult, type RedeemResult, claimCardAction, recordEarnAction, redeemAction, releaseHoldAction } from "@/actions/bar";
import { Notice, newIdempotencyKey } from "@/components/staff/OperationParts";
import { QrScanner } from "@/components/staff/QrScanner";
import { PENDING_TICKET_KEY, parsePendingTicket } from "@/domain/staff/pending-ticket";
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
  branchId,
  branchName,
  initialClaim,
}: {
  catalog: CatalogProduct[];
  branchId: string;
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
  const [productQuery, setProductQuery] = useState("");
  const [prefilled, setPrefilled] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const resetTicket = () => {
    setFolio("");
    setLines({});
    setPrefilled(false);
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
    if (r.purpose !== "redeem") {
      try {
        const ticket = parsePendingTicket(sessionStorage.getItem(PENDING_TICKET_KEY), branchId);
        if (ticket) {
          setFolio(ticket.folio);
          setLines(Object.fromEntries(ticket.items.filter((item) => catalog.some((product) => product.id === item.product_id)).map((item) => [item.product_id, { quantity: item.quantity, complimentary: false }])));
          setPrefilled(true);
        }
      } catch { /* La captura manual sigue disponible. */ }
    }
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
  const visibleProducts = catalog.filter((p) => p.name.toLocaleLowerCase("es-MX").includes(productQuery.toLocaleLowerCase("es-MX")));

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
      if (prefilled) {
        try { sessionStorage.removeItem(PENDING_TICKET_KEY); } catch { /* Sin almacenamiento local. */ }
      }
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
      <div className="mx-auto max-w-xl space-y-4">
        <header>
          <p className="workspace-kicker">Operación diaria · {branchName}</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">Fidelidad</h1>
          <p className="mt-2 text-sm text-slate-600">Escanea el QR del cliente. El sistema reconocerá si corresponde sumar un sello o entregar una recompensa.</p>
        </header>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">Si acabas de registrar una venta en caja en este dispositivo, se precargarán sus datos después de escanear una tarjeta de visita. Revisa el ticket antes de acreditar.</div>
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
        <div className="relative overflow-hidden rounded-3xl bg-exito p-6 text-center text-crema">
          {/* Sello que cae: confirma de un vistazo que la operación quedó registrada */}
          <span aria-hidden="true" className="relative mx-auto grid h-24 w-24 place-items-center" style={{ ["--giro" as string]: "-9deg" }}>
            <span className="absolute inset-0 rounded-full bg-crema/30" style={{ animation: "tinta 700ms ease-out 380ms both" }} />
            <span
              className="grid h-full w-full place-items-center rounded-full border-[3px] border-crema text-crema"
              style={{ boxShadow: "inset 0 0 0 4px rgb(47 107 79), inset 0 0 0 6px rgb(245 235 230 / 0.9)", animation: "sello-cae 620ms cubic-bezier(.2,.9,.3,1.25) both" }}
            >
              {earn ? (
                <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="8" />
                  <path d="m15 9-2 5-4 1 2-5 4-1Z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z" />
                  <path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16M8 3c0 1.5 1 1.5 1 3M12 3c0 1.5 1 1.5 1 3" />
                </svg>
              )}
            </span>
          </span>
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
      <div><p className="workspace-kicker">Paso 3 · Fidelidad</p><h1 className="mt-1 text-2xl font-bold text-slate-950">Confirma la visita</h1><p className="mt-1 text-sm text-slate-600">Compara el folio y los productos con el ticket antes de sumar el sello.</p></div>
      {customer}

      {prefilled && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"><span><strong>Datos precargados desde caja.</strong> Confirma que esta venta corresponde a este cliente. El registro de caja no valida automáticamente la identidad del cliente.</span><button type="button" onClick={() => { resetTicket(); try { sessionStorage.removeItem(PENDING_TICKET_KEY); } catch { /* Sin almacenamiento local. */ } }} className="font-bold underline underline-offset-2">Capturar otro ticket</button></div>}

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

      <section aria-labelledby="productos-visita" className="workspace-card p-5">
        <h2 id="productos-visita" className="text-lg font-bold text-slate-950">Productos del ticket</h2>
        <p className="mt-1 text-sm text-slate-600">Selecciona lo que el cliente compró. Solo los productos elegibles pagados suman sello.</p>
        <label className="mt-4 block text-sm font-medium text-slate-800">Buscar producto<input type="search" value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="Nombre del producto" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {visibleProducts.map((p) => <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><span className="min-w-0 text-sm text-slate-900"><strong className="block truncate">{p.name}</strong><span className="text-xs text-slate-500">{formatMxn(p.priceCents)} · {p.eligible ? "Elegible" : "No suma sello"}</span></span><span className="flex shrink-0 items-center gap-2"><button type="button" onClick={() => add(p.id, -1)} disabled={!lines[p.id]} aria-label={`Quitar ${p.name}`} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-300 text-slate-800 disabled:opacity-40">−</button><span className="w-5 text-center font-semibold tabular-nums">{lines[p.id]?.quantity ?? 0}</span><button type="button" onClick={() => add(p.id, 1)} disabled={(lines[p.id]?.quantity ?? 0) >= 20} aria-label={`Agregar ${p.name}`} className="grid h-9 w-9 place-items-center rounded-lg bg-slate-900 text-white disabled:opacity-40">+</button></span></li>)}
        </ul>
        {visibleProducts.length === 0 && <p className="mt-4 text-sm text-slate-600">No hay productos que coincidan con tu búsqueda.</p>}
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
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-[17.5rem]">
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
