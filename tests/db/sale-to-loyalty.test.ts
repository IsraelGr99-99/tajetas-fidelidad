import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { IDS, TestDb, idemKey, sha256 } from "./harness";

let db: TestDb;
beforeAll(async () => { db = await TestDb.create(); });
afterAll(async () => { await db?.close(); });

describe("venta de caja seguida de fidelidad", () => {
  test("descuenta inventario y acredita una vez con el folio de la venta", async () => {
    const staff = await db.createStaff("barista");
    const customer = await db.createCustomer();
    const [product] = await db.admin<{ id: string }>("select id from public.products where business_id = $1 and name = 'Americano (ejemplo)'", [IDS.business]);
    const [before] = await db.admin<{ quantity: string }>("select quantity from public.stock_balances where branch_id = $1 and item_id = (select item_id from public.product_recipes where product_id = $2 order by item_id limit 1)", [IDS.branch, product.id]);
    const lines = JSON.stringify([{ product_id: product.id, quantity: 1 }]);
    const saleKey = randomUUID();
    const sale = await db.rpc(staff.userId, "record_pos_sale", [IDS.branch, saleKey, "cash", lines]);
    expect(sale).toMatchObject({ ok: true, replayed: false });
    expect(await db.rpc(staff.userId, "record_pos_sale", [IDS.branch, saleKey, "cash", lines]))
      .toMatchObject({ ok: true, replayed: true, sale_id: sale.sale_id });

    const hold = sha256(`hold-${randomUUID()}`);
    const token = await db.scanToken(customer.userId, customer.cardId);
    expect(await db.rpc(staff.userId, "staff_claim_card", [IDS.branch, token, hold])).toMatchObject({ ok: true, purpose: "identify" });
    // La app convierte el UUID de la venta en un HMAC; aquí el hash representa ese mismo folio.
    const reference = sha256(`folio-${sale.sale_id}`);
    const earnKey = idemKey();
    const earn = await db.rpc(staff.userId, "record_earn", [IDS.branch, earnKey, reference, lines, hold, null, null]);
    expect(earn).toMatchObject({ ok: true, replayed: false, stamps_balance: 1 });
    expect(await db.rpc(staff.userId, "record_earn", [IDS.branch, earnKey, reference, lines, hold, null, null]))
      .toMatchObject({ ok: true, replayed: true, stamps_balance: 1 });

    const [after] = await db.admin<{ quantity: string }>("select quantity from public.stock_balances where branch_id = $1 and item_id = (select item_id from public.product_recipes where product_id = $2 order by item_id limit 1)", [IDS.branch, product.id]);
    expect(Number(after.quantity)).toBeLessThan(Number(before.quantity));
    const [saved] = await db.admin<{ n: number }>("select count(*)::integer as n from public.purchases where reference_hash = $1", [reference]);
    expect(saved.n).toBe(1);
  });
});
