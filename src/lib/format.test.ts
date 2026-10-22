import { expect, test } from "vitest";
import { formatDateTime, formatMxn } from "./format";

test("pesos mexicanos desde centavos", () => {
  expect(formatMxn(4550)).toBe("$45.50");
  expect(() => formatMxn(45.5)).toThrow(RangeError);
});

test("fechas en America/Mexico_City", () => {
  // 2026-10-22T06:30Z = 00:30 en Ciudad de México (UTC-6, sin horario de verano).
  expect(formatDateTime("2026-10-22T06:30:00Z")).toMatch(/^22 oct 2026, 12:30\sa\.\s?m\.$/);
});
