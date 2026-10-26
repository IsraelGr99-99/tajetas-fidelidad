import { describe, expect, test } from "vitest";
import {
  PRODUCT_TEMPLATE,
  SALES_TEMPLATE,
  normalizeHeader,
  parseCsv,
  parseDate,
  parseExpenses,
  parseMoneyToCents,
  parseProducts,
  parseSales,
  parseYesNo,
  toCsv,
} from "./spreadsheet";

describe("valores", () => {
  test.each([
    ["$1,234.50", 123450],
    ["1234,50", 123450],
    ["1.234,50", 123450],
    [" 65 ", 6500],
    [65.5, 6550],
    ["65.555", null],
    ["-5", null],
    ["abc", null],
    ["", null],
  ])("dinero %j → %j", (input, out) => expect(parseMoneyToCents(input)).toBe(out));

  test.each([
    ["21/10/2026", "2026-10-21"],
    ["1/2/26", "2026-02-01"],
    ["2026-10-21", "2026-10-21"],
    [46316, "2026-10-21"],
    [new Date(Date.UTC(2026, 9, 21)), "2026-10-21"],
    ["31/02/2026", null],
    ["hoy", null],
  ])("fecha %j → %j", (input, out) => expect(parseDate(input as never)).toBe(out));

  test("sí/no y encabezados", () => {
    expect(parseYesNo("Sí", false)).toBe(true);
    expect(parseYesNo("no", true)).toBe(false);
    expect(parseYesNo("", true)).toBe(true);
    expect(parseYesNo("tal vez", true)).toBeNull();
    expect(normalizeHeader(" Categoría ")).toBe("categoria");
  });
});

describe("catálogo", () => {
  test("la plantilla se interpreta sin errores", () => {
    const r = parseProducts(PRODUCT_TEMPLATE);
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(4);
    expect(r.rows[0]).toMatchObject({ name: "Americano", priceCents: 5000, costCents: 1200, eligible: true, active: true });
    expect(r.rows[3]).toMatchObject({ name: "Taller de cata", costCents: null, eligible: false });
  });

  test("encabezados alternativos y errores por renglón", () => {
    const r = parseProducts([
      ["Producto", "Precio de venta", "Elegible"],
      ["Latte", "$70", "si"],
      ["", "10", "no"],
      ["Latte", "70", "si"],
      ["Mocha", "gratis", "si"],
    ]);
    expect(r.rows.map((x) => x.name)).toEqual(["Latte"]);
    expect(r.rows[0].category).toBe("General");
    expect(r.errors.map((e) => e.row)).toEqual([3, 4, 5]);
    expect(r.errors[1].message).toContain("repetido");
  });

  test("faltan columnas obligatorias", () => {
    expect(parseProducts([["Categoría"], ["Bebidas"]]).missingColumns).toEqual(["Nombre", "Precio"]);
  });

  test("variantes distintas son válidas; repetición con mayúsculas no", () => {
    const result = parseProducts([
      ["Nombre", "Tamaño", "Categoría", "Precio"],
      ["Americano", "Chico", "Bebidas", 45],
      ["americano", "Grande", "bebidas", 59],
      ["AMERICANO", "chico", "BEBIDAS", 45],
    ]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].variantLabel).toBe("Chico");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("repetido");
  });
});

describe("ventas y gastos", () => {
  test("plantilla de ventas", () => {
    const r = parseSales(SALES_TEMPLATE);
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ soldOn: "2026-10-21", productName: "Americano", quantity: 12, totalCents: 60000 });
  });

  test("calcula total con precio unitario si no hay columna total", () => {
    const r = parseSales([
      ["Fecha", "Producto", "Cantidad", "Precio"],
      ["21/10/2026", "Latte", "2", "70"],
    ]);
    expect(r.rows[0].totalCents).toBe(14000);
  });

  test("gastos con sucursal opcional", () => {
    const r = parseExpenses([
      ["Fecha", "Categoría", "Concepto", "Monto", "Sucursal"],
      ["01/10/2026", "Renta", "Local", "18,000.00", "San Pedro Cholula"],
      ["02/10/2026", "Insumos", "", "0", ""],
    ]);
    expect(r.rows).toEqual([{ row: 2, spentOn: "2026-10-01", category: "Renta", description: "Local", amountCents: 1800000, branchName: "San Pedro Cholula" }]);
    expect(r.errors).toEqual([{ row: 3, message: "monto inválido" }]);
  });
});

describe("CSV", () => {
  test("detecta punto y coma, respeta comillas y BOM", () => {
    expect(parseCsv('﻿Nombre;Precio\r\n"Café; especial";"1.234,50"\n')).toEqual([
      ["Nombre", "Precio"],
      ["Café; especial", "1.234,50"],
    ]);
  });
  test("ida y vuelta de la plantilla", () => {
    expect(parseCsv(toCsv(PRODUCT_TEMPLATE))).toEqual(PRODUCT_TEMPLATE);
  });
});
