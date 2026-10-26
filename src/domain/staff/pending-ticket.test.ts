import { describe, expect, test } from "vitest";
import { parsePendingTicket } from "./pending-ticket";

const branchId = "00000000-0000-4000-8000-000000000001";
const ticket = { branchId, folio: "00000000-0000-4000-8000-000000000002", items: [{ product_id: "00000000-0000-4000-8000-000000000003", quantity: 2 }], savedAt: 1000 };

describe("ticket pendiente para captura de fidelidad", () => {
  test("acepta una venta reciente de la sucursal activa", () => expect(parsePendingTicket(JSON.stringify(ticket), branchId, 2000)).toEqual(ticket));
  test("rechaza sucursal distinta, dato vencido o futuro", () => {
    expect(parsePendingTicket(JSON.stringify(ticket), "00000000-0000-4000-8000-000000000004", 2000)).toBeNull();
    expect(parsePendingTicket(JSON.stringify(ticket), branchId, 31 * 60 * 1000)).toBeNull();
    expect(parsePendingTicket(JSON.stringify(ticket), branchId, 999)).toBeNull();
  });
  test("rechaza datos inválidos", () => {
    expect(parsePendingTicket("{", branchId)).toBeNull();
    expect(parsePendingTicket(JSON.stringify({ ...ticket, items: [{ ...ticket.items[0], quantity: -1 }] }), branchId, 2000)).toBeNull();
  });
});
