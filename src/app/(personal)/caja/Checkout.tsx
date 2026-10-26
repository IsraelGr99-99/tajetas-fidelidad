"use client";

import { useMemo, useState } from "react";
import { recordSaleAction, type CheckoutResult } from "@/actions/checkout";
import { formatMxn } from "@/lib/format";

type Product = { id: string; name: string; price_cents: number; available: number };
type Payment = "cash" | "card_manual" | "transfer_manual";

export function Checkout({ branchId, branchName, products }: { branchId: string; branchName: string; products: Product[] }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [payment, setPayment] = useState<Payment>("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<CheckoutResult | null>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const lines = useMemo(() => products.filter((p) => (cart[p.id] ?? 0) > 0).map((p) => ({ product_id: p.id, quantity: cart[p.id] })), [cart, products]);
  const total = products.reduce((sum, p) => sum + p.price_cents * (cart[p.id] ?? 0), 0);
  const receivedCents = Math.round(Number(cashReceived) * 100);
  const cashValid = payment !== "cash" || (cashReceived.trim() !== "" && Number.isFinite(receivedCents) && receivedCents >= total);

  function change(id: string, quantity: number) {
    setOutcome(null);
    setKey(crypto.randomUUID());
    setCart((current) => ({ ...current, [id]: Math.max(0, Math.min(100, Math.floor(quantity) || 0)) }));
  }

  async function submit() {
    if (!lines.length || busy || !cashValid) return;
    setBusy(true);
    try {
      const result = await recordSaleAction({ branchId, key, paymentMethod: payment, lines });
      setOutcome(result);
      if (result.ok) { setCart({}); setCashReceived(""); setKey(crypto.randomUUID()); }
    } catch { setOutcome({ ok: false, message: "No se pudo contactar al servidor. Reintenta con el mismo carrito; la caja evita duplicados." }); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <header><p className="bitacora text-tabaco/60">{branchName} · venta presencial</p><h1 className="font-display text-4xl text-tabaco">Caja</h1>
      <p className="mt-2 text-sm text-tabaco/75">Selecciona productos, confirma el cobro fuera de la aplicación y registra la venta. El stock se descuenta al guardar.</p></header>
    {outcome && <p role="status" className={`rounded-xl p-4 text-sm ${outcome.ok ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900"}`}>{outcome.message}{outcome.saleId ? ` Folio: ${outcome.saleId.slice(0, 8).toUpperCase()}.` : ""}</p>}
    <div className="grid gap-6 lg:grid-cols-[1fr_19rem]">
      <section className="rounded-3xl bg-papel p-5"><h2 className="text-xl font-semibold text-tabaco">Productos</h2>
        {products.length === 0 ? <p className="mt-4 text-sm text-tabaco/70">No hay productos activos en el catálogo.</p> :
          <ul className="mt-4 grid gap-2">{products.map((p) => <li key={p.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3">
            <div><strong className="text-tabaco">{p.name}</strong><p className="text-xs text-tabaco/60">{formatMxn(p.price_cents)} · disponibles aprox. {p.available}</p></div>
            <div className="flex items-center gap-2"><button type="button" onClick={() => change(p.id, (cart[p.id] ?? 0) - 1)} className="h-10 w-10 rounded-full border border-tabaco/20" aria-label={`Quitar ${p.name}`}>−</button>
              <span className="w-5 text-center">{cart[p.id] ?? 0}</span><button type="button" onClick={() => change(p.id, (cart[p.id] ?? 0) + 1)} disabled={p.available <= (cart[p.id] ?? 0)} className="h-10 w-10 rounded-full bg-tabaco text-crema disabled:opacity-30" aria-label={`Agregar ${p.name}`}>+</button></div>
          </li>)}</ul>}
      </section>
      <aside className="h-fit rounded-3xl bg-white p-5 shadow-sm"><h2 className="text-xl font-semibold text-tabaco">Resumen</h2>
        <ul className="mt-4 space-y-2 text-sm">{lines.map((line) => { const p = products.find((x) => x.id === line.product_id)!; return <li key={p.id} className="flex justify-between gap-2"><span>{line.quantity} × {p.name}</span><span>{formatMxn(line.quantity * p.price_cents)}</span></li>; })}</ul>
        <p className="mt-4 flex justify-between border-t border-tabaco/15 pt-4 text-xl font-bold text-tabaco"><span>Total</span><span>{formatMxn(total)}</span></p>
        <label className="mt-5 grid gap-1 text-sm font-semibold text-tabaco">Cobro confirmado mediante
          <select value={payment} onChange={(e) => setPayment(e.target.value as Payment)} className="min-h-11 rounded-xl border border-tabaco/20 bg-white px-3">
            <option value="cash">Efectivo</option><option value="card_manual">Tarjeta, terminal externa</option><option value="transfer_manual">Transferencia verificada fuera</option>
          </select></label>
        {payment === "cash" && <label className="mt-3 grid gap-1 text-sm font-semibold text-tabaco">Efectivo recibido ($)
          <input type="number" min="0" step="0.01" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} className="min-h-11 rounded-xl border border-tabaco/20 bg-white px-3" placeholder="0.00" />
          {cashReceived && cashValid && <span className="text-base">Cambio: {formatMxn(receivedCents - total)}</span>}
          {cashReceived && !cashValid && <span className="text-xs text-red-800">El efectivo recibido no cubre el total.</span>}
        </label>}
        <p className="mt-3 text-xs text-tabaco/65">La aplicación no procesa ni comprueba pagos de tarjeta o transferencia. Registra solo cobros confirmados.</p>
        <button type="button" onClick={() => void submit()} disabled={busy || !lines.length || !cashValid} className="btn mt-5 w-full bg-tabaco text-crema disabled:opacity-40">{busy ? "Registrando…" : "Registrar venta cobrada"}</button>
        <p className="mt-3 text-xs text-tabaco/65">Impresión térmica ESC/POS: adaptador preparado, conexión pendiente de modelo y pruebas físicas. No se enviará ningún ticket automáticamente.</p>
      </aside>
    </div>
  </div>;
}
