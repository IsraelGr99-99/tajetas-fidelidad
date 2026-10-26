"use client";

import { useState } from "react";
import { adjustStockAction, setRecipeAction, upsertStockItemAction, type CheckoutResult } from "@/actions/checkout";
import type { Branch } from "@/domain/staff/permissions";
import { InventoryOverview } from "./InventoryOverview";
import { StockImport } from "./StockImport";

type Data = {
  items: { id: string; name: string; unit: string }[];
  balances: { branch_id: string; item_id: string; quantity: number; minimum: number }[];
  recipes: { product_id: string; item_id: string; quantity: number }[];
  products: { id: string; name: string }[];
};
type CatalogProduct = { id: string; name: string; category: string; price_cents: number; cost_cents: number | null; active: boolean };
const inputClass = "min-h-11 rounded-xl border border-tabaco/20 bg-white px-3 text-tabaco";

export function InventoryManager({ businessId, branches, data, catalog }: { businessId: string; branches: Branch[]; data: Data; catalog: CatalogProduct[] | null }) {
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
  const [recipeFilter, setRecipeFilter] = useState("");
  const [recipePage, setRecipePage] = useState(1);
  const lowBalances = data.balances.filter((balance) => balance.quantity <= balance.minimum);
  const recipesByProduct = data.products.filter((product) => data.recipes.some((recipe) => recipe.product_id === product.id) && product.name.toLocaleLowerCase("es-MX").includes(recipeFilter.toLocaleLowerCase("es-MX")));
  const recipePages = Math.max(1, Math.ceil(recipesByProduct.length / 8));
  const currentRecipePage = Math.min(recipePage, recipePages);

  async function run(action: () => Promise<CheckoutResult>) {
    setBusy(true);
    try { setOutcome(await action()); } catch { setOutcome({ ok: false, message: "No se pudo contactar al servidor." }); }
    finally { setBusy(false); }
  }

  return <div className="space-y-7">
    <header><p className="workspace-kicker">Control del negocio · por sucursal</p><h1 className="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">Inventario y recetas</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Prepara los insumos, registra existencias por sucursal y define las recetas. Cada venta en caja descuenta automáticamente los ingredientes correspondientes.</p></header>
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="workspace-card p-4"><p className="workspace-kicker">Insumos</p><p className="mt-2 text-2xl font-bold text-slate-950">{data.items.length}</p><a href="#insumos" className="mt-2 inline-block text-sm font-semibold text-blue-700 hover:underline">Administrar →</a></div>
      <div className="workspace-card p-4"><p className="workspace-kicker">Alertas de mínimo</p><p className={`mt-2 text-2xl font-bold ${lowBalances.length ? "text-amber-700" : "text-slate-950"}`}>{lowBalances.length}</p><a href="#vista-inventario" className="mt-2 inline-block text-sm font-semibold text-blue-700 hover:underline">Ver existencias →</a></div>
      <div className="workspace-card p-4"><p className="workspace-kicker">Productos con receta</p><p className="mt-2 text-2xl font-bold text-slate-950">{new Set(data.recipes.map((recipe) => recipe.product_id)).size} / {data.products.length}</p><a href="#recetas" className="mt-2 inline-block text-sm font-semibold text-blue-700 hover:underline">Configurar →</a></div>
    </div>
    <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-950"><strong>Para empezar:</strong> 1. Crea un insumo. 2. Carga su existencia y mínimo por sucursal. 3. Asócialo a un producto mediante una receta. También puedes importar el conteo desde Excel al final de esta página.</p>
    {outcome && <p role="status" className={`rounded-xl p-3 text-sm ${outcome.ok ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900"}`}>{outcome.message}</p>}
    <InventoryOverview branches={branches} products={catalog} items={data.items} recipes={data.recipes} balances={data.balances} />
    <section id="insumos" className="workspace-card scroll-mt-24 p-5"><p className="workspace-kicker">Paso 1</p><h2 className="mt-1 text-xl font-semibold text-tabaco">Nuevo insumo o artículo</h2>
      <form className="mt-3 flex flex-wrap gap-3" onSubmit={(e) => { e.preventDefault(); void run(() => upsertStockItemAction({ businessId, name: itemName, unit })); }}>
        <label className="grid gap-1 text-sm">Nombre<input required value={itemName} onChange={(e) => setItemName(e.target.value)} className={inputClass} /></label>
        <label className="grid gap-1 text-sm">Unidad<select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputClass}>{["pieza","g","kg","ml","l"].map((u) => <option key={u}>{u}</option>)}</select></label>
        <button disabled={busy} className="btn self-end bg-tabaco px-5 text-crema">Guardar insumo</button>
      </form></section>
    <section className="workspace-card p-5"><p className="workspace-kicker">Paso 2</p><h2 className="mt-1 text-xl font-semibold text-tabaco">Cargar o ajustar existencias</h2>
      <p className="mt-1 text-sm text-tabaco/70">Usa una cantidad negativa para registrar merma o corrección. El motivo queda en la bitácora.</p>
      <form className="mt-3 flex flex-wrap gap-3" onSubmit={(e) => { e.preventDefault(); void run(() => adjustStockAction({ branchId, itemId, delta: Number(delta), minimum: Number(minimum), reason })); }}>
        <label className="grid gap-1 text-sm">Sucursal<select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputClass}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label className="grid gap-1 text-sm">Insumo<select value={itemId} onChange={(e) => setItemId(e.target.value)} className={inputClass}>{data.items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}</select></label>
        <label className="grid gap-1 text-sm">Cambio<input required type="number" step="0.001" value={delta} onChange={(e) => setDelta(e.target.value)} className={`${inputClass} w-28`} /></label>
        <label className="grid gap-1 text-sm">Mínimo<input required type="number" min="0" step="0.001" value={minimum} onChange={(e) => setMinimum(e.target.value)} className={`${inputClass} w-28`} /></label>
        <label className="grid gap-1 text-sm">Motivo<input required value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} placeholder="Carga inicial" /></label>
        <button disabled={busy || !data.items.length} className="btn self-end bg-tabaco px-5 text-crema">Registrar movimiento</button>
      </form></section>
    <section id="recetas" className="workspace-card scroll-mt-24 p-5"><p className="workspace-kicker">Paso 3</p><h2 className="mt-1 text-xl font-semibold text-tabaco">Receta por producto</h2>
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
      {data.recipes.length > 0 && <div className="mt-6 border-t border-slate-200 pt-5"><div className="flex flex-wrap items-end justify-between gap-3"><h3 className="text-lg font-semibold text-slate-950">Recetas configuradas ({recipesByProduct.length})</h3><label className="grid gap-1 text-sm text-slate-700">Filtrar producto<input type="search" value={recipeFilter} onChange={(e) => { setRecipeFilter(e.target.value); setRecipePage(1); }} className={inputClass} /></label></div>
        <ul className="mt-3 grid gap-2">{recipesByProduct.slice((currentRecipePage - 1) * 8, currentRecipePage * 8).map((product) => <li key={product.id} className="rounded-xl border border-slate-200 p-3 text-sm"><strong className="text-slate-950">{product.name}</strong><p className="mt-1 text-slate-600">{data.recipes.filter((r) => r.product_id === product.id).map((r) => `${r.quantity} ${data.items.find((i) => i.id === r.item_id)?.unit ?? ""} ${data.items.find((i) => i.id === r.item_id)?.name ?? "insumo"}`).join(" · ")}</p><button type="button" onClick={() => { setProductId(product.id); setRecipeRows(data.recipes.filter((r) => r.product_id === product.id).map((r, index) => ({ id: index + 1, itemId: r.item_id, quantity: String(r.quantity) }))); document.getElementById("recetas")?.scrollIntoView({ behavior: "smooth" }); }} className="mt-2 font-semibold text-blue-700">Editar receta</button></li>)}</ul>
        {recipePages > 1 && <nav aria-label="Páginas de recetas" className="mt-4 flex items-center justify-between text-sm"><button type="button" disabled={currentRecipePage === 1} onClick={() => setRecipePage(currentRecipePage - 1)} className="font-semibold text-blue-700 disabled:opacity-40">← Anterior</button><span>Página {currentRecipePage} de {recipePages}</span><button type="button" disabled={currentRecipePage === recipePages} onClick={() => setRecipePage(currentRecipePage + 1)} className="font-semibold text-blue-700 disabled:opacity-40">Siguiente →</button></nav>}
      </div>}
    </section>
    <section aria-labelledby="import-title"><div className="mb-3"><p className="workspace-kicker">Carga masiva</p><h2 id="import-title" className="mt-1 text-xl font-semibold text-slate-950">Importar conteo desde Excel</h2><p className="mt-1 text-sm text-slate-600">Úsalo cuando ya tienes un archivo con las existencias de una sucursal.</p></div><StockImport branches={branches} /></section>
  </div>;
}
