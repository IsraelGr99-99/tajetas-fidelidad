import { describe, expect, test } from "vitest";
import { activeCustomerLabel } from "@/domain/loyalty/customer-display";

describe("etiqueta del padrón de fidelidad", () => {
  test("usa el nombre tanto con relación objeto como arreglo", () => {
    expect(activeCustomerLabel({ display_name: " Ana " }, "123456789")).toBe("Ana");
    expect(activeCustomerLabel([{ display_name: "Luis" }], "123456789")).toBe("Luis");
  });

  test("sin nombre muestra solo una referencia corta", () => {
    expect(activeCustomerLabel({ display_name: null }, "123456789")).toBe("Tarjeta 12345678…");
  });
});
