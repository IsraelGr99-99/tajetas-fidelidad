"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { recordSaleAction, type CheckoutResult } from "@/actions/checkout";
import { PENDING_TICKET_KEY } from "@/domain/staff/pending-ticket";
import { PENDING_SALE_KEY, parsePendingSale, type PendingSale } from "@/domain/staff/pending-sale";
import { formatMxn as formatMoney } from "@/lib/format";

type Product = { id: string; name: string; price_cents: number; available: number };
type Payment = "cash" | "card_manual" | "transfer_manual";

export function Checkout({ branchId, branchName, products }: { branchId: string; branchName: string; products: Product[] }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [payment, setPayment] = useState<Payment>("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [completed, setCompleted] = useState<string | null>(null);
  const [pendingSale, setPendingSale] = useState<PendingSale | null>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const pending = parsePendingSale(sessionStorage.getItem(PENDING_SALE_KEY), branchId);
        if (!pending) return;
        setPendingSale(pending);
        setCart(Object.fromEntries(pending.lines.map((line) => [line.product_id, line.quantity])));
        setPayment(pending.paymentMethod);
        setCashReceived(pending.cashReceived);
        setKey(pending.key);
        setUncertain(true);
        setOutcome("Hay una venta cuya respuesta no se confirmó. No inicies otra: reintenta esta operación con la misma clave. Si ya existe, el servidor devolverá el mismo resultado.");
      } catch { /* El almacenamiento puede estar deshabilitado. */ }
    }, 0);
    return () => window.clearTimeout(id);
  }, [branchId]);

  const visibleProducts = useMemo(() => products.filter((product) => product.name.toLocaleLowerCase("es-MX").includes(query.toLocaleLowerCase("es-MX"))), [products, query]);
  const lines = useMemo(() => products.filter((product) => cart[product.id] > 0).map((product) => ({ product_id: product.id, quantity: cart[product.id], name: product.name, price_cents: product.price_cents })), [cart, products]);
  const total = lines.reduce((sum, line) => sum + line.quantity * line.price_cents, 0);
  const received = Math.round(Number(cashReceived) * 100);
  const cashValid = payment !== "cash" || (/^\d+(?:\.\d{1,2})?$/.test(cashReceived.trim()) && Number.isFinite(received) && received >= total);
  const canSubmit = lines.length > 0 && cashValid && confirmed && !busy && !uncertain && !completed;

  function changeQuantity(id: string, delta: number) {
    if (busy || uncertain || completed) return;
    const product = products.find((item) => item.id === id);
    if (!product) return;
    setCart((current) => ({ ...current, [id]: Math.max(0, Math.min(product.available, (current[id] ?? 0) + delta)) }));
    setConfirmed(false);
    setOutcome(null);
    setKey(crypto.randomUUID());
  }

  function newSale() {
    try { sessionStorage.removeItem(PENDING_TICKET_KEY); } catch { /* Sin almacenamiento local. */ }
    try { sessionStorage.removeItem(PENDING_SALE_KEY); } catch { /* Sin almacenamiento local. */ }
    setCart({});
    setPayment("cash");
    setCashReceived("");
    setConfirmed(false);
    setCompleted(null);
    setOutcome(null);
    setUncertain(false);
    setPendingSale(null);
    setKey(crypto.randomUUID());
  }

  function handleResult(result: CheckoutResult, operation: PendingSale) {
    if (!result.ok) {
      setOutcome(result.message);
      if (result.uncertain) {
        setUncertain(true);
      } else {
        setPendingSale(null);
        setConfirmed(false);
        try { sessionStorage.removeItem(PENDING_SALE_KEY); } catch { /* Sin almacenamiento local. */ }
      }
      return;
    }
    setPendingSale(null);
    setUncertain(false);
    setOutcome(null);
    try { sessionStorage.removeItem(PENDING_SALE_KEY); } catch { /* Sin almacenamiento local. */ }
    const saleId = result.saleId ?? "";
    if (saleId) {
      try {
        sessionStorage.setItem(PENDING_TICKET_KEY, JSON.stringify({ branchId, folio: saleId, items: operation.lines, savedAt: Date.now() }));
      } catch { /* El enlace manual sigue disponible si el almacenamiento está bloqueado. */ }
    }
    setCompleted(saleId);
    setConfirmed(false);
  }

  async function submit() {
    if (!canSubmit) return;
    const operation: PendingSale = { branchId, key, lines: lines.map(({ product_id, quantity }) => ({ product_id, quantity })), paymentMethod: payment, cashReceived, savedAt: Date.now() };
    setPendingSale(operation);
    try { sessionStorage.setItem(PENDING_SALE_KEY, JSON.stringify(operation)); } catch { /* En memoria aún puede reintentarse. */ }
    setBusy(true);
    setOutcome(null);
    try {
      const result = await recordSaleAction({ branchId: operation.branchId, lines: operation.lines, paymentMethod: operation.paymentMethod, key: operation.key });
      handleResult(result, operation);
    } catch {
      setUncertain(true);
      setOutcome("No se pudo confirmar la respuesta. La venta podría haberse guardado. Reintenta con la misma operación; no cobres otra vez todavía.");
    } finally {
      setBusy(false);
    }
  }

  async function retry() {
    if (!uncertain || busy || !pendingSale) return;
    setUncertain(false);
    // Se conserva la misma clave para que el servidor resuelva la operación de forma idempotente.
    setBusy(true);
    try {
      const result = await recordSaleAction({ branchId: pendingSale.branchId, lines: pendingSale.lines, paymentMethod: pendingSale.paymentMethod, key: pendingSale.key });
      handleResult(result, pendingSale);
    } catch {
      setUncertain(true);
      setOutcome("La respuesta sigue sin confirmarse. Conserva esta pantalla y pide revisar la venta antes de repetir el cobro.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="workspace-kicker">Operación diaria · {branchName}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Caja</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">Selecciona productos, confirma el cobro y luego aplica fidelidad si el cliente presenta su tarjeta.</p>
        </div>
        <Link href="/barra" className="workspace-action-secondary">Ir a fidelidad →</Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="workspace-card p-4"><span className="workspace-kicker">01 · Venta</span><p className="mt-2 font-semibold text-slate-900">Arma el pedido</p></div>
        <div className="workspace-card p-4"><span className="workspace-kicker">02 · Cobro</span><p className="mt-2 font-semibold text-slate-900">Registra el pago</p></div>
        <div className="workspace-card p-4"><span className="workspace-kicker">03 · Fidelidad</span><p className="mt-2 font-semibold text-slate-900">Escanea y acredita</p></div>
      </div>

      {completed !== null && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5" role="status">
          <p className="font-bold text-emerald-900">Venta registrada</p>
          <p className="mt-1 text-sm text-emerald-800">La venta quedó registrada en caja. Verifica el pago físico o externo; si el cliente participa en el programa, continúa con su tarjeta en fidelidad.</p>
          {completed && <p className="mt-2 break-all text-xs text-emerald-800">Folio interno: {completed}</p>}
          <div className="mt-4 flex flex-wrap gap-2"><Link href="/barra" className="workspace-action">Aplicar fidelidad →</Link><button type="button" onClick={newSale} className="workspace-action-secondary">Nueva venta</button></div>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="workspace-card p-5" aria-labelledby="catalog-title">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="workspace-kicker">Paso 1</p><h2 id="catalog-title" className="mt-1 text-xl font-bold text-slate-950">Productos</h2></div><span className="text-sm text-slate-500">{products.length} en catálogo</span></div>
          <label className="mt-5 block"><span className="text-sm font-medium text-slate-700">Buscar producto</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre del artículo" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label>
          {visibleProducts.length === 0 ? <p className="mt-6 text-sm text-slate-600">No hay productos que coincidan con tu búsqueda.</p> : <div className="mt-5 grid gap-3 sm:grid-cols-2">{visibleProducts.map((product) => <div key={product.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{product.name}</h3><p className="mt-1 text-xs text-slate-500">{product.available > 0 ? `${product.available} disponibles` : "Sin existencias"}</p></div><strong className="whitespace-nowrap text-sm text-slate-900">{formatMoney(product.price_cents)}</strong></div><div className="mt-4 flex items-center justify-end gap-3"><button type="button" onClick={() => changeQuantity(product.id, -1)} disabled={!cart[product.id] || busy || uncertain || !!completed} aria-label={`Quitar ${product.name}`} className="h-9 w-9 rounded-lg border border-slate-300 text-lg text-slate-700 disabled:opacity-40">−</button><span className="min-w-5 text-center font-semibold text-slate-900">{cart[product.id] ?? 0}</span><button type="button" onClick={() => changeQuantity(product.id, 1)} disabled={product.available <= (cart[product.id] ?? 0) || busy || uncertain || !!completed} aria-label={`Agregar ${product.name}`} className="h-9 w-9 rounded-lg bg-slate-900 text-lg text-white disabled:opacity-40">+</button></div></div>)}</div>}
        </section>

        <aside id="resumen-cobro" className="workspace-card scroll-mt-5 p-5 lg:sticky lg:top-6" aria-labelledby="checkout-title">
          <p className="workspace-kicker">Paso 2</p><h2 id="checkout-title" className="mt-1 text-xl font-bold text-slate-950">Cobro</h2>
          {lines.length === 0 ? <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Agrega productos para comenzar una venta.</p> : <ul className="mt-5 space-y-3 border-b border-slate-200 pb-5">{lines.map((line) => <li key={line.product_id} className="flex justify-between gap-3 text-sm"><span className="text-slate-700">{line.quantity} × {line.name}</span><strong className="whitespace-nowrap text-slate-900">{formatMoney(line.quantity * line.price_cents)}</strong></li>)}</ul>}
          <div className="mt-5 flex items-baseline justify-between"><span className="font-semibold text-slate-700">Total</span><strong className="text-2xl font-bold text-slate-950">{formatMoney(total)}</strong></div>
          <fieldset className="mt-6" disabled={busy || uncertain || !!completed}><legend className="text-sm font-semibold text-slate-800">Método de pago</legend><div className="mt-2 grid gap-2">{([{ value: "cash", label: "Efectivo" }, { value: "card_manual", label: "Tarjeta (registro manual)" }, { value: "transfer_manual", label: "Transferencia (registro manual)" }] as const).map((option) => <label key={option.value} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-800"><input type="radio" name="payment" checked={payment === option.value} onChange={() => { setPayment(option.value); setConfirmed(false); setKey(crypto.randomUUID()); }} />{option.label}</label>)}</div></fieldset>
          {payment === "cash" && <label className="mt-5 block text-sm font-semibold text-slate-800">Efectivo recibido (calcular cambio)<input type="number" min="0" step="0.01" inputMode="decimal" value={cashReceived} onChange={(event) => { setCashReceived(event.target.value); setConfirmed(false); setKey(crypto.randomUUID()); }} disabled={busy || uncertain || !!completed} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950" placeholder="0.00" /></label>}
          {payment === "cash" && lines.length > 0 && <p className="mt-2 text-sm text-slate-600">{cashValid ? `Cambio: ${formatMoney(received - total)}` : "El efectivo recibido debe cubrir el total."}</p>}
          {payment !== "cash" && <p className="mt-3 text-xs text-slate-500">Este registro no procesa pagos con el banco ni confirma una transferencia.</p>}
          <label className="mt-6 flex items-start gap-3 text-sm text-slate-700"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={!lines.length || !cashValid || busy || uncertain || !!completed} className="mt-1" /><span>Confirmo que revisé los productos y recibí el pago indicado.</span></label>
          {outcome && <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{outcome}</p>}
          {uncertain ? <button type="button" onClick={retry} disabled={busy} className="workspace-action mt-5 w-full justify-center">{busy ? "Consultando…" : "Reintentar la misma operación"}</button> : <button type="button" onClick={submit} disabled={!canSubmit} className="workspace-action mt-5 w-full justify-center disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Registrando…" : `Registrar venta · ${formatMoney(total)}`}</button>}
          <p className="mt-3 text-xs text-slate-500">La venta actualiza existencias. El cambio es una ayuda visual; la fidelidad se acredita en el siguiente paso.</p>
        </aside>
      </div>
      {lines.length > 0 && !completed && <button type="button" onClick={() => document.getElementById("resumen-cobro")?.scrollIntoView({ behavior: "smooth" })} className="fixed inset-x-3 bottom-[5.5rem] z-20 flex items-center justify-between rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-xl lg:hidden"><span>{lines.reduce((sum, line) => sum + line.quantity, 0)} artículos · {formatMoney(total)}</span><span>Ver cobro ↑</span></button>}
    </div>
  );
}
