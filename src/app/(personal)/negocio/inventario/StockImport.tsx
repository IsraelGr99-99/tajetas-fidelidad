"use client";

import { useState } from "react";
import { importStockCountAction } from "@/actions/checkout";
import type { Branch } from "@/domain/staff/permissions";
import { normalizeHeader, toCsv, type Cell } from "@/domain/imports/spreadsheet";
import { downloadCsv, readSpreadsheet } from "@/lib/read-spreadsheet";

type Row = { name: string; unit: "pieza" | "g" | "kg" | "ml" | "l"; quantity: number; minimum: number };
const columns = ["insumo", "unidad", "existencia", "minimo"] as const;

function parseStock(matrix: Cell[][]): { rows: Row[]; errors: string[] } {
  const headers = (matrix[0] ?? []).map(normalizeHeader);
  const positions = columns.map((c) => headers.indexOf(c));
  if (positions.some((n) => n < 0)) return { rows: [], errors: [`Faltan columnas: ${columns.filter((_, i) => positions[i] < 0).join(", ")}`] };
  const rows: Row[] = []; const errors: string[] = [];
  for (const [index, cells] of matrix.slice(1).entries()) {
    if (cells.every((cell) => cell == null || String(cell).trim() === "")) continue;
    const name = String(cells[positions[0]] ?? "").trim();
    const unit = String(cells[positions[1]] ?? "").trim().toLowerCase();
    const quantityText = String(cells[positions[2]] ?? "").trim().replace(",", ".");
    const minimumText = String(cells[positions[3]] ?? "").trim().replace(",", ".");
    const quantity = Number(quantityText);
    const minimum = Number(minimumText);
    if (name.length < 2 || name.length > 100 || !["pieza", "g", "kg", "ml", "l"].includes(unit)
      || !quantityText || !minimumText
      || !Number.isFinite(quantity) || quantity < 0 || quantity > 1000000 || !Number.isFinite(minimum) || minimum < 0 || minimum > 1000000
      || Math.abs(Math.round(quantity * 1000) - quantity * 1000) > 1e-7
      || Math.abs(Math.round(minimum * 1000) - minimum * 1000) > 1e-7) {
      errors.push(`Fila ${index + 2}: nombre, unidad o cantidades inválidas.`); continue;
    }
    rows.push({ name, unit: unit as Row["unit"], quantity, minimum });
  }
  if (rows.length > 500) errors.push("Máximo 500 filas por archivo.");
  if (new Set(rows.map((r) => r.name.replace(/\s+/g, " ").trim().toLocaleLowerCase("es-MX"))).size !== rows.length) errors.push("Hay insumos duplicados en el archivo.");
  return { rows, errors };
}

export function StockImport({ branches, initialBranchId, onImported }: { branches: Branch[]; initialBranchId: string; onImported: (branchId: string) => void }) {
  const [branchId, setBranchId] = useState(initialBranchId);
  const [preview, setPreview] = useState<{ rows: Row[]; errors: string[] } | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function read(file?: File) {
    setMessage(""); setPreview(null); if (!file) return;
    try { setPreview(parseStock(await readSpreadsheet(file))); }
    catch { setMessage("No se pudo leer el archivo. Usa .xlsx o .csv."); }
  }
  async function confirm() {
    if (!preview?.rows.length || preview.errors.length) return;
    setBusy(true);
    try { const result = await importStockCountAction(branchId, preview.rows); setMessage(result.message); if (result.ok) { setPreview(null); onImported(branchId); } }
    catch { setMessage("No se pudo contactar al servidor."); }
    finally { setBusy(false); }
  }
  return <section className="rounded-3xl bg-papel p-5"><h2 className="text-xl font-semibold text-tabaco">Importar conteo desde Excel o CSV</h2>
    <p className="mt-2 text-sm text-tabaco/70">El archivo fija la existencia absoluta por insumo en una sucursal. Reimportar el mismo conteo no duplica stock. Las diferencias quedan registradas como movimientos; no importes un conteo desactualizado mientras la caja está operando.</p>
    <button type="button" onClick={() => downloadCsv("plantilla-inventario.csv", toCsv([columns.slice(), ["Café molido", "g", 1000, 200]]))} className="mt-3 rounded-xl border border-tabaco/20 px-4 py-2 text-sm">Descargar plantilla</button>
    <div className="mt-4 flex flex-wrap gap-3"><label className="grid gap-1 text-sm">Sucursal<select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="min-h-11 rounded-xl border border-tabaco/20 bg-white px-3">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Archivo<input type="file" accept=".xlsx,.csv" onChange={(e) => void read(e.target.files?.[0])} className="min-h-11 rounded-xl border border-tabaco/20 bg-white p-2" /></label></div>
    {preview && <div className="mt-4 text-sm"><p>{preview.rows.length} filas válidas.</p>{preview.errors.map((e) => <p key={e} className="text-red-800">{e}</p>)}
      {preview.rows.length > 0 && <ul className="mt-2 max-h-40 overflow-auto">{preview.rows.slice(0, 20).map((r) => <li key={r.name}>{r.name}: {r.quantity} {r.unit} · mínimo {r.minimum}</li>)}</ul>}
      <button type="button" disabled={busy || preview.errors.length > 0 || preview.rows.length === 0} onClick={() => void confirm()} className="btn mt-3 bg-tabaco px-5 text-crema disabled:opacity-40">Confirmar conteo</button></div>}
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </section>;
}
