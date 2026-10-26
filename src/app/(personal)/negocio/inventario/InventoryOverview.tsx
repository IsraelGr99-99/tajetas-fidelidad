"use client";

import { useState } from "react";
import { estimateProductAvailability, type RecipePart, type StockBalance } from "@/domain/inventory/availability";
import { formatMxn } from "@/lib/format";

type Product = { id: string; name: string; category: string; price_cents: number; cost_cents: number | null; active: boolean };
type Item = { id: string; name: string; unit: string };
const PAGE_SIZE = 10;
const key = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-MX");

export function InventoryOverview({ branchId, products, items, recipes, balances }: {
  branchId: string; products: Product[] | null; items: Item[]; recipes: RecipePart[]; balances: StockBalance[];
}) {
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const selectedBalances = balances.filter((b) => b.branch_id === branchId);
  const low = selectedBalances.filter((b) => b.quantity <= b.minimum).length;
  const withoutCount = items.filter((item) => !selectedBalances.some((b) => b.item_id === item.id)).length;
  const withoutRecipe = products?.filter((product) => product.active && !recipes.some((r) => r.product_id === product.id)).length ?? 0;
  const filtered = products?.filter((product) => key(`${product.name} ${product.category}`).includes(key(filter))) ?? [];
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);

  return <section id="vista-inventario" aria-labelledby="vista-inventario-title" className="workspace-card scroll-mt-24 p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="workspace-kicker">Vista general</p><h2 id="vista-inventario-title" className="mt-1 text-2xl font-semibold text-slate-950">Inventario por sucursal</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">Precios del catálogo y disponibilidad estimada según las recetas. La base verifica el stock real al confirmar una venta.</p></div>
    </div>
    <dl className="mt-5 grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl bg-amber-50 p-4"><dt className="text-sm text-amber-900">Insumos en mínimo</dt><dd className="mt-1 text-2xl font-bold tabular-nums text-amber-950">{low}</dd></div>
      <div className="rounded-xl bg-slate-50 p-4"><dt className="text-sm text-slate-700">Sin conteo de existencias</dt><dd className="mt-1 text-2xl font-bold tabular-nums text-slate-950">{withoutCount}</dd></div>
      <div className="rounded-xl bg-slate-50 p-4"><dt className="text-sm text-slate-700">Productos sin receta</dt><dd className="mt-1 text-2xl font-bold tabular-nums text-slate-950">{withoutRecipe}</dd></div>
    </dl>
    {products === null ? <p role="alert" className="mt-5 text-sm text-red-700">No se pudieron cargar los precios y productos. Actualiza la página.</p> : <>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div><h3 className="text-lg font-semibold text-slate-950">Productos vendibles ({products.length})</h3><p className="text-xs text-slate-600">La disponibilidad se expresa en unidades vendibles, no en gramos o mililitros.</p></div>
        <label className="grid gap-1 text-sm text-slate-700">Filtrar por nombre o categoría
          <input type="search" value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-slate-950" />
        </label>
      </div>
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[42rem] text-left text-sm"><thead className="border-b border-slate-200 text-slate-600"><tr><th className="px-2 py-2">Producto</th><th className="px-2 py-2">Categoría</th><th className="px-2 py-2 text-right">Precio</th><th className="px-2 py-2 text-right">Costo</th><th className="px-2 py-2 text-right">Disponibles</th><th className="px-2 py-2">Estado</th></tr></thead>
        <tbody>{filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((product) => {
          const available = estimateProductAvailability(product.id, branchId, recipes, balances);
          const status = !product.active ? "Inactivo" : available === null ? "Sin receta" : available === 0 ? "Sin stock" : "Listo";
          return <tr key={product.id} className="border-b border-slate-100"><th scope="row" className="px-2 py-3 font-semibold text-slate-950">{product.name}</th><td className="px-2 py-3">{product.category}</td><td className="px-2 py-3 text-right tabular-nums">{formatMxn(product.price_cents)}</td><td className="px-2 py-3 text-right tabular-nums">{product.cost_cents === null ? "—" : formatMxn(product.cost_cents)}</td><td className="px-2 py-3 text-right tabular-nums">{available === null ? "—" : available}</td><td className={`px-2 py-3 ${status === "Listo" ? "text-green-800" : "text-amber-800"}`}>{status}</td></tr>;
        })}</tbody></table></div>
      {!filtered.length && <p className="mt-3 text-sm text-slate-600">No hay productos con ese filtro.</p>}
      {pages > 1 && <nav aria-label="Páginas de productos" className="mt-4 flex items-center justify-between text-sm"><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="font-semibold text-blue-700 disabled:opacity-40">← Anterior</button><span>Página {currentPage} de {pages}</span><button type="button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)} className="font-semibold text-blue-700 disabled:opacity-40">Siguiente →</button></nav>}
    </>}
  </section>;
}
