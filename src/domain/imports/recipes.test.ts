import { describe, expect, it } from "vitest";
import { parseRecipeImport } from "./recipes";

const products = [{ id: "p1", name: "Latte grande" }];
const items = [{ id: "i1", name: "Leche", unit: "ml" }, { id: "i2", name: "Café molido", unit: "g" }];

describe("parseRecipeImport", () => {
  it("agrupa ingredientes existentes por producto", () => {
    const result = parseRecipeImport([["Producto", "Insumo", "Cantidad"], ["LATTE GRANDE", "leche", "250"], ["Latte grande", "Café molido", "18.5"]], products, items);
    expect(result.errors).toEqual([]);
    expect(result.groups).toEqual([{ productId: "p1", productName: "Latte grande", components: [{ item_id: "i1", quantity: 250 }, { item_id: "i2", quantity: 18.5 }] }]);
  });

  it("rechaza duplicados, fórmulas y nombres desconocidos antes de escribir", () => {
    const result = parseRecipeImport([["Producto", "Insumo", "Cantidad"], ["Latte grande", "Leche", 250], ["Latte grande", "leche", 100], ["=HYPERLINK(1)", "Café molido", 18]], products, items);
    expect(result.groups).toEqual([]);
    expect(result.errors).toHaveLength(2);
  });

  it("exige encabezados únicos", () => {
    expect(parseRecipeImport([["Producto", "Producto", "Cantidad"]], products, items).errors).toHaveLength(1);
  });
});
