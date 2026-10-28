"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { recordSaleAction, type CheckoutResult } from "@/actions/checkout";
import { PENDING_TICKET_KEY } from "@/domain/staff/pending-ticket";
import { PENDING_SALE_KEY, parsePendingSale, type PendingSale } from "@/domain/staff/pending-sale";
import { ProductThumbnail } from "@/components/staff/ProductThumbnail";
import { formatMxn as formatMoney } from "@/lib/format";

type Product = { id: string; name: string; category: string; price_cents: number; available: number; imageUrl: string | null;
  recipeConfigured: boolean; missingIngredients: { name: string; unit: string; needed: number; in_stock: number }[] };
type Payment = "cash" | "card_manual" | "transfer_manual";
const searchKey = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-MX");
const PAGE_SIZE = 8;

export function Checkout({ branchId, branchName, products }: { branchId: string; branchName: string; products: Product[] }) {
  const router = useRouter();
  const successDialog = useRef<HTMLDivElement>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [productPage, setProductPage] = useState(1);
  const [payment, setPayment] = useState<Payment>("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [completed, setCompleted] = useState<string | null>(null);
  const [completedTotal, setCompletedTotal] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
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

  useEffect(() => {
    if (completed === null) return;
    successDialog.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function trapFocus(event: KeyboardEvent) {
      if (event.key !== "Tab" || !successDialog.current) return;
      const controls = Array.from(successDialog.current.querySelectorAll<HTMLElement>("a[href],button:not(:disabled)"));
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", trapFocus);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener("keydown", trapFocus); };
  }, [completed]);

  const categories = useMemo(() => [...new Set(products.map((product) => product.category))].sort((a, b) => a.localeCompare(b, "es-MX")), [products]);
  const visibleProducts = useMemo(() => products.filter((product) => (!category || product.category === category) && searchKey(product.name).includes(searchKey(query))), [products, query, category]);
  const productPages = Math.max(1, Math.ceil(visibleProducts.length / PAGE_SIZE));
  const currentProductPage = Math.min(productPage, productPages);
  const pagedProducts = visibleProducts.slice((currentProductPage - 1) * PAGE_SIZE, currentProductPage * PAGE_SIZE);
  const unavailableCount = products.filter((product) => product.available <= 0).length;
  const lines = useMemo(() => products.filter((product) => cart[product.id] > 0).map((product) => ({ product_id: product.id, quantity: cart[product.id], name: product.name, price_cents: product.price_cents })), [cart, products]);
  const total = lines.reduce((sum, line) => sum + line.quantity * line.price_cents, 0);
  const received = Math.round(Number(cashReceived) * 100);
  const cashValid = payment !== "cash" || (/^\d+(?:\.\d{1,2})?$/.test(cashReceived.trim()) && Number.isFinite(received) && received >= total);
  const canSubmit = lines.length > 0 && cashValid && confirmed && !busy && !uncertain && completed === null;

  function changeQuantity(id: string, delta: number) {
    if (busy || uncertain || completed !== null) return;
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
    setCompletedTotal(null);
    setSuccessMessage("");
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
    setCompletedTotal(result.totalCents ?? total);
    setSuccessMessage(result.message);
    setConfirmed(false);
    router.refresh();
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

  return (<>
    <div inert={completed !== null} className="space-y-6 pb-20 lg:pb-0">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="workspace-kicker">Operación diaria · {branchName}</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-[#30251f]">Caja</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">Arma el pedido, confirma el cobro y continúa con fidelidad si el cliente presenta su tarjeta.</p>
        </div>
        <Link href="/barra" className="workspace-action-secondary">Ir a fidelidad →</Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-950">
        <span aria-hidden="true" className="text-xl">✦</span><span><strong>Pedido → cobro → fidelidad.</strong> El inventario se descuenta al guardar la venta.</span>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="workspace-card overflow-hidden p-5 sm:p-6" aria-labelledby="catalog-title">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="workspace-kicker">Elige el pedido</p><h2 id="catalog-title" className="mt-1 text-2xl font-bold text-slate-950">Productos</h2></div><span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-800">{products.length} productos</span></div>
          <label className="mt-5 block"><span className="text-sm font-semibold text-slate-700">Buscar producto</span><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setProductPage(1); }} placeholder="Escribe el nombre del producto" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label>
          {categories.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Filtrar por categoría">{["", ...categories].map((entry) => <button key={entry || "all"} type="button" aria-pressed={category === entry} onClick={() => { setCategory(entry); setProductPage(1); }} className={`min-h-10 shrink-0 cursor-pointer rounded-full border px-4 text-sm font-semibold transition-colors ${category === entry ? "border-blue-700 bg-blue-700 text-white" : "border-blue-100 bg-white text-blue-800 hover:bg-blue-50"}`}>{entry || "Todos"}</button>)}</div>}
          {unavailableCount > 0 && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"><strong>{unavailableCount} producto{unavailableCount === 1 ? "" : "s"} no disponible{unavailableCount === 1 ? "" : "s"}.</strong> Revisa las tarjetas para ver qué ingrediente falta o si necesitan receta.</p>}
          {visibleProducts.length === 0 ? <p className="mt-6 text-sm text-slate-600">No hay productos que coincidan con tu búsqueda.</p> : <><div className="mt-5 grid gap-3 sm:grid-cols-2">{pagedProducts.map((product) => <ProductCard key={product.id} product={product} quantity={cart[product.id] ?? 0} blocked={busy || uncertain || completed !== null} onQuantity={changeQuantity} />)}</div>
            {productPages > 1 && <nav aria-label="Páginas de productos" className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-blue-100 pt-4 text-sm"><button type="button" disabled={currentProductPage === 1} onClick={() => setProductPage(currentProductPage - 1)} className="min-h-10 cursor-pointer rounded-xl border border-blue-200 px-4 font-semibold text-blue-800 disabled:cursor-not-allowed disabled:opacity-40">← Anterior</button><span className="text-slate-600">Página {currentProductPage} de {productPages}</span><button type="button" disabled={currentProductPage === productPages} onClick={() => setProductPage(currentProductPage + 1)} className="min-h-10 cursor-pointer rounded-xl border border-blue-200 px-4 font-semibold text-blue-800 disabled:cursor-not-allowed disabled:opacity-40">Siguiente →</button></nav>}</>}
        </section>

        <aside id="resumen-cobro" className="workspace-card scroll-mt-5 p-5 lg:sticky lg:top-6" aria-labelledby="checkout-title">
          <p className="workspace-kicker">Revisa y cobra</p><h2 id="checkout-title" className="mt-1 text-2xl font-bold text-[#30251f]">Tu cuenta</h2>
          {lines.length === 0 ? <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Agrega productos para comenzar una venta.</p> : <ul className="mt-5 space-y-3 border-b border-slate-200 pb-5">{lines.map((line) => <li key={line.product_id} className="flex justify-between gap-3 text-sm"><span className="text-slate-700">{line.quantity} × {line.name}</span><strong className="whitespace-nowrap text-slate-900">{formatMoney(line.quantity * line.price_cents)}</strong></li>)}</ul>}
          <div className="mt-5 flex items-baseline justify-between"><span className="font-semibold text-slate-700">Total</span><strong className="text-2xl font-bold text-slate-950">{formatMoney(total)}</strong></div>
          <fieldset className="mt-6" disabled={busy || uncertain || completed !== null}><legend className="text-sm font-semibold text-slate-800">Método de pago</legend><div className="mt-2 grid gap-2">{([{ value: "cash", label: "Efectivo" }, { value: "card_manual", label: "Tarjeta cobrada en terminal externa" }, { value: "transfer_manual", label: "Transferencia recibida fuera de Loyalty" }] as const).map((option) => <label key={option.value} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-800"><input type="radio" name="payment" checked={payment === option.value} onChange={() => { setPayment(option.value); setConfirmed(false); setKey(crypto.randomUUID()); }} />{option.label}</label>)}</div></fieldset>
          {payment === "cash" && <label className="mt-5 block text-sm font-semibold text-slate-800">Efectivo recibido (calcular cambio)<input type="number" min="0" step="0.01" inputMode="decimal" value={cashReceived} onChange={(event) => { setCashReceived(event.target.value); setConfirmed(false); setKey(crypto.randomUUID()); }} disabled={busy || uncertain || completed !== null} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950" placeholder="0.00" /></label>}
          {payment === "cash" && lines.length > 0 && <p className="mt-2 text-sm text-slate-600">{cashValid ? `Cambio: ${formatMoney(received - total)}` : "El efectivo recibido debe cubrir el total."}</p>}
          {payment !== "cash" && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">Loyalty aún no procesa ni verifica este pago. Registra la venta solo después de confirmar el cobro en la terminal o en tu banco.</p>}
          <label className="mt-6 flex items-start gap-3 text-sm text-slate-700"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={!lines.length || !cashValid || busy || uncertain || completed !== null} className="mt-1" /><span>{payment === "card_manual" ? "Confirmo que la terminal externa aprobó el pago y revisé los productos." : payment === "transfer_manual" ? "Confirmo que la transferencia ya se reflejó en el banco y revisé los productos." : "Confirmo que revisé los productos y recibí el pago indicado."}</span></label>
          {outcome && <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{outcome}</p>}
          {uncertain ? <button type="button" onClick={retry} disabled={busy} className="workspace-action mt-5 w-full justify-center">{busy ? "Consultando…" : "Reintentar la misma operación"}</button> : <button type="button" onClick={submit} disabled={!canSubmit} className="workspace-action mt-5 w-full justify-center disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Registrando…" : `Registrar venta · ${formatMoney(total)}`}</button>}
          <p className="mt-3 text-xs text-slate-500">La venta actualiza existencias. El cambio es una ayuda visual; la fidelidad se acredita en el siguiente paso.</p>
        </aside>
      </div>
      {lines.length > 0 && completed === null && <button type="button" onClick={() => document.getElementById("resumen-cobro")?.scrollIntoView({ behavior: "smooth" })} className="fixed inset-x-3 bottom-[5.5rem] z-20 flex items-center justify-between rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-xl lg:hidden"><span>{lines.reduce((sum, line) => sum + line.quantity, 0)} artículos · {formatMoney(total)}</span><span>Ver cobro ↑</span></button>}
    </div>
    {completed !== null && <div className="fixed inset-0 z-50 grid place-items-center bg-[#20170f]/65 px-4 py-8 backdrop-blur-sm" role="presentation">
      <div ref={successDialog} role="dialog" aria-modal="true" aria-labelledby="sale-success-title" aria-describedby="sale-success-description" className="w-full max-w-md rounded-[1.75rem] border border-white/80 bg-white p-6 text-center shadow-[0_30px_90px_rgba(27,18,10,0.35)] sm:p-8">
        <span aria-hidden="true" className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-100 text-3xl text-emerald-800">✓</span>
        <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.14em] text-emerald-700">Caja · {branchName}</p>
        <h2 id="sale-success-title" className="mt-2 text-3xl font-bold text-[#30251f]">Venta confirmada</h2>
        <p id="sale-success-description" className="mt-3 text-sm leading-6 text-slate-600">{successMessage} Si el cliente tiene tarjeta, aplica fidelidad con el mismo folio.</p>
        <p className="mt-4 text-2xl font-bold text-[#30251f]">{formatMoney(completedTotal ?? total)}</p>
        {completed && <p className="mt-2 break-all text-xs text-slate-500">Folio: {completed}</p>}
        <div className="mt-6 grid gap-3"><Link href="/barra" className="workspace-action w-full">Aplicar fidelidad →</Link><button type="button" onClick={newSale} className="workspace-action-secondary w-full">Nueva cuenta</button></div>
        <p className="mt-4 text-xs text-slate-500">El cobro con tarjeta o transferencia se verifica fuera del sistema.</p>
      </div>
    </div>}
  </>);
}

function ProductCard({ product, quantity, blocked, onQuantity }: { product: Product; quantity: number; blocked: boolean; onQuantity: (id: string, delta: number) => void }) {
  const available = product.available > 0;
  return <article className={`rounded-2xl border p-3 transition-all duration-150 ${available ? "border-blue-100 bg-gradient-to-br from-white to-blue-50/70 shadow-[0_5px_18px_rgba(30,64,175,0.06)] hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-[0_12px_26px_rgba(30,64,175,0.12)]" : "border-slate-200 bg-slate-50"}`}>
    <div className="flex gap-3">
      <ProductThumbnail src={product.imageUrl} />
      <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{product.category}</p><h3 className="mt-1 font-bold leading-5 text-slate-950">{product.name}</h3><strong className="mt-2 block text-lg text-slate-950">{formatMoney(product.price_cents)}</strong></div>
    </div>
    {available ? <p className="mt-3 text-xs font-medium text-emerald-800">Disponible · hasta {product.available} {product.available === 1 ? "unidad" : "unidades"}</p>
      : <div className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-xs text-amber-950"><strong>No disponible</strong>
        {!product.recipeConfigured ? <p className="mt-1">Falta configurar la receta.</p> : product.missingIngredients.length > 0 ? <ul className="mt-1 list-inside list-disc">{product.missingIngredients.map((item) => <li key={item.name}>Falta {item.name}: quedan {item.in_stock} {item.unit} y se necesitan {item.needed} {item.unit}</li>)}</ul>
          : <p className="mt-1">Revisa las existencias de sus ingredientes.</p>}</div>}
    <div className="mt-3 flex items-center justify-end gap-3 border-t border-blue-100 pt-3"><button type="button" onClick={() => onQuantity(product.id, -1)} disabled={!quantity || blocked} aria-label={`Quitar ${product.name}`} className="grid h-10 w-10 place-items-center rounded-xl border border-blue-200 bg-white text-xl text-blue-800 hover:border-blue-500 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40">−</button><span className="min-w-5 text-center font-bold tabular-nums text-slate-950">{quantity}</span><button type="button" onClick={() => onQuantity(product.id, 1)} disabled={!available || product.available <= quantity || blocked} aria-label={`Agregar ${product.name}`} className="grid h-10 w-10 place-items-center rounded-xl bg-blue-700 text-xl text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40">+</button></div>
  </article>;
}
