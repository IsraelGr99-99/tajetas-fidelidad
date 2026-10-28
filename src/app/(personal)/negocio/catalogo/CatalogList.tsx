"use client";

import Link from "next/link";
import { useState } from "react";
import { ProductThumbnail } from "@/components/staff/ProductThumbnail";
import { formatMxn } from "@/lib/format";
import { ProductForm } from "./ProductForm";

export type CatalogRow = { id: string; name: string; base_name?: string; variant_label?: string | null; category: string;
  price_cents: number; cost_cents: number | null; eligible: boolean; active: boolean; image_url: string | null };
const PAGE_SIZE = 10;
const key = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-MX");

export function CatalogList({ products, categories, recipes }: { products: CatalogRow[]; categories: string[]; recipes: { product_id: string; item_id: string }[] | null }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const visible = products.filter((p) => (!category || p.category === category) && key(p.name).includes(key(query)));
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  return <section aria-labelledby="lista-productos">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="lista-productos" className="text-2xl text-tabaco">Productos ({products.length})</h2><p className="text-sm text-tabaco/70">Selecciona un producto para editar su precio, medida o categoría.</p></div>
      <div className="flex flex-wrap gap-2">
        <label className="grid gap-1 text-sm text-tabaco">Buscar producto<input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} className="min-h-11 rounded-xl border border-tabaco/20 bg-white px-3" /></label>
        <label className="grid gap-1 text-sm text-tabaco">Categoría<select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="min-h-11 rounded-xl border border-tabaco/20 bg-white px-3"><option value="">Todas</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
      </div>
    </div>
    {products.length === 0 ? <p className="mt-3 text-tabaco/75">Aún no hay productos. Importa tu lista o agrégalos a mano.</p> : visible.length === 0 ? <p className="mt-3 text-tabaco/75">No hay productos con ese filtro.</p> : <>
      <ul className="mt-4 space-y-2">{visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((p) => {
        const margin = p.cost_cents !== null && p.price_cents > 0 ? Math.round(((p.price_cents - p.cost_cents) / p.price_cents) * 100) : null;
        const ingredientCount = recipes?.filter((recipe) => recipe.product_id === p.id).length ?? null;
        return <li key={p.id} className={`rounded-2xl border border-tabaco/10 bg-papel ${p.active ? "" : "opacity-75"}`}>
          <details><summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4"><span className="flex min-w-0 items-center gap-3"><ProductThumbnail src={p.image_url} size={52} /><span className="min-w-0"><span className="font-semibold text-tabaco">{p.name}</span><span className="block text-sm text-tabaco/75">{p.category} · {p.eligible ? "suma sello" : "no suma"}{p.active ? "" : " · no disponible"}</span></span></span><span className="shrink-0 text-right text-sm"><span className="block font-semibold text-tabaco">{formatMxn(p.price_cents)}</span><span className="text-tabaco/75">{margin !== null ? `margen ${margin} %` : "sin costo"}</span></span></summary>
            <div className="border-t border-tabaco/10 p-4"><ProductForm product={{ id: p.id, baseName: p.base_name ?? p.name, variantLabel: p.variant_label ?? null, category: p.category, priceCents: p.price_cents, costCents: p.cost_cents, eligible: p.eligible, active: p.active, imageUrl: p.image_url }} categories={categories} /></div>
          </details>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-tabaco/10 px-4 py-2 text-sm">
            <span className={ingredientCount === 0 ? "font-semibold text-amber-800" : "text-slate-600"}>{ingredientCount === null ? "Receta no disponible en este momento" : ingredientCount > 0 ? `Receta vinculada · ${ingredientCount} ${ingredientCount === 1 ? "insumo" : "insumos"}` : "Sin receta: configura los insumos antes de vender"}</span>
            <Link href={`/negocio/inventario?vista=recetas&producto=${encodeURIComponent(p.id)}#recipe-editor`} className="inline-flex min-h-10 items-center rounded-lg px-2 font-bold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600">{ingredientCount === 0 ? "Crear receta →" : "Ver o editar receta →"}</Link>
          </div>
        </li>;
      })}</ul>
      {pages > 1 && <nav aria-label="Páginas del catálogo" className="mt-4 flex items-center justify-between text-sm"><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="font-semibold text-blue-700 disabled:opacity-40">← Anterior</button><span>Página {currentPage} de {pages}</span><button type="button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)} className="font-semibold text-blue-700 disabled:opacity-40">Siguiente →</button></nav>}
    </>}
  </section>;
}
