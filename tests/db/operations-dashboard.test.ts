import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { IDS, TestDb } from "./harness";

let db: TestDb;
let owner: { userId: string; staffId: string };
let barista: { userId: string };

beforeAll(async () => {
  db = await TestDb.create();
  owner = await db.createStaff("owner", { branchAccess: false });
  barista = await db.createStaff("barista");
});
afterAll(async () => db?.close());

describe("tablero operativo", () => {
  test("suma ventas de caja de la semana y muestra pendientes reales", async () => {
    const item = await db.rpc(owner.userId, "upsert_stock_item", [IDS.business, "Vasos tablero", "pieza"]);
    await db.rpc(owner.userId, "adjust_stock", [IDS.branch, item.item_id, 5, 10, "Carga de prueba"]);
    await db.admin(
      "insert into public.pos_sales(business_id,branch_id,staff_member_id,idempotency_key,payment_method,total_cents) values ($1,$2,$3,$4,'cash',7500)",
      [IDS.business, IDS.branch, owner.staffId, randomUUID()],
    );
    const d = await db.rpc(owner.userId, "operations_dashboard", [IDS.business, IDS.branch]);
    expect(d).toMatchObject({ ok: true, weekly_sales_cents: 7500, weekly_sales_count: 1 });
    expect(Number(d.low_stock_count)).toBeGreaterThanOrEqual(1);
    expect((d.recent_events as { kind: string }[]).some((e) => e.kind === "sale")).toBe(true);
    expect((d.recent_events as { kind: string }[]).some((e) => e.kind === "stock")).toBe(true);
  });

  test("barista no ve el tablero y sucursal ajena se rechaza", async () => {
    expect(await db.rpc(barista.userId, "operations_dashboard", [IDS.business, null])).toMatchObject({ code: "forbidden" });
    expect(await db.rpc(owner.userId, "operations_dashboard", [IDS.business, randomUUID()])).toMatchObject({ code: "invalid_request" });
  });
});
