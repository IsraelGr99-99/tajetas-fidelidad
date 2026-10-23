"use client";

import { useId, useState, type ReactNode } from "react";
import type { FinanceResult } from "@/actions/finance";
import { type Cell, type ParseResult, toCsv } from "@/domain/imports/spreadsheet";
import { downloadCsv, readSpreadsheet } from "@/lib/read-spreadsheet";

type Column<T> = { label: string; render: (row: T) => ReactNode; align?: "right" };

/**
 * Importación en tres pasos: plantilla → archivo → vista previa con errores por
 * renglón → confirmar. Nada se guarda hasta confirmar.
 */
export function ImportWizard<T>({
  title,
  description,
  templateName,
  template,
  parse,
  columns,
  confirmLabel,
  onImport,
  extra,
  disabledReason,
}: {
  title: string;
  description: ReactNode;
  templateName: string;
  template: (string | number)[][];
  parse: (matrix: Cell[][]) => ParseResult<T>;
  columns: Column<T & { row: number }>[];
  confirmLabel: (n: number) => string;
  onImport: (rows: (T & { row: number })[], fileName: string) => Promise<FinanceResult>;
  extra?: ReactNode;
  disabledReason?: string | null;
}) {
  const inputId = useId();
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ParseResult<T> | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [skipErrors, setSkipErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<FinanceResult | null>(null);

  async function onFile(file: File | undefined) {
    setOutcome(null);
    setReadError(null);
    setResult(null);
    setSkipErrors(false);
    if (!file) return;
    setFileName(file.name);
    try {
      setResult(parse(await readSpreadsheet(file)));
    } catch (e) {
      setReadError(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    }
  }

  async function confirm() {
    if (!result || !fileName) return;
    setBusy(true);
    try {
      const r = await onImport(result.rows, fileName);
      setOutcome(r);
      if (r.ok) {
        setResult(null);
        setFileName(null);
      }
    } catch {
      setOutcome({ ok: false, message: "No se pudo contactar al servidor." });
    } finally {
      setBusy(false);
    }
  }

  const blocked = result && (result.missingColumns.length > 0 || result.rows.length === 0 || (result.errors.length > 0 && !skipErrors));

  return (
    <section className="space-y-4 rounded-3xl bg-papel p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl text-tabaco">{title}</h2>
          <div className="mt-1 max-w-2xl text-sm leading-6 text-tabaco/80">{description}</div>
        </div>
        <button type="button" onClick={() => downloadCsv(templateName, toCsv(template))} className="btn min-h-10 border border-tabaco/25 px-4 text-sm text-tabaco">
          Descargar plantilla
        </button>
      </div>

      {extra}

      <div>
        <label
          htmlFor={inputId}
          className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-tabaco/25 bg-crema/60 p-4 text-center text-tabaco hover:border-tabaco has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-mostaza"
        >
          <span className="font-semibold">{fileName ?? "Elige un archivo .xlsx o .csv"}</span>
          <span className="text-sm text-tabaco/75">Se lee en tu navegador; nada se guarda hasta que confirmes.</span>
          <input
            id={inputId}
            type="file"
            accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => onFile(e.target.files?.[0])}
            className="sr-only"
          />
        </label>
      </div>

      <div aria-live="polite" className="space-y-3">
        {readError ? (
          <p role="alert" className="rounded-xl border border-alerta/30 bg-alerta/5 px-4 py-3 text-sm text-alerta">
            {readError}
          </p>
        ) : null}

        {result?.missingColumns.length ? (
          <p role="alert" className="rounded-xl border border-alerta/30 bg-alerta/5 px-4 py-3 text-sm text-alerta">
            Faltan columnas: {result.missingColumns.join(", ")}. Usa la plantilla como guía.
          </p>
        ) : null}

        {result && !result.missingColumns.length ? (
          <>
            <p className="text-sm text-tabaco">
              <strong>{result.rows.length}</strong> renglones listos
              {result.errors.length ? (
                <>
                  {" "}
                  · <strong className="text-alerta">{result.errors.length}</strong> con errores
                </>
              ) : null}
            </p>

            {result.errors.length ? (
              <details className="rounded-xl border border-alerta/30 bg-alerta/5 p-3 text-sm text-alerta" open={result.errors.length <= 5}>
                <summary className="cursor-pointer font-semibold">Renglones con errores</summary>
                <ul className="mt-2 space-y-1">
                  {result.errors.slice(0, 50).map((e) => (
                    <li key={e.row}>
                      Renglón {e.row}: {e.message}
                    </li>
                  ))}
                  {result.errors.length > 50 ? <li>…y {result.errors.length - 50} más.</li> : null}
                </ul>
              </details>
            ) : null}

            {result.rows.length ? (
              <div className="overflow-x-auto rounded-xl border border-tabaco/10">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead className="bg-tabaco/5 text-tabaco">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-semibold">
                        #
                      </th>
                      {columns.map((c) => (
                        <th key={c.label} scope="col" className={`px-3 py-2 font-semibold ${c.align === "right" ? "text-right" : ""}`}>
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-tabaco/10 text-tabaco">
                    {result.rows.slice(0, 20).map((r) => (
                      <tr key={r.row}>
                        <td className="px-3 py-2 text-tabaco/70">{r.row}</td>
                        {columns.map((c) => (
                          <td key={c.label} className={`px-3 py-2 ${c.align === "right" ? "text-right tabular-nums" : ""}`}>
                            {c.render(r)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.rows.length > 20 ? <p className="px-3 py-2 text-xs text-tabaco/75">Vista previa de 20 de {result.rows.length}.</p> : null}
              </div>
            ) : null}

            {result.errors.length > 0 && result.rows.length > 0 ? (
              <label className="flex items-center gap-2 text-sm text-tabaco">
                <input type="checkbox" checked={skipErrors} onChange={(e) => setSkipErrors(e.target.checked)} className="h-5 w-5 accent-[#3d2c24]" />
                Importar solo los renglones válidos
              </label>
            ) : null}

            {disabledReason ? <p className="text-sm text-alerta">{disabledReason}</p> : null}
            <button type="button" onClick={confirm} disabled={Boolean(blocked) || busy || Boolean(disabledReason)} className="btn btn-oscuro disabled:opacity-50">
              {busy ? "Importando…" : confirmLabel(result.rows.length)}
            </button>
          </>
        ) : null}

        {outcome ? (
          <p
            role={outcome.ok ? "status" : "alert"}
            className={`rounded-xl border px-4 py-3 text-sm ${outcome.ok ? "border-exito/30 bg-exito/5 text-exito" : "border-alerta/30 bg-alerta/5 text-alerta"}`}
          >
            {outcome.message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
