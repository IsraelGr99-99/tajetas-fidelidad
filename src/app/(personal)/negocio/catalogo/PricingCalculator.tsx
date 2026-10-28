"use client";

import { useMemo, useState } from "react";
import { calculateProductPrice } from "@/domain/pricing/calculator";
import { formatMxn } from "@/lib/format";

type Ingredient = { id: number; name: string; quantity: string; unitCost: string };
type CalculatorProduct = { id: string; name: string; priceCents: number; costCents: number | null };
type CalculatorItem = { id: string; name: string; unit: string };
type CalculatorRecipe = { product_id: string; item_id: string; quantity: number };
const pesos = (value: string) => Math.round(Number(value || 0) * 100);
const moneyInput = "min-h-11 w-full rounded-xl border border-tabaco/20 bg-white px-3 text-tabaco focus:border-tabaco";

export function PricingCalculator({ products, items, recipes }: { products: CalculatorProduct[]; items: CalculatorItem[]; recipes: CalculatorRecipe[] }) {
  const [selectedProductId, setSelectedProductId] = useState("");
  const [rows, setRows] = useState<Ingredient[]>([{ id: 1, name: "", quantity: "1", unitCost: "" }]);
  const [nextId, setNextId] = useState(2);
  const [labor, setLabor] = useState("");
  const [packaging, setPackaging] = useState("");
  const [overhead, setOverhead] = useState("");
  const [waste, setWaste] = useState("0");
  const [margin, setMargin] = useState("40");
  const [tax, setTax] = useState("0");
  const selectedProduct = products.find((product) => product.id === selectedProductId);
  const selectedRecipe = recipes.filter((recipe) => recipe.product_id === selectedProductId);

  function chooseProduct(id: string) {
    setSelectedProductId(id);
    const recipeRows = recipes.filter((recipe) => recipe.product_id === id).map((recipe, index) => {
      const item = items.find((entry) => entry.id === recipe.item_id);
      return { id: index + 1, name: item ? `${item.name} (${item.unit})` : "Insumo no encontrado", quantity: String(recipe.quantity), unitCost: "" };
    });
    setRows(recipeRows.length ? recipeRows : [{ id: 1, name: "", quantity: "1", unitCost: "" }]);
    setNextId(recipeRows.length + 1);
  }

  const result = useMemo(() => rows.some((row) => Boolean(row.name.trim()) !== Boolean(row.unitCost.trim())) ? null : calculateProductPrice({
    ingredients: rows.filter((row) => row.name.trim() && row.unitCost !== "").map((row) => ({
      quantity: Number(row.quantity),
      unitCostCents: pesos(row.unitCost),
    })),
    laborCents: pesos(labor),
    packagingCents: pesos(packaging),
    overheadCents: pesos(overhead),
    wastePercent: Number(waste),
    targetMarginPercent: Number(margin),
    taxPercent: Number(tax),
  }), [rows, labor, packaging, overhead, waste, margin, tax]);

  function change(id: number, field: keyof Ingredient, value: string) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row));
  }

  return (
    <details className="rounded-3xl border border-tabaco/10 bg-papel p-5 sm:p-6">
      <summary className="cursor-pointer text-lg font-semibold text-tabaco">Calculadora de precio por producto</summary>
      <div className="mt-5 space-y-6">
        <p className="max-w-3xl text-sm leading-6 text-tabaco/75">
          Desglosa el costo de una unidad vendible y fija un margen objetivo sobre el precio sin impuestos. El impuesto es configurable porque
          depende de tu producto y situación fiscal; esto es una estimación comercial, no asesoría fiscal.
        </p>

        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <label className="grid max-w-xl gap-2 text-sm font-semibold text-blue-950">Usar un producto del catálogo
            <select value={selectedProductId} onChange={(event) => chooseProduct(event.target.value)} className={moneyInput}><option value="">Calcular desde cero</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select>
          </label>
          {selectedProduct ? <p className="mt-3 text-sm text-blue-950">Precio actual: <strong>{formatMxn(selectedProduct.priceCents)}</strong> · costo total guardado: <strong>{selectedProduct.costCents === null ? "sin registrar" : formatMxn(selectedProduct.costCents)}</strong>. {selectedRecipe.length ? "Cargamos sus ingredientes y cantidades; completa el costo de cada unidad de insumo para calcular." : "Este producto aún no tiene receta. Agrégala en Inventario para precargar sus insumos."}</p> : <p className="mt-3 text-sm text-blue-900">También puedes hacer un cálculo manual sin modificar el catálogo.</p>}
        </div>

        <fieldset className="space-y-3">
          <legend className="font-semibold text-tabaco">Insumos o componentes por unidad vendida</legend>
          {rows.map((row) => (
            <div key={row.id} className="grid gap-2 rounded-2xl border border-tabaco/10 bg-white p-3 sm:grid-cols-[1fr_7rem_9rem_auto] sm:items-end">
              <label className="text-xs font-semibold text-tabaco/75">Insumo
                <input value={row.name} onChange={(e) => change(row.id, "name", e.target.value)} maxLength={80} placeholder="Ej. café molido" className={`mt-1 ${moneyInput}`} />
              </label>
              <label className="text-xs font-semibold text-tabaco/75">Cantidad usada
                <input type="number" min="0" step="0.001" value={row.quantity} onChange={(e) => change(row.id, "quantity", e.target.value)} className={`mt-1 ${moneyInput}`} />
              </label>
              <label className="text-xs font-semibold text-tabaco/75">Costo por unidad ($)
                <input type="number" min="0" step="0.01" value={row.unitCost} onChange={(e) => change(row.id, "unitCost", e.target.value)} placeholder="0.00" className={`mt-1 ${moneyInput}`} />
              </label>
              <button type="button" onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))} disabled={rows.length === 1} className="min-h-11 rounded-xl border border-tabaco/20 px-3 text-sm text-tabaco disabled:opacity-40" aria-label={`Quitar insumo ${row.name || row.id}`}>Quitar</button>
            </div>
          ))}
          <button type="button" onClick={() => { setRows((current) => [...current, { id: nextId, name: "", quantity: "1", unitCost: "" }]); setNextId((n) => n + 1); }} className="rounded-xl border border-tabaco/20 px-4 py-2 text-sm font-semibold text-tabaco">+ Agregar insumo</button>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Mano de obra por unidad ($)", labor, setLabor],
            ["Empaque por unidad ($)", packaging, setPackaging],
            ["Gastos indirectos por unidad ($)", overhead, setOverhead],
          ].map(([label, value, setter]) => (
            <label key={label as string} className="text-xs font-semibold text-tabaco/75">{label as string}
              <input type="number" min="0" step="0.01" value={value as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)} placeholder="0.00" className={`mt-1 ${moneyInput}`} />
            </label>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-semibold text-tabaco/75">Merma en insumos (%)
            <input type="number" min="0" max="100" step="0.1" value={waste} onChange={(e) => setWaste(e.target.value)} className={`mt-1 ${moneyInput}`} />
          </label>
          <label className="text-xs font-semibold text-tabaco/75">Margen objetivo (%)
            <input type="number" min="0" max="99.9" step="0.1" value={margin} onChange={(e) => setMargin(e.target.value)} className={`mt-1 ${moneyInput}`} />
          </label>
          <label className="text-xs font-semibold text-tabaco/75">Impuesto aplicable (%)
            <input type="number" min="0" max="100" step="0.1" value={tax} onChange={(e) => setTax(e.target.value)} className={`mt-1 ${moneyInput}`} />
          </label>
        </div>

        {result ? (
          <div className="rounded-2xl bg-tabaco p-5 text-crema" aria-live="polite">
            <p className="bitacora text-mostaza">Precio mínimo estimado para tu margen</p>
            <p className="mt-1 font-display text-4xl">{formatMxn(result.finalPriceCents)}</p>
            {selectedProduct && <p className="mt-2 text-sm text-crema/85">Precio actual {formatMxn(selectedProduct.priceCents)} · diferencia frente al recomendado {formatMxn(result.finalPriceCents - selectedProduct.priceCents)}.</p>}
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><dt className="text-crema/70">Costo total</dt><dd className="font-semibold">{formatMxn(result.totalCostCents)}</dd></div>
              <div><dt className="text-crema/70">Precio sin impuesto</dt><dd className="font-semibold">{formatMxn(result.netPriceCents)}</dd></div>
              <div><dt className="text-crema/70">Impuesto calculado</dt><dd className="font-semibold">{formatMxn(result.taxCents)}</dd></div>
              <div><dt className="text-crema/70">Utilidad bruta estimada</dt><dd className="font-semibold">{formatMxn(result.grossProfitCents)}</dd></div>
            </dl>
            <p className="mt-4 text-xs text-crema/75">Los precios y costos del catálogo no cambian hasta que los guardes. La calculadora no registra datos.</p>
          </div>
        ) : (
          <p className="rounded-2xl border border-tabaco/10 bg-white p-4 text-sm text-tabaco/75" role="status">
            Agrega al menos un costo válido para obtener un precio. Revisa que el margen sea menor a 100 %.
          </p>
        )}
      </div>
    </details>
  );
}
