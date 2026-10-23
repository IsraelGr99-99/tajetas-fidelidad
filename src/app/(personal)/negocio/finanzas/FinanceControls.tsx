"use client";

import { useState, useTransition } from "react";
import { type FinanceResult, addExpensesAction, clearDemoAction, deleteExpenseAction, deleteSalesImportAction, generateDemoAction } from "@/actions/finance";
import { hintClass, inputClass, labelClass } from "@/components/ui/form";
import { parseMoneyToCents } from "@/domain/imports/spreadsheet";

function Message({ result }: { result: FinanceResult | null }) {
  if (!result) return null;
  return (
    <p role={result.ok ? "status" : "alert"} className={`text-sm ${result.ok ? "text-exito" : "text-alerta"}`}>
      {result.message}
    </p>
  );
}

const CATEGORIES = ["Insumos", "Renta", "Nómina", "Servicios", "Mantenimiento", "Publicidad", "Impuestos", "Otros"];

export function ExpenseForm({ branches, today }: { branches: { id: string; name: string }[]; today: string }) {
  const [result, setResult] = useState<FinanceResult | null>(null);
  const [pending, start] = useTransition();

  function submit(formData: FormData) {
    const amountCents = parseMoneyToCents(String(formData.get("amount") ?? ""));
    if (!amountCents) return setResult({ ok: false, message: "Escribe un monto válido, por ejemplo 1250.00." });
    start(async () => {
      const r = await addExpensesAction([
        {
          branchId: String(formData.get("branchId") ?? "") || null,
          spentOn: String(formData.get("spentOn") ?? ""),
          category: String(formData.get("category") ?? ""),
          description: String(formData.get("description") ?? "").trim() || null,
          amountCents,
        },
      ]);
      setResult(r);
    });
  }

  return (
    <form action={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label htmlFor="e-date" className={labelClass}>
            Fecha
          </label>
          <input id="e-date" name="spentOn" type="date" defaultValue={today} max={today} required className={inputClass} />
        </div>
        <div>
          <label htmlFor="e-cat" className={labelClass}>
            Categoría
          </label>
          <input id="e-cat" name="category" list="categorias-gasto" defaultValue="Insumos" required maxLength={60} className={inputClass} />
          <datalist id="categorias-gasto">
            {CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="lg:col-span-2">
          <label htmlFor="e-desc" className={labelClass}>
            Concepto
          </label>
          <input id="e-desc" name="description" maxLength={200} placeholder="Café de origen 10 kg" className={inputClass} />
        </div>
        <div>
          <label htmlFor="e-amount" className={labelClass}>
            Monto (MXN)
          </label>
          <input id="e-amount" name="amount" inputMode="decimal" required placeholder="1250.00" className={inputClass} />
        </div>
      </div>
      <div className="max-w-sm">
        <label htmlFor="e-branch" className={labelClass}>
          Sucursal
        </label>
        <select id="e-branch" name="branchId" defaultValue="" className={inputClass}>
          <option value="">General (todo el negocio)</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <p className={hintClass}>Los gastos generales cuentan en el total pero no en una sucursal específica.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-oscuro disabled:opacity-70">
          {pending ? "Guardando…" : "Registrar gasto"}
        </button>
        <Message result={result} />
      </div>
    </form>
  );
}

export function DeleteRecordButton({ kind, id, label }: { kind: "import" | "expense"; id: string; label: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex flex-col items-end">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`¿Eliminar ${label}? Esta acción no se puede deshacer.`)) return;
          start(async () => {
            const r = kind === "import" ? await deleteSalesImportAction(id) : await deleteExpenseAction(id);
            if (!r.ok) setError(r.message);
          });
        }}
        className="text-sm font-semibold text-arcilla-texto underline underline-offset-4 disabled:opacity-60"
      >
        {pending ? "Eliminando…" : "Eliminar"}
      </button>
      {error ? <span className="text-xs text-alerta">{error}</span> : null}
    </span>
  );
}

export function DemoControls({ hasDemo }: { hasDemo: boolean }) {
  const [result, setResult] = useState<FinanceResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {hasDemo ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (window.confirm("¿Borrar todos los datos DEMO? Los datos reales no se tocan.")) start(async () => setResult(await clearDemoAction()));
            }}
            className="btn border border-alerta/40 text-alerta disabled:opacity-60"
          >
            {pending ? "Borrando…" : "Borrar datos DEMO"}
          </button>
        ) : (
          <button type="button" disabled={pending} onClick={() => start(async () => setResult(await generateDemoAction()))} className="btn btn-oscuro disabled:opacity-60">
            {pending ? "Generando…" : "Generar 60 días de datos DEMO"}
          </button>
        )}
      </div>
      <Message result={result} />
    </div>
  );
}
