/**
 * Interpretación de hojas de cálculo (Excel/CSV) para importar catálogo, ventas
 * del punto de venta y gastos. Funciones puras: reciben una matriz de celdas y
 * devuelven renglones válidos + errores por renglón para la vista previa.
 * El servidor vuelve a validar todo antes de guardar.
 */

export type Cell = string | number | boolean | Date | null | undefined;
export type RowError = { row: number; message: string };
export type ParseResult<T> = { rows: (T & { row: number })[]; errors: RowError[]; missingColumns: string[] };

const MAX_ROWS = { products: 1000, sales: 10000, expenses: 2000 } as const;

/** Normaliza encabezados: minúsculas, sin acentos ni signos. */
export function normalizeHeader(value: Cell): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** "$1,234.50", "1234,50", 1234.5 → centavos. Acepta coma o punto decimal (formato MX y europeo). */
export function parseMoneyToCents(value: Cell): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
  let text = String(value ?? "").trim().replace(/[$\s]|mxn/gi, "");
  if (!text) return null;
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma > lastDot && text.length - lastComma <= 3) text = text.replace(/\./g, "").replace(",", ".");
  else text = text.replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  return Math.round(Number(text) * 100);
}

export function parseQuantity(value: Cell): number | null {
  const n = typeof value === "number" ? value : Number(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 && n <= 100000 ? Math.round(n * 100) / 100 : null;
}

/** Fecha a "AAAA-MM-DD": Date, serial de Excel, "dd/mm/aaaa", "aaaa-mm-dd". */
export function parseDate(value: Cell): string | null {
  const iso = (y: number, m: number, d: number) => {
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d || y < 2000 || y > 2100) return null;
    return dt.toISOString().slice(0, 10);
  };
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : iso(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  if (typeof value === "number") {
    // Serial de Excel (días desde 1899-12-30).
    if (value < 30000 || value > 80000) return null;
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86_400_000);
    return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  const text = String(value ?? "").trim();
  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) return iso(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  return null;
}

export function parseYesNo(value: Cell, fallback: boolean): boolean | null {
  if (typeof value === "boolean") return value;
  const text = normalizeHeader(value);
  if (!text) return fallback;
  if (["si", "s", "yes", "y", "1", "true", "verdadero", "x"].includes(text)) return true;
  if (["no", "n", "0", "false", "falso"].includes(text)) return false;
  return null;
}

function text(value: Cell, max: number): string | null {
  const t = String(value ?? "").replace(/\s+/g, " ").trim();
  return t && t.length <= max && !/[<>]/.test(t) ? t : null;
}

/** Busca columnas por sinónimos; devuelve índice por campo. */
function locate<K extends string>(header: Cell[], synonyms: Record<K, string[]>) {
  const normalized = header.map(normalizeHeader);
  const index = {} as Record<K, number>;
  for (const key of Object.keys(synonyms) as K[]) {
    index[key] = normalized.findIndex((h) => synonyms[key].some((s) => h === s || h.startsWith(`${s} `)));
  }
  return index;
}

/** Primera fila con contenido = encabezados; filas vacías se ignoran. */
function split(matrix: Cell[][]) {
  const rows = matrix.filter((r) => r.some((c) => String(c ?? "").trim() !== ""));
  return { header: rows[0] ?? [], body: rows.slice(1) };
}

// ---------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------
export type ProductRow = { name: string; category: string; priceCents: number; costCents: number | null; eligible: boolean; active: boolean };

export const PRODUCT_TEMPLATE = [
  ["Nombre", "Categoría", "Precio", "Costo", "Suma sello", "Activo"],
  ["Americano", "Bebidas", "50.00", "12.00", "Sí", "Sí"],
  ["Capuchino", "Bebidas", "65.00", "16.50", "Sí", "Sí"],
  ["Concha artesanal", "Panadería", "35.00", "11.00", "No", "Sí"],
  ["Taller de cata", "Servicios", "350.00", "", "No", "Sí"],
];

export function parseProducts(matrix: Cell[][]): ParseResult<ProductRow> {
  const { header, body } = split(matrix);
  const col = locate(header, {
    name: ["nombre", "producto", "servicio", "articulo", "descripcion"],
    category: ["categoria", "tipo", "familia", "departamento"],
    price: ["precio", "precio venta", "precio de venta", "pvp"],
    cost: ["costo", "costo unitario", "coste"],
    eligible: ["suma sello", "sello", "elegible", "fidelidad"],
    active: ["activo", "disponible", "estado"],
  });
  const missingColumns = (["name", "price"] as const).filter((k) => col[k] < 0).map((k) => (k === "name" ? "Nombre" : "Precio"));
  const result: ParseResult<ProductRow> = { rows: [], errors: [], missingColumns };
  if (missingColumns.length) return result;

  const seen = new Set<string>();
  body.slice(0, MAX_ROWS.products).forEach((r, i) => {
    const row = i + 2;
    const name = text(r[col.name], 80);
    const category = col.category >= 0 ? text(r[col.category], 40) : "General";
    const priceCents = parseMoneyToCents(r[col.price]);
    const rawCost = col.cost >= 0 ? r[col.cost] : null;
    const costCents = String(rawCost ?? "").trim() === "" ? null : parseMoneyToCents(rawCost);
    const eligible = col.eligible >= 0 ? parseYesNo(r[col.eligible], false) : false;
    const active = col.active >= 0 ? parseYesNo(r[col.active], true) : true;

    const problems = [
      !name || name.length < 2 ? "nombre vacío o inválido" : null,
      !category || category.length < 2 ? "categoría inválida" : null,
      priceCents === null ? "precio inválido" : null,
      costCents === null && String(rawCost ?? "").trim() !== "" ? "costo inválido" : null,
      eligible === null ? "“Suma sello” debe ser Sí o No" : null,
      active === null ? "“Activo” debe ser Sí o No" : null,
      name && seen.has(name.toLowerCase()) ? "nombre repetido en el archivo" : null,
    ].filter(Boolean) as string[];
    if (problems.length) return result.errors.push({ row, message: problems.join(", ") });
    seen.add(name!.toLowerCase());
    result.rows.push({ row, name: name!, category: category!, priceCents: priceCents!, costCents, eligible: eligible!, active: active! });
  });
  if (body.length > MAX_ROWS.products) result.errors.push({ row: MAX_ROWS.products + 2, message: `Máximo ${MAX_ROWS.products} renglones por archivo.` });
  return result;
}

// ---------------------------------------------------------------------
// Ventas del punto de venta
// ---------------------------------------------------------------------
export type SaleRow = { soldOn: string; productName: string; category: string | null; quantity: number; totalCents: number };

export const SALES_TEMPLATE = [
  ["Fecha", "Producto", "Categoría", "Cantidad", "Precio unitario", "Total"],
  ["21/10/2026", "Americano", "Bebidas", "12", "50.00", "600.00"],
  ["21/10/2026", "Capuchino", "Bebidas", "8", "65.00", "520.00"],
  ["22/10/2026", "Concha artesanal", "Panadería", "15", "35.00", "525.00"],
];

export function parseSales(matrix: Cell[][]): ParseResult<SaleRow> {
  const { header, body } = split(matrix);
  const col = locate(header, {
    date: ["fecha", "dia", "date"],
    product: ["producto", "articulo", "descripcion", "nombre", "concepto"],
    category: ["categoria", "familia", "departamento"],
    quantity: ["cantidad", "unidades", "piezas", "cant"],
    unit: ["precio unitario", "precio", "p unitario"],
    total: ["total", "importe", "venta", "subtotal"],
  });
  const missing: string[] = [];
  if (col.date < 0) missing.push("Fecha");
  if (col.product < 0) missing.push("Producto");
  if (col.total < 0 && col.unit < 0) missing.push("Total o Precio unitario");
  const result: ParseResult<SaleRow> = { rows: [], errors: [], missingColumns: missing };
  if (missing.length) return result;

  body.slice(0, MAX_ROWS.sales).forEach((r, i) => {
    const row = i + 2;
    const soldOn = parseDate(r[col.date]);
    const productName = text(r[col.product], 120);
    const quantity = col.quantity >= 0 ? parseQuantity(r[col.quantity]) : 1;
    const unit = col.unit >= 0 ? parseMoneyToCents(r[col.unit]) : null;
    const total = col.total >= 0 ? parseMoneyToCents(r[col.total]) : unit !== null && quantity !== null ? Math.round(unit * quantity) : null;
    const problems = [
      soldOn ? null : "fecha inválida (usa dd/mm/aaaa)",
      productName ? null : "producto vacío",
      quantity === null ? "cantidad inválida" : null,
      total === null ? "total inválido" : null,
    ].filter(Boolean) as string[];
    if (problems.length) return result.errors.push({ row, message: problems.join(", ") });
    result.rows.push({
      row,
      soldOn: soldOn!,
      productName: productName!,
      category: col.category >= 0 ? text(r[col.category], 60) : null,
      quantity: quantity!,
      totalCents: total!,
    });
  });
  if (body.length > MAX_ROWS.sales) result.errors.push({ row: MAX_ROWS.sales + 2, message: `Máximo ${MAX_ROWS.sales} renglones por archivo.` });
  return result;
}

// ---------------------------------------------------------------------
// Gastos
// ---------------------------------------------------------------------
export type ExpenseRow = { spentOn: string; category: string; description: string | null; amountCents: number; branchName: string | null };

export const EXPENSES_TEMPLATE = [
  ["Fecha", "Categoría", "Concepto", "Monto", "Sucursal"],
  ["01/10/2026", "Renta", "Renta del local", "18000.00", "San Pedro Cholula"],
  ["05/10/2026", "Insumos", "Café de origen 10 kg", "4200.00", "San Pedro Cholula"],
  ["15/10/2026", "Servicios", "Luz y agua", "1350.00", ""],
];

export function parseExpenses(matrix: Cell[][]): ParseResult<ExpenseRow> {
  const { header, body } = split(matrix);
  const col = locate(header, {
    date: ["fecha", "dia"],
    category: ["categoria", "tipo", "rubro"],
    description: ["concepto", "descripcion", "detalle"],
    amount: ["monto", "importe", "total", "cantidad"],
    branch: ["sucursal", "tienda", "local"],
  });
  const missing: string[] = [];
  if (col.date < 0) missing.push("Fecha");
  if (col.category < 0) missing.push("Categoría");
  if (col.amount < 0) missing.push("Monto");
  const result: ParseResult<ExpenseRow> = { rows: [], errors: [], missingColumns: missing };
  if (missing.length) return result;

  body.slice(0, MAX_ROWS.expenses).forEach((r, i) => {
    const row = i + 2;
    const spentOn = parseDate(r[col.date]);
    const category = text(r[col.category], 60);
    const amountCents = parseMoneyToCents(r[col.amount]);
    const problems = [
      spentOn ? null : "fecha inválida (usa dd/mm/aaaa)",
      category && category.length >= 2 ? null : "categoría vacía",
      amountCents && amountCents > 0 ? null : "monto inválido",
    ].filter(Boolean) as string[];
    if (problems.length) return result.errors.push({ row, message: problems.join(", ") });
    result.rows.push({
      row,
      spentOn: spentOn!,
      category: category!,
      description: col.description >= 0 ? text(r[col.description], 200) : null,
      amountCents: amountCents!,
      branchName: col.branch >= 0 ? text(r[col.branch], 120) : null,
    });
  });
  return result;
}

/** CSV con separador detectado (coma o punto y coma) y comillas. */
export function parseCsv(content: string): string[][] {
  const textContent = content.replace(/^﻿/, "");
  const firstLine = textContent.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < textContent.length; i++) {
    const ch = textContent[i];
    if (quoted) {
      if (ch === '"' && textContent[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && textContent[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Plantilla en CSV (UTF-8 con BOM para que Excel respete acentos). */
export function toCsv(matrix: (string | number)[][]): string {
  const esc = (v: string | number) => (/[",;\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return "﻿" + matrix.map((r) => r.map(esc).join(",")).join("\r\n");
}
