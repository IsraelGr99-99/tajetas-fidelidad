import { describe, expect, test } from "vitest";
import { calculateProductPrice } from "./calculator";

const base = {
  ingredients: [{ quantity: 2, unitCostCents: 1000 }, { quantity: 0.5, unitCostCents: 600 }],
  laborCents: 500,
  packagingCents: 200,
  overheadCents: 300,
  wastePercent: 10,
  targetMarginPercent: 40,
  taxPercent: 16,
};

describe("calculadora de precio", () => {
  test("calcula costo, margen sobre venta e impuesto sin confundirlo con markup", () => {
    const result = calculateProductPrice(base);
    expect(result).toMatchObject({
      ingredientsCents: 2300,
      wasteCents: 230,
      totalCostCents: 3530,
      netPriceCents: 5884,
      taxCents: 941,
      finalPriceCents: 6825,
      grossProfitCents: 2354,
    });
    expect(result?.actualMarginPercent).toBeCloseTo(40, 1);
  });

  test("sin costo real no inventa precio", () => {
    expect(calculateProductPrice({ ...base, ingredients: [], laborCents: 0, packagingCents: 0, overheadCents: 0 })).toBeNull();
  });

  test("rechaza tasas y cantidades inválidas", () => {
    expect(calculateProductPrice({ ...base, targetMarginPercent: 100 })).toBeNull();
    expect(calculateProductPrice({ ...base, ingredients: [{ quantity: -1, unitCostCents: 100 }] })).toBeNull();
    expect(calculateProductPrice({ ...base, taxPercent: Number.NaN })).toBeNull();
  });
});
