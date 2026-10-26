"use client";

import { useState } from "react";
import { adjustStockAction, setRecipeAction, upsertStockItemAction, type CheckoutResult } from "@/actions/checkout";
import type { Branch } from "@/domain/staff/permissions";
import { StockImport } from "./StockImport";

type Data = {
  items: { id: string; name: string; unit: string }[];
  balances: { branch_id: string; item_id: string; quantity: number; minimum: number }[];
  recipes: { product_id: string; item_id: string; quantity: number }[];
  products: { id: string; name: string }[];
};
const inputClass = "min-h-11 rounded-xl border border-tabaco/20 bg-white px-3 text-tabaco";

export function InventoryManager({ businessId, branches, data }: { businessId: string; branches: Branch[]; data: Data }) {
  const [itemName, setItemName] = useState("");
  const [unit, setUnit] = useState("pieza");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [itemId, setItemId] = useState(data.items[0]?.id ?? "");
  const [delta, setDelta] = useState("");
  const [minimum, setMinimum] = useState("0");
  const [reason, setReason] = useState("");
  const [productId, setProductId] = useState(data.products[0]?.id ?? "");
  const [recipeRows, setRecipeRows] = useState<{ id: number; itemId: string; quantity: string }[]>(
    () => data.recipes.filter((r) => r.product_id === data.products[0]?.id).map((r, index) => ({ id: index + 1, itemId: r.item_id, quantity: String(r.quantity) }))
      .concat(data.recipes.some((r) => r.product_id === data.products[0]?.id) ? [] : [{ id: 1, itemId: data.items[0]?.id ?? "", quantity: "" }]),
  );
  const [nextRecipeId, setNextRecipeId] = useState(31);
  const [outcome, setOutcome] = useState<CheckoutResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<CheckoutResult>) {
    setBusy(true);
    try { setOutcome(await action()); } catch { setOutcome({ ok: false, message: "No se pudo contactar al servidor." }); }
    finally { setBusy(false); }
  }

  return <div className="space-y-7">
    <header><p className="bitacora text-tabaco/60">Operación por sucursal</p><h1 className="font-display text-4xl text-tabaco">Inventario y recetas</h1>
      <p className="mt-2 text-sm text-tabaco/75">Registra insumos, define cuánto usa cada producto y carga existencias. Una venta de caja descuenta su receta automáticamente.</p></header>
    {outcome && <p role="status" className={`rounded-xl p-3 text-sm ${outcome.ok ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900"}`}>{outcome.message}</p>}
    <StockImport branches={branches} />
    <section className="rounded-3xl bg-papel p-5"><h2 className="text-xl font-semibold text-tabaco">Nuevo insumo o artículo</h2>
      <form className="mt-3 flex flex-wrap gap-3" onSubmit={(e) => { e.preventDefault(); void run(() => upsertStockItemAction({ businessId, name: itemName, unit })); }}>
        <label className="grid gap-1 text-sm">Nombre<input required value={itemName} onChange={(e) => setItemName(e.target.value)} className={inputClass} /></label>
        <label className="grid gap-1 text-sm">Unidad<select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputClass}>{["pieza","g","kg","ml","l"].map((u) => <option key={u}>{u}</option>)}</select></label>
        <button disabled={busy} className="btn self-end bg-tabaco px-5 text-crema">Guardar insumo</button>
      </form></section>
    <section className="rounded-3xl bg-papel p-5"><h2 className="text-xl font-semibold text-tabaco">Cargar o ajustar existencias</h2>
      <p className="mt-1 text-sm text-tabaco/70">Usa una cantidad negativa para registrar merma o corrección. El motivo queda en la bitácora.</p>
      <form className="mt-3 flex flex-wrap gap-3" onSubmit={(e) => { e.preventDefault(); void run(() => adjustStockAction({ branchId, itemId, delta: Number(delta), minimum: Number(minimum), reason })); }}>
        <label className="grid gap-1 text-sm">Sucursal<select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputClass}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label className="grid gap-1 text-sm">Insumo<select value={itemId} onChange={(e) => setItemId(e.target.value)} className={inputClass}>{data.items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}</select></label>
        <label className="grid gap-1 text-sm">Cambio<input required type="number" step="0.001" value={delta} onChange={(e) => setDelta(e.target.value)} className={`${inputClass} w-28`} /></label>
        <label className="grid gap-1 text-sm">Mínimo<input required type="number" min="0" step="0.001" value={minimum} onChange={(e) => setMinimum(e.target.value)} className={`${inputClass} w-28`} /></label>
        <label className="grid gap-1 text-sm">Motivo<input required value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} placeholder="Carga inicial" /></label>
        <button disabled={busy || !data.items.length} className="btn self-end bg-tabaco px-5 text-crema">Registrar movimiento</button>
      </form></section>
    <section className="rounded-3xl bg-papel p-5"><h2 className="text-xl font-semibold text-tabaco">Receta por producto</h2>
      <p className="mt-1 text-sm text-tabaco/70">Añade todos los ingredientes por unidad vendida. Guardar reemplaza la receta anterior; revisa antes de confirmar.</p>
      <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); void run(() => setRecipeAction({ businessId, productId, components: recipeRows.map((r) => ({ item_id: r.itemId, quantity: Number(r.quantity) })) })); }}>
        <label className="grid gap-1 text-sm">Producto<select value={productId} onChange={(e) => {
          const id = e.target.value; setProductId(id);
          const existing = data.recipes.filter((r) => r.product_id === id).map((r, index) => ({ id: index + 1, itemId: r.item_id, quantity: String(r.quantity) }));
          setRecipeRows(existing.length ? existing : [{ id: 1, itemId: data.items[0]?.id ?? "", quantity: "" }]);
        }} className={inputClass}>{data.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        {recipeRows.map((row) => <div key={row.id} className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-sm">Insumo<select value={row.itemId} onChange={(e) => setRecipeRows((current) => current.map((r) => r.id === row.id ? { ...r, itemId: e.target.value } : r))} className={inputClass}>{data.items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}</select></label>
          <label className="grid gap-1 text-sm">Cantidad por venta<input required type="number" min="0.001" step="0.001" value={row.quantity} onChange={(e) => setRecipeRows((current) => current.map((r) => r.id === row.id ? { ...r, quantity: e.target.value } : r))} className={`${inputClass} w-32`} /></label>
          <button type="button" disabled={recipeRows.length === 1} onClick={() => setRecipeRows((current) => current.filter((r) => r.id !== row.id))} className="min-h-11 rounded-xl border border-tabaco/20 px-3 disabled:opacity-40">Quitar</button>
        </div>)}
        <div className="flex gap-2"><button type="button" disabled={recipeRows.length >= 30} onClick={() => { setRecipeRows((current) => [...current, { id: nextRecipeId, itemId: data.items[0]?.id ?? "", quantity: "" }]); setNextRecipeId((n) => n + 1); }} className="min-h-11 rounded-xl border border-tabaco/20 px-3">+ Ingrediente</button>
          <button disabled={busy || !data.items.length || !data.products.length} className="btn bg-tabaco px-5 text-crema">Guardar receta</button></div>
      </form>
      {data.recipes.length > 0 && <ul className="mt-4 text-sm text-tabaco/75">{data.recipes.map((r) => <li key={`${r.product_id}-${r.item_id}`}>{data.products.find((p) => p.id === r.product_id)?.name ?? "Producto"}: {r.quantity} {data.items.find((i) => i.id === r.item_id)?.unit} de {data.items.find((i) => i.id === r.item_id)?.name}</li>)}</ul>}
    </section>
    <section className="rounded-3xl bg-white p-5"><h2 className="text-xl font-semibold text-tabaco">Existencias y alertas</h2>
      {data.balances.length === 0 ? <p className="mt-2 text-sm text-tabaco/70">Aún no hay existencias registradas.</p> : <ul className="mt-4 grid gap-2">{data.balances.map((b) => {
        const low = b.quantity <= b.minimum;
        return <li key={`${b.branch_id}-${b.item_id}`} className={`rounded-xl p-3 text-sm ${low ? "bg-amber-100 text-amber-950" : "bg-crema text-tabaco"}`}>
          <strong>{data.items.find((i) => i.id === b.item_id)?.name}</strong> · {branches.find((x) => x.id === b.branch_id)?.name}: {b.quantity} {data.items.find((i) => i.id === b.item_id)?.unit} · mínimo {b.minimum}{low ? " · Reabastecer" : ""}
        </li>;
      })}</ul>}
    </section>
  </div>;
}
