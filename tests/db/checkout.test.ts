import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { IDS, TestDb } from "./harness";

let db: TestDb;
beforeAll(async () => { db = await TestDb.create(); });
afterAll(async () => { await db?.close(); });

describe("caja e inventario transaccional", () => {
  test("descuenta receta por sucursal, registra empleado y no duplica una petición repetida", async () => {
    const owner = await db.createStaff("owner");
    const barista = await db.createStaff("barista");
    const product = await db.productId("Americano (ejemplo)");
    const item = await db.rpc(owner.userId, "upsert_stock_item", [IDS.business, "Café molido de prueba", "g"], "aal2");
    expect(item.ok).toBe(true);
    const itemId = item.item_id as string;
    expect(await db.rpc(owner.userId, "set_product_recipe", [IDS.business, product, JSON.stringify([{ item_id: itemId, quantity: 18 }])], "aal2"))
      .toMatchObject({ ok: true });
    expect(await db.rpc(owner.userId, "adjust_stock", [IDS.branch, itemId, 100, 20, "Carga inicial de prueba"], "aal2"))
      .toMatchObject({ ok: true, quantity: 100 });
    const catalog = await db.rpc(barista.userId, "pos_catalog", [IDS.branch]);
    expect(catalog.ok).toBe(true);
    expect((catalog.products as { id: string; available: number }[]).find((p) => p.id === product)?.available).toBe(5);
    const key = randomUUID();
    const lines = JSON.stringify([{ product_id: product, quantity: 2 }]);
    const sale = await db.rpc(barista.userId, "record_pos_sale", [IDS.branch, key, "cash", lines]);
    expect(sale).toMatchObject({ ok: true, replayed: false });
    expect((sale.total_cents as number)).toBeGreaterThan(0);
    const replay = await db.rpc(barista.userId, "record_pos_sale", [IDS.branch, key, "cash", lines]);
    expect(replay).toMatchObject({ ok: true, replayed: true, sale_id: sale.sale_id });
    const [balance] = await db.admin<{ quantity: string }>(
      "select quantity from public.stock_balances where branch_id = $1 and item_id = $2", [IDS.branch, itemId],
    );
    expect(Number(balance.quantity)).toBe(64);
    const [saved] = await db.admin<{ staff_member_id: string; total_cents: number }>(
      "select staff_member_id, total_cents from public.pos_sales where id = $1", [sale.sale_id],
    );
    expect(saved.staff_member_id).toBe(barista.staffId);
    expect(saved.total_cents).toBe(sale.total_cents);
    const [count] = await db.admin<{ n: number }>("select count(*)::integer as n from public.stock_movements where sale_id = $1", [sale.sale_id]);
    expect(count.n).toBe(1);
    const report = await db.rpc(owner.userId, "pos_sales_report", [IDS.business, null], "aal2");
    expect(report.ok).toBe(true);
    expect((report.by_staff as { staff_id: string; total_cents: number }[]).find((r) => r.staff_id === barista.staffId)?.total_cents).toBe(sale.total_cents);
    await expect(db.admin("delete from public.pos_sale_lines where sale_id = $1", [sale.sale_id])).rejects.toThrow(/append-only/);
    await expect(db.admin("update public.stock_movements set quantity_delta = 99 where sale_id = $1", [sale.sale_id])).rejects.toThrow(/append-only/);
  });

  test("rechaza venta sin existencias, recetas ajenas y ajustes de barista", async () => {
    const owner = await db.createStaff("owner");
    const barista = await db.createStaff("barista");
    const product = await db.productId("Americano (ejemplo)");
    const item = await db.rpc(owner.userId, "upsert_stock_item", [IDS.business, "Leche de prueba", "ml"], "aal2");
    const itemId = item.item_id as string;
    expect(await db.rpc(barista.userId, "adjust_stock", [IDS.branch, itemId, 100, 10, "Carga manual"]))
      .toMatchObject({ ok: false, code: "forbidden" });
    expect(await db.rpc(owner.userId, "set_product_recipe", [IDS.business, product, JSON.stringify([{ item_id: itemId, quantity: 250 }])], "aal2"))
      .toMatchObject({ ok: true });
    const attempt = await db.rpc(barista.userId, "record_pos_sale", [IDS.branch, randomUUID(), "cash", JSON.stringify([{ product_id: product, quantity: 1 }])]);
    expect(attempt).toMatchObject({ ok: false, code: "insufficient_stock", item_id: itemId });
    const [count] = await db.admin<{ n: number }>("select count(*)::integer as n from public.pos_sales");
    expect(count.n).toBe(1);
  });

  test("importa conteo absoluto sin duplicar stock y bloquea otro rol", async () => {
    const owner = await db.createStaff("owner");
    const barista = await db.createStaff("barista");
    const rows = JSON.stringify([{ name: "Chocolate de prueba", unit: "g", quantity: 500, minimum: 100 }]);
    expect(await db.rpc(barista.userId, "import_stock_count", [IDS.branch, rows])).toMatchObject({ ok: false, code: "forbidden" });
    expect(await db.rpc(owner.userId, "import_stock_count", [IDS.branch, rows], "aal2")).toMatchObject({ ok: true, rows: 1 });
    expect(await db.rpc(owner.userId, "import_stock_count", [IDS.branch, rows], "aal2")).toMatchObject({ ok: true, rows: 1 });
    expect(await db.rpc(owner.userId, "import_stock_count", [IDS.branch,
      JSON.stringify([{ name: "Chocolate de prueba", unit: "ml", quantity: 500, minimum: 100 }])], "aal2"))
      .toMatchObject({ ok: false, code: "unit_conflict" });
    expect(await db.rpc(owner.userId, "import_stock_count", [IDS.branch,
      JSON.stringify([{ name: "Azúcar de prueba", unit: "g", quantity: 1.0001, minimum: 0 }])], "aal2"))
      .toMatchObject({ ok: false, code: "invalid_rows" });
    const [count] = await db.admin<{ n: number }>("select count(*)::integer as n from public.stock_movements where reason = 'Conteo importado de Excel/CSV'");
    expect(count.n).toBe(1);
  });

  test("el stock de una sucursal no habilita ventas en otra", async () => {
    const owner = await db.createStaff("owner");
    const barista = await db.createStaff("barista");
    const [branch] = await db.admin<{ id: string }>(
      "insert into public.branches(business_id, slug, name) values ($1, 'segunda-demo', 'Segunda demo') returning id", [IDS.business],
    );
    await db.admin("insert into public.staff_branch_access(staff_member_id, branch_id, business_id) values ($1,$2,$3)",
      [barista.staffId, branch.id, IDS.business]);
    const espresso = await db.productId("Espresso (ejemplo)");
    const lines = JSON.stringify([{ product_id: espresso, quantity: 1 }]);
    expect(await db.rpc(barista.userId, "record_pos_sale", [branch.id, randomUUID(), "cash", lines]))
      .toMatchObject({ ok: false, code: "insufficient_stock" });
    expect(await db.rpc(owner.userId, "import_stock_count", [branch.id,
      JSON.stringify([{ name: "Café molido (DEMO)", unit: "g", quantity: 100, minimum: 10 }])], "aal2"))
      .toMatchObject({ ok: true });
    const sale = await db.rpc(barista.userId, "record_pos_sale", [branch.id, randomUUID(), "cash", lines]);
    expect(sale.ok).toBe(true);
    const [second] = await db.admin<{ quantity: string }>("select quantity from public.stock_balances where branch_id = $1 and item_id = (select id from public.stock_items where name = 'Café molido (DEMO)')", [branch.id]);
    expect(Number(second.quantity)).toBe(82);
    const [first] = await db.admin<{ quantity: string }>("select quantity from public.stock_balances where branch_id = $1 and item_id = (select id from public.stock_items where name = 'Café molido (DEMO)')", [IDS.branch]);
    expect(Number(first.quantity)).toBe(3000);
  });
});
