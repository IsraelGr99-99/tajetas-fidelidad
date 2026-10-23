"use client";

import { type Cell, parseCsv } from "@/domain/imports/spreadsheet";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Lee un .xlsx o .csv en el navegador y devuelve una matriz de celdas.
 * El archivo no se sube: solo viajan al servidor los renglones ya interpretados.
 */
export async function readSpreadsheet(file: File): Promise<Cell[][]> {
  if (file.size > MAX_FILE_BYTES) throw new Error("El archivo pesa más de 5 MB. Divídelo en partes.");
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type === "text/csv") return parseCsv(await file.text());
  if (name.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    return (await readSheet(file)) as Cell[][];
  }
  if (name.endsWith(".xls")) throw new Error("Formato .xls antiguo: guárdalo como .xlsx o .csv desde Excel.");
  throw new Error("Usa un archivo .xlsx o .csv.");
}

/** Descarga una plantilla CSV generada en el navegador. */
export function downloadCsv(fileName: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
