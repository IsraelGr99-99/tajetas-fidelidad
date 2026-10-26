"use client";

import { useId, useState } from "react";
import { addExpensesAction, importProductsAction, importSalesAction } from "@/actions/finance";
import { EXPENSES_TEMPLATE, PRODUCT_TEMPLATE, SALES_TEMPLATE, parseExpenses, parseProducts, parseSales } from "@/domain/imports/spreadsheet";
import { formatDate, formatMxn } from "@/lib/format";
import { ImportWizard } from "./ImportWizard";

type Branch = { id: string; name: string };
const selectClass = "mt-1.5 block min-h-11 w-full max-w-sm rounded-xl border border-tabaco/25 bg-papel px-3 text-tabaco";

export function ProductImport({ existingNames }: { existingNames: string[] }) {
  const existing = new Set(existingNames.map((n) => n.toLocaleLowerCase("es-MX")));
  return (
    <ImportWizard
      title="Importar productos y servicios"
      description={
        <>
          Sube tu lista en Excel o CSV. Cada combinación de nombre y tamaño/medida es una variante con precio y receta propios. Si ya existe se actualiza. Columnas: Nombre, Tamaño o medida (opcional), Categoría,
          Precio, Costo (opcional), Suma sello (Sí/No), Activo (Sí/No).
        </>
      }
      templateName="plantilla-catalogo.csv"
      template={PRODUCT_TEMPLATE}
      parse={parseProducts}
      columns={[
        { label: "Producto", render: (r) => `${r.name}${r.variantLabel ? ` · ${r.variantLabel}` : ""}` },
        { label: "Categoría", render: (r) => r.category },
        { label: "Precio", render: (r) => formatMxn(r.priceCents), align: "right" },
        { label: "Costo", render: (r) => (r.costCents === null ? "—" : formatMxn(r.costCents)), align: "right" },
        { label: "Sello", render: (r) => (r.eligible ? "Sí" : "No") },
        { label: "Acción", render: (r) => (existing.has(`${r.name}${r.variantLabel ? ` · ${r.variantLabel}` : ""}`.toLocaleLowerCase("es-MX")) ? "Actualizar" : "Nuevo") },
      ]}
      confirmLabel={(n) => `Importar ${n} producto${n === 1 ? "" : "s"}`}
      onImport={(rows) =>
        importProductsAction(
          rows.map((r) => ({ name: r.name, variantLabel: r.variantLabel, category: r.category, priceCents: r.priceCents, costCents: r.costCents, eligible: r.eligible, active: r.active })),
        )
      }
    />
  );
}

export function SalesImport({ branches }: { branches: Branch[] }) {
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const id = useId();
  return (
    <ImportWizard
      title="Importar ventas del punto de venta"
      description={
        <>
          Exporta el reporte de ventas de tu POS a Excel y súbelo aquí, una sucursal por archivo. Columnas: Fecha, Producto, Cantidad y Total (o Precio
          unitario). Los productos que coincidan con el catálogo toman su costo para calcular la ganancia.
        </>
      }
      templateName="plantilla-ventas.csv"
      template={SALES_TEMPLATE}
      parse={parseSales}
      extra={
        <div>
          <label htmlFor={id} className="block text-sm font-semibold text-tabaco">
            Sucursal del reporte
          </label>
          <select id={id} value={branchId} onChange={(e) => setBranchId(e.target.value)} className={selectClass}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      }
      disabledReason={branchId ? null : "Elige una sucursal."}
      columns={[
        { label: "Fecha", render: (r) => formatDate(`${r.soldOn}T12:00:00-06:00`) },
        { label: "Producto", render: (r) => r.productName },
        { label: "Cantidad", render: (r) => r.quantity, align: "right" },
        { label: "Total", render: (r) => formatMxn(r.totalCents), align: "right" },
      ]}
      confirmLabel={(n) => `Importar ${n} venta${n === 1 ? "" : "s"}`}
      onImport={(rows, fileName) =>
        importSalesAction({
          branchId,
          fileName,
          rows: rows.map((r) => ({ soldOn: r.soldOn, productName: r.productName, category: r.category, quantity: r.quantity, totalCents: r.totalCents })),
        })
      }
    />
  );
}

export function ExpenseImport({ branches }: { branches: Branch[] }) {
  const byName = new Map(branches.map((b) => [b.name.toLowerCase(), b.id]));
  return (
    <ImportWizard
      title="Importar gastos"
      description={<>Columnas: Fecha, Categoría (Renta, Nómina, Insumos…), Concepto, Monto y Sucursal (opcional; vacío = gasto general).</>}
      templateName="plantilla-gastos.csv"
      template={EXPENSES_TEMPLATE}
      parse={parseExpenses}
      columns={[
        { label: "Fecha", render: (r) => formatDate(`${r.spentOn}T12:00:00-06:00`) },
        { label: "Categoría", render: (r) => r.category },
        { label: "Concepto", render: (r) => r.description ?? "—" },
        {
          label: "Sucursal",
          render: (r) => (r.branchName ? (byName.has(r.branchName.toLowerCase()) ? r.branchName : `${r.branchName} (no existe → general)`) : "General"),
        },
        { label: "Monto", render: (r) => formatMxn(r.amountCents), align: "right" },
      ]}
      confirmLabel={(n) => `Importar ${n} gasto${n === 1 ? "" : "s"}`}
      onImport={(rows) =>
        addExpensesAction(
          rows.map((r) => ({
            branchId: r.branchName ? (byName.get(r.branchName.toLowerCase()) ?? null) : null,
            spentOn: r.spentOn,
            category: r.category,
            description: r.description,
            amountCents: r.amountCents,
          })),
        )
      }
    />
  );
}
