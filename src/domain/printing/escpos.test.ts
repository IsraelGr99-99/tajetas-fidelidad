import { describe, expect, test } from "vitest";
import { buildEscPosTicket } from "./escpos";

describe("ticket ESC/POS genérico", () => {
  test("incluye total, folio, inicialización y corte, sin exponer datos del cliente", () => {
    const bytes = buildEscPosTicket({ business: "Café Nómada", branch: "Centro", folio: "ABC12345", timestamp: "25/10/2026 10:00",
      lines: [{ name: "Americano", quantity: 2, totalCents: 9000 }], totalCents: 9000, payment: "Efectivo" }, "58mm");
    const text = new TextDecoder().decode(bytes);
    expect([...bytes.slice(0, 2)]).toEqual([0x1b, 0x40]);
    expect([...bytes.slice(-3)]).toEqual([0x1d, 0x56, 0x00]);
    expect(text).toContain("TOTAL $90.00");
    expect(text).toContain("ABC12345");
    expect(text).not.toContain("@correo");
  });
});
