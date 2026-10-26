import { describe, expect, test } from "vitest";
import { parsePendingSale } from "./pending-sale";

const branchId = "00000000-0000-4000-8000-000000000001";
const sale = { branchId, key: "00000000-0000-4000-8000-000000000002", lines: [{ product_id: "00000000-0000-4000-8000-000000000003", quantity: 2 }], paymentMethod: "cash", cashReceived: "150.00", savedAt: 1000 };

describe("venta pendiente de confirmar", () => {
  test("recupera la operación exacta de la sucursal", () => expect(parsePendingSale(JSON.stringify(sale), branchId)).toEqual(sale));
  test("rechaza otra sucursal o datos alterados", () => {
    expect(parsePendingSale(JSON.stringify(sale), "00000000-0000-4000-8000-000000000004")).toBeNull();
    expect(parsePendingSale(JSON.stringify({ ...sale, lines: [{ ...sale.lines[0], quantity: -1 }] }), branchId)).toBeNull();
    expect(parsePendingSale("{", branchId)).toBeNull();
  });
});
