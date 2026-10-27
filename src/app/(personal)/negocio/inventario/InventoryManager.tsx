"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adjustStockAction, setRecipeAction, upsertStockItemAction, type CheckoutResult } from "@/actions/checkout";
import type { Branch } from "@/domain/staff/permissions";
import { IngredientList } from "./IngredientList";
import { InventoryOverview } from "./InventoryOverview";
import { StockImport } from "./StockImport";

type Data = {
  items: { id: string; name: string; unit: string }[];
  balances: { branch_id: string; item_id: string; quantity: number; minimum: number }[];
  recipes: { product_id: string; item_id: string; quantity: number }[];
  products: { id: string; name: string }[];
};
type CatalogProduct = { id: string; name: string; category: string; price_cents: number; cost_cents: number | null; active: boolean };
type View = "stock" | "manage" | "recipes";
type ManageMode = "create" | "adjust" | "import";
type RecipeRow = { id: number; itemId: string; quantity: string };
const inputClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-950";
const secondaryClass = "min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-blue-400 hover:text-blue-700";

export function InventoryManager({ businessId, branches, initialBranchId, initialView, initialManageMode, data, catalog }: {
  businessId: string; branches: Branch[]; initialBranchId: string | null; initialView: View; initialManageMode: ManageMode; data: Data; catalog: CatalogProduct[] | null;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>(initialView);
  const [manageMode, setManageMode] = useState<ManageMode>(initialManageMode);
  const [branchId, setBranchId] = useState(initialBranchId ?? branches[0]?.id ?? "");
  const [itemName, setItemName] = useState("");
  const [unit, setUnit] = useState("pieza");
  const [itemId, setItemId] = useState(data.items[0]?.id ?? "");
  const [delta, setDelta] = useState("");
  const [minimum, setMinimum] = useState("0");
  const [reason, setReason] = useState("");
  const [productId, setProductId] = useState(data.products[0]?.id ?? "");
  const [recipeRows, setRecipeRows] = useState<RecipeRow[]>(() => rowsForProduct(data, data.products[0]?.id ?? ""));
  const [nextRecipeId, setNextRecipeId] = useState(31);
  const [recipeFilter, setRecipeFilter] = useState("");
  const [recipePage, setRecipePage] = useState(1);
  const [outcome, setOutcome] = useState<CheckoutResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [justCreated, setJustCreated] = useState<{ id: string; name: string; unit: string } | null>(null);
  const items = justCreated && !data.items.some((item) => item.id === justCreated.id)
    ? [...data.items, justCreated] : data.items;

  const branch = branches.find((entry) => entry.id === branchId);
  const lowBalances = data.balances.filter((balance) => balance.branch_id === branchId && balance.quantity <= balance.minimum);
  const missingBalances = items.filter((item) => !data.balances.some((balance) => balance.branch_id === branchId && balance.item_id === item.id));
  const recipesByProduct = data.products.filter((product) => data.recipes.some((recipe) => recipe.product_id === product.id)
    && product.name.toLocaleLowerCase("es-MX").includes(recipeFilter.toLocaleLowerCase("es-MX")));
  const recipePages = Math.max(1, Math.ceil(recipesByProduct.length / 8));
  const currentRecipePage = Math.min(recipePage, recipePages);

  function chooseItem(id: string) {
    setItemId(id);
    const balance = data.balances.find((entry) => entry.branch_id === branchId && entry.item_id === id);
    setMinimum(String(balance?.minimum ?? 0));
    setDelta("");
  }

  function openAdjustment(id: string) {
    chooseItem(id);
    setManageMode("adjust");
    setView("manage");
    setOutcome(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    requestAnimationFrame(() => document.getElementById("manage-heading")?.focus());
  }

  function chooseProduct(id: string) {
    setProductId(id);
    setRecipeRows(rowsForProduct(data, id));
  }

  async function run(action: () => Promise<CheckoutResult>, onSuccess?: (result: CheckoutResult) => void) {
    setBusy(true);
    try {
      const result = await action();
      setOutcome(result);
      if (result.ok) { onSuccess?.(result); router.refresh(); }
    } catch {
      setOutcome({ ok: false, message: "No se pudo contactar al servidor. Intenta de nuevo." });
    } finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="workspace-kicker">Control del negocio</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">Inventario</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Consulta existencias, registra movimientos y configura recetas. La caja descuenta los ingredientes al confirmar una venta.</p></div>
      <label className="grid gap-1 text-sm font-semibold text-slate-700">Sucursal de trabajo
        <select value={branchId} onChange={(event) => { setBranchId(event.target.value); setOutcome(null); }} className={`${inputClass} min-w-52`}>
          {branches.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        </select>
      </label>
    </header>

    <nav aria-label="Secciones del inventario" className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-2 sm:grid-cols-3">
      {([
        ["stock", "Ver existencias", `${items.length} insumos · ${lowBalances.length} en mínimo`],
        ["manage", "Agregar o corregir", "Insumos y cantidades"],
        ["recipes", "Recetas", `${new Set(data.recipes.map((recipe) => recipe.product_id)).size} de ${data.products.length} productos`],
      ] as const).map(([key, label, hint]) => <button key={key} type="button" aria-pressed={view === key} onClick={() => { setView(key); setOutcome(null); }}
        className={`min-h-16 rounded-xl px-4 py-3 text-left transition ${view === key ? "bg-[#14233b] text-white shadow-sm" : "text-slate-700 hover:bg-slate-50"}`}>
        <span className="block text-sm font-bold">{label}</span><span className={`mt-1 block text-xs ${view === key ? "text-slate-200" : "text-slate-500"}`}>{hint}</span>
      </button>)}</nav>

    {outcome && <p role="status" className={`rounded-xl border px-4 py-3 text-sm ${outcome.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}>{outcome.message}</p>}

    {view === "stock" && <div className="space-y-5">
      <IngredientList items={items} balances={data.balances} branches={branches} branchId={branchId} onAdjust={openAdjustment} />
      <div className="grid gap-3 sm:grid-cols-2">
        <StatusCard label="En mínimo o agotados" value={lowBalances.length} attention={lowBalances.length > 0} />
        <StatusCard label="Sin conteo en esta sucursal" value={missingBalances.length} attention={missingBalances.length > 0} />
      </div>
      <InventoryOverview branchId={branchId} products={catalog} items={items} recipes={data.recipes} balances={data.balances} />
      <div className="flex flex-wrap gap-3"><button type="button" onClick={() => { setManageMode("create"); setView("manage"); }} className="workspace-action">+ Crear insumo</button>
        <button type="button" onClick={() => setView("recipes")} className={secondaryClass}>Configurar recetas →</button></div>
    </div>}

    {view === "manage" && <div className="space-y-5">
      <div className="workspace-card p-5 sm:p-6"><p className="workspace-kicker">Insumos de {branch?.name ?? "la sucursal"}</p><h2 id="manage-heading" tabIndex={-1} className="mt-1 text-2xl font-bold text-slate-950">Gestionar insumos</h2>
        <p className="mt-1 text-sm text-slate-600">Crea un insumo una sola vez. Las existencias y el mínimo se registran por sucursal.</p>
        <div className="mt-5 flex flex-wrap gap-2" aria-label="Acciones de insumos">
          {([
            ["create", "Nuevo insumo"], ["adjust", "Registrar movimiento"], ["import", "Importar Excel"],
          ] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={manageMode === key} onClick={() => { setManageMode(key); setOutcome(null); }}
            className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${manageMode === key ? "bg-blue-50 text-blue-800 ring-1 ring-blue-200" : "text-slate-600 hover:bg-slate-50"}`}>{label}</button>)}
        </div>
        {manageMode === "create" && <form className="mt-6 grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-[minmax(0,1fr)_11rem_auto] sm:items-end" onSubmit={(event) => { event.preventDefault(); void run(() => upsertStockItemAction({ businessId, name: itemName, unit }), (result) => { if (result.itemId) { setJustCreated({ id: result.itemId, name: itemName.trim(), unit }); chooseItem(result.itemId); setManageMode("adjust"); } setItemName(""); }); }}>
          <label className="grid gap-1 text-sm font-semibold text-slate-700">Nombre del insumo<input required minLength={2} maxLength={100} value={itemName} onChange={(event) => setItemName(event.target.value)} placeholder="Ej. café molido" className={inputClass} /></label>
          <label className="grid gap-1 text-sm font-semibold text-slate-700">Unidad<select value={unit} onChange={(event) => setUnit(event.target.value)} className={inputClass}>{["pieza", "g", "kg", "ml", "l"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <button disabled={busy} className="workspace-action disabled:opacity-50">Guardar insumo</button>
        </form>}
        {manageMode === "adjust" && <form className="mt-6 space-y-4 border-t border-slate-200 pt-5" onSubmit={(event) => { event.preventDefault(); void run(() => adjustStockAction({ branchId, itemId, delta: Number(delta), minimum: Number(minimum), reason }), () => { setDelta(""); setReason(""); }); }}>
          {!items.length ? <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Primero crea un insumo o importa un conteo.</p> : <>
            <label className="grid max-w-xl gap-1 text-sm font-semibold text-slate-700">Insumo<select value={itemId} onChange={(event) => chooseItem(event.target.value)} className={inputClass}>{items.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}</select></label>
            <p className="text-sm text-slate-600">El movimiento se registrará en <strong>{branch?.name ?? "la sucursal seleccionada"}</strong>. Puedes cambiarla arriba.</p>
            <div className="grid gap-4 sm:grid-cols-3"><label className="grid gap-1 text-sm font-semibold text-slate-700">Cambio de existencia<input required type="number" step="0.001" value={delta} onChange={(event) => setDelta(event.target.value)} placeholder="Ej. 10 o -2" className={inputClass} /></label>
              <label className="grid gap-1 text-sm font-semibold text-slate-700">Mínimo para alertar<input required type="number" min="0" step="0.001" value={minimum} onChange={(event) => setMinimum(event.target.value)} className={inputClass} /></label>
              <label className="grid gap-1 text-sm font-semibold text-slate-700">Motivo<input required minLength={3} maxLength={200} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Compra, merma, corrección…" className={inputClass} /></label></div>
            <p className="text-sm text-slate-600">Escribe una cantidad positiva para agregar o negativa para retirar. El movimiento queda en la bitácora; el mínimo no se suma al stock.</p>
            <button disabled={busy || !branchId || !itemId} className="workspace-action disabled:opacity-50">Registrar movimiento</button>
          </>}
        </form>}
      </div>
      {manageMode === "import" && <StockImport key={branchId} branches={branches} initialBranchId={branchId} onImported={setBranchId} />}
      <button type="button" onClick={() => setView("stock")} className={secondaryClass}>← Volver a la lista de insumos</button>
    </div>}

    {view === "recipes" && <div className="space-y-5">
      <div className="workspace-card p-5 sm:p-6"><p className="workspace-kicker">Descuento automático en caja</p><h2 className="mt-1 text-2xl font-bold text-slate-950">Recetas por producto y tamaño</h2>
        <p className="mt-1 text-sm text-slate-600">Cada variante del catálogo tiene su propia receta. Al vender una unidad, la caja descuenta exactamente los insumos indicados.</p>
        {!data.products.length ? <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">Primero agrega productos en <a href="/negocio/catalogo" className="font-bold underline">Catálogo y precios</a>.</p> : !data.items.length ? <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">Primero crea un insumo en “Gestionar insumos”.</p> :
          <form id="recipe-editor" className="mt-5 space-y-4 scroll-mt-28 border-t border-slate-200 pt-5" onSubmit={(event) => { event.preventDefault(); void run(() => setRecipeAction({ businessId, productId, components: recipeRows.map((row) => ({ item_id: row.itemId, quantity: Number(row.quantity) })) })); }}>
            <label className="grid max-w-xl gap-1 text-sm font-semibold text-slate-700">Producto o variante<select value={productId} onChange={(event) => chooseProduct(event.target.value)} className={inputClass}>{data.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
            <div className="space-y-3">{recipeRows.map((row) => <div key={row.id} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
              <label className="grid gap-1 text-sm font-semibold text-slate-700">Insumo<select value={row.itemId} onChange={(event) => setRecipeRows((current) => current.map((entry) => entry.id === row.id ? { ...entry, itemId: event.target.value } : entry))} className={inputClass}>{data.items.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}</select></label>
              <label className="grid gap-1 text-sm font-semibold text-slate-700">Cantidad por venta<input required type="number" min="0.001" step="0.001" value={row.quantity} onChange={(event) => setRecipeRows((current) => current.map((entry) => entry.id === row.id ? { ...entry, quantity: event.target.value } : entry))} className={inputClass} /></label>
              <button type="button" disabled={recipeRows.length === 1} onClick={() => setRecipeRows((current) => current.filter((entry) => entry.id !== row.id))} className={`${secondaryClass} disabled:opacity-40`}>Quitar</button>
            </div>)}</div>
            <div className="flex flex-wrap gap-2"><button type="button" disabled={recipeRows.length >= 30} onClick={() => { setRecipeRows((current) => [...current, { id: nextRecipeId, itemId: data.items[0]?.id ?? "", quantity: "" }]); setNextRecipeId((value) => value + 1); }} className={secondaryClass}>+ Otro ingrediente</button>
              <button disabled={busy} className="workspace-action disabled:opacity-50">Guardar receta</button></div>
            <p className="text-xs text-slate-600">Guardar reemplaza la receta anterior del producto seleccionado. Revisa todos los ingredientes antes de confirmar.</p>
          </form>}
      </div>
      {data.recipes.length > 0 && <section className="workspace-card p-5 sm:p-6" aria-labelledby="configured-recipes-title"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="configured-recipes-title" className="text-xl font-bold text-slate-950">Recetas configuradas ({recipesByProduct.length})</h2><p className="mt-1 text-sm text-slate-600">Abre una para revisar o editar sus ingredientes.</p></div>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">Buscar producto<input type="search" value={recipeFilter} onChange={(event) => { setRecipeFilter(event.target.value); setRecipePage(1); }} className={inputClass} /></label></div>
        {!recipesByProduct.length ? <p className="mt-4 text-sm text-slate-600">No hay recetas con ese filtro.</p> : <ul className="mt-4 grid gap-2">{recipesByProduct.slice((currentRecipePage - 1) * 8, currentRecipePage * 8).map((product) => <li key={product.id} className="rounded-xl border border-slate-200 p-4 text-sm"><strong className="text-slate-950">{product.name}</strong>
          <p className="mt-1 text-slate-600">{data.recipes.filter((recipe) => recipe.product_id === product.id).map((recipe) => `${recipe.quantity} ${data.items.find((item) => item.id === recipe.item_id)?.unit ?? ""} ${data.items.find((item) => item.id === recipe.item_id)?.name ?? "insumo"}`).join(" · ")}</p>
          <button type="button" onClick={() => { chooseProduct(product.id); document.getElementById("recipe-editor")?.scrollIntoView({ behavior: "smooth" }); }} className="mt-2 min-h-10 font-bold text-blue-700">Editar receta →</button></li>)}</ul>}
        {recipePages > 1 && <nav aria-label="Páginas de recetas" className="mt-4 flex items-center justify-between text-sm"><button type="button" disabled={currentRecipePage === 1} onClick={() => setRecipePage(currentRecipePage - 1)} className="font-bold text-blue-700 disabled:opacity-40">← Anterior</button><span>Página {currentRecipePage} de {recipePages}</span><button type="button" disabled={currentRecipePage === recipePages} onClick={() => setRecipePage(currentRecipePage + 1)} className="font-bold text-blue-700 disabled:opacity-40">Siguiente →</button></nav>}
      </section>}
    </div>}
  </div>;
}

function rowsForProduct(data: Data, id: string): RecipeRow[] {
  const existing = data.recipes.filter((recipe) => recipe.product_id === id).map((recipe, index) => ({ id: index + 1, itemId: recipe.item_id, quantity: String(recipe.quantity) }));
  return existing.length ? existing : [{ id: 1, itemId: data.items[0]?.id ?? "", quantity: "" }];
}

function StatusCard({ label, value, attention = false }: { label: string; value: number; attention?: boolean }) {
  return <div className={`workspace-card p-4 ${attention ? "border-amber-200 bg-amber-50" : ""}`}><p className="text-sm font-semibold text-slate-600">{label}</p><p className={`mt-1 text-2xl font-bold tabular-nums ${attention ? "text-amber-900" : "text-slate-950"}`}>{value}</p></div>;
}
