"use client";

import { useState } from "react";
import type { Branch } from "@/domain/staff/permissions";

type Item = { id: string; name: string; unit: string };
type Balance = { branch_id: string; item_id: string; quantity: number; minimum: number };
type Filter = "all" | "low" | "uncounted";
const PAGE_SIZE = 12;
const searchKey = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-MX");

export function IngredientList({ items, balances, branches, branchId, onAdjust, onEditUnit }: {
  items: Item[]; balances: Balance[]; branches: Branch[]; branchId: string; onAdjust: (itemId: string) => void; onEditUnit: (itemId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const branch = branches.find((entry) => entry.id === branchId);
  const byItem = new Map(balances.filter((entry) => entry.branch_id === branchId).map((entry) => [entry.item_id, entry]));
  const visible = items.filter((item) => {
    const balance = byItem.get(item.id);
    return searchKey(item.name).includes(searchKey(query)) && (filter === "all" || (filter === "uncounted" ? !balance : Boolean(balance && balance.quantity <= balance.minimum)));
  });
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const pageItems = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return <section aria-labelledby="ingredient-list-title" className="workspace-card p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="workspace-kicker">Materia prima y artículos</p><h2 id="ingredient-list-title" className="mt-1 text-2xl font-bold text-slate-950">Lista de insumos</h2>
        <p className="mt-1 text-sm text-slate-600">Existencias de {branch?.name ?? "la sucursal seleccionada"}. Selecciona un insumo para registrar entradas, mermas o ajustar el mínimo.</p></div>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{items.length} insumo{items.length === 1 ? "" : "s"}</span>
    </div>
    <div className="mt-5 flex flex-wrap items-end gap-3">
      <label className="grid min-w-[14rem] flex-1 gap-1 text-sm font-semibold text-slate-700">Buscar insumo
        <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Ej. café molido" className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 font-normal text-slate-950" />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-slate-700">Mostrar
        <select value={filter} onChange={(event) => { setFilter(event.target.value as Filter); setPage(1); }} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 font-normal text-slate-950">
          <option value="all">Todos</option><option value="low">En mínimo o agotados</option><option value="uncounted">Sin conteo</option>
        </select>
      </label>
    </div>
    {!items.length ? <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-700"><strong className="block text-slate-950">Todavía no hay insumos.</strong> Crea el primero en “Gestionar insumos” y después carga su existencia.</div>
      : !visible.length ? <p className="mt-5 text-sm text-slate-600">No hay insumos con ese filtro. Prueba otra búsqueda.</p>
      : <><ul className="mt-4 grid gap-2 md:hidden">{pageItems.map((item) => {
        const balance = byItem.get(item.id);
        const status = !balance ? "Sin conteo" : balance.quantity === 0 ? "Agotado" : balance.quantity <= balance.minimum ? "En mínimo" : "Disponible";
        return <li key={item.id} className="rounded-xl border border-slate-200 p-4 text-sm"><div className="flex items-start justify-between gap-2"><div><strong className="text-slate-950">{item.name}</strong><span className="mt-1 block text-slate-600">Existencia: {balance ? `${balance.quantity} ${item.unit}` : "sin conteo"}</span><span className="block text-slate-600">Mínimo: {balance ? `${balance.minimum} ${item.unit}` : "—"}</span></div><span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${status === "Disponible" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{status}</span></div>
          <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => onAdjust(item.id)} className="min-h-10 rounded-lg px-2 font-bold text-blue-700">Ajustar existencia →</button><button type="button" onClick={() => onEditUnit(item.id)} className="min-h-10 rounded-lg px-2 font-semibold text-slate-700">Corregir unidad</button></div></li>;
      })}</ul><div className="mt-4 hidden overflow-x-auto md:block"><table className="w-full min-w-[38rem] text-left text-sm"><thead className="border-b border-slate-200 text-slate-600"><tr><th scope="col" className="px-2 py-3">Insumo</th><th scope="col" className="px-2 py-3 text-right">Existencia</th><th scope="col" className="px-2 py-3 text-right">Mínimo</th><th scope="col" className="px-2 py-3">Estado</th><th scope="col" className="px-2 py-3 text-right">Acción</th></tr></thead>
        <tbody>{pageItems.map((item) => {
          const balance = byItem.get(item.id);
          const low = balance && balance.quantity <= balance.minimum;
          const status = !balance ? "Sin conteo" : balance.quantity === 0 ? "Agotado" : low ? "En mínimo" : "Disponible";
          return <tr key={item.id} className="border-b border-slate-100 last:border-0"><th scope="row" className="px-2 py-3 font-semibold text-slate-950">{item.name}<span className="block text-xs font-normal text-slate-500">{item.unit}</span></th>
            <td className="px-2 py-3 text-right tabular-nums text-slate-900">{balance ? `${balance.quantity} ${item.unit}` : "—"}</td><td className="px-2 py-3 text-right tabular-nums text-slate-600">{balance ? `${balance.minimum} ${item.unit}` : "—"}</td>
            <td className="px-2 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${status === "Disponible" ? "bg-emerald-50 text-emerald-800" : status === "Sin conteo" ? "bg-slate-100 text-slate-700" : "bg-amber-50 text-amber-900"}`}>{status}</span></td>
            <td className="px-2 py-3 text-right"><div className="flex justify-end gap-2"><button type="button" onClick={() => onEditUnit(item.id)} className="min-h-10 rounded-lg px-2 font-semibold text-slate-700 hover:bg-slate-50">Unidad</button><button type="button" onClick={() => onAdjust(item.id)} className="min-h-10 rounded-lg px-2 font-semibold text-blue-700 hover:bg-blue-50">Ajustar →</button></div></td></tr>;
        })}</tbody></table></div></>}
    {pages > 1 && <nav aria-label="Páginas de insumos" className="mt-4 flex items-center justify-between text-sm"><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="font-semibold text-blue-700 disabled:opacity-40">← Anterior</button><span>Página {currentPage} de {pages}</span><button type="button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)} className="font-semibold text-blue-700 disabled:opacity-40">Siguiente →</button></nav>}
  </section>;
}
