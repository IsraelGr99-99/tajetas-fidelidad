import { describe, expect, test } from "vitest";
import { estimateProductAvailability } from "@/domain/inventory/availability";

describe("disponibilidad informativa por sucursal", () => {
  const recipes = [
    { product_id: "cafe", item_id: "grano", quantity: 18 },
    { product_id: "cafe", item_id: "vaso", quantity: 1 },
  ];
  test("usa el ingrediente limitante y la sucursal elegida", () => {
    expect(estimateProductAvailability("cafe", "centro", recipes, [
      { branch_id: "centro", item_id: "grano", quantity: 100, minimum: 10 },
      { branch_id: "centro", item_id: "vaso", quantity: 3, minimum: 1 },
      { branch_id: "norte", item_id: "grano", quantity: 999, minimum: 1 },
    ])).toBe(3);
  });
  test("sin receta es pendiente; sin existencia es cero", () => {
    expect(estimateProductAvailability("te", "centro", recipes, [])).toBeNull();
    expect(estimateProductAvailability("cafe", "centro", recipes, [])).toBe(0);
  });
});
