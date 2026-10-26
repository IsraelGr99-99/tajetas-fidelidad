import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { IDS, TestDb } from "./harness";

let db: TestDb;
let owner: { userId: string };
let barista: { userId: string };

beforeAll(async () => {
  db = await TestDb.create();
  owner = await db.createStaff("owner", { branchAccess: false });
  barista = await db.createStaff("barista");
});
afterAll(async () => db?.close());

describe("categorías y variantes", () => {
  test("categorías equivalentes no se duplican y barista no puede administrarlas", async () => {
    expect(await db.rpc(owner.userId, "upsert_product_category", [IDS.business, "  Bebidas   frías "])).toMatchObject({ ok: true, name: "Bebidas frías" });
    expect(await db.rpc(owner.userId, "upsert_product_category", [IDS.business, "bebidas frías"])).toMatchObject({ ok: true, name: "Bebidas frías" });
    const rows = await db.admin("select id from public.product_categories where business_id = $1 and name_key = 'bebidas frías'", [IDS.business]);
    expect(rows).toHaveLength(1);
    expect(await db.rpc(barista.userId, "upsert_product_category", [IDS.business, "Otra"])).toMatchObject({ code: "forbidden" });
    expect(await db.as(barista.userId, "select id from public.product_categories")).toEqual([]);
  });

  test("tamaños independientes conservan precio, costo y receta propia", async () => {
    const small = await db.rpc(owner.userId, "upsert_product_variant", [IDS.business, null, "Americano nuevo", "Chico", "Bebidas", 4500, 1300, true, true]);
    const large = await db.rpc(owner.userId, "upsert_product_variant", [IDS.business, null, "americano nuevo", "Grande", "bebidas", 5900, 1900, true, true]);
    expect(small.ok).toBe(true);
    expect(large.ok).toBe(true);
    expect(small.product_id).not.toBe(large.product_id);
    const rows = await db.admin<{ name: string; category: string; price_cents: number }>(
      "select name, category, price_cents from public.products where id = any($1::uuid[]) order by price_cents",
      [[small.product_id, large.product_id]],
    );
    expect(rows).toEqual([
      { name: "Americano nuevo · Chico", category: "Bebidas", price_cents: 4500 },
      { name: "Americano nuevo · Grande", category: "Bebidas", price_cents: 5900 },
    ]);
    expect(await db.rpc(owner.userId, "upsert_product_variant", [IDS.business, null, "AMERICANO NUEVO", "chico", "Bebidas", 4700, null, true, true]))
      .toMatchObject({ code: "duplicate_name" });
  });

  test("insumo KG y kg reutiliza el registro; nombre con otra unidad se rechaza", async () => {
    const a = await db.rpc(owner.userId, "upsert_stock_item", [IDS.business, "Grano especial", "KG"]);
    const b = await db.rpc(owner.userId, "upsert_stock_item", [IDS.business, "grano  especial", "kg"]);
    expect(a).toMatchObject({ ok: true });
    expect(b.item_id).toBe(a.item_id);
    expect(await db.rpc(owner.userId, "upsert_stock_item", [IDS.business, "GRANO ESPECIAL", "g"]))
      .toMatchObject({ code: "unit_conflict" });
  });

  test("importación masiva actualiza variante existente sin duplicar", async () => {
    const rows = [{ name: "Bebida de prueba", variant_label: "Chica", category: "Bebidas", price_cents: 4000, cost_cents: 1000, eligible: true, active: true }];
    expect(await db.rpc(owner.userId, "bulk_upsert_product_variants", [IDS.business, JSON.stringify(rows)]))
      .toMatchObject({ ok: true, inserted: 1, updated: 0 });
    rows[0].name = "bebida de prueba";
    rows[0].variant_label = "chica";
    rows[0].price_cents = 4400;
    expect(await db.rpc(owner.userId, "bulk_upsert_product_variants", [IDS.business, JSON.stringify(rows)]))
      .toMatchObject({ ok: true, inserted: 0, updated: 1 });
  });

  test("conteo importado no duplica insumos por mayúsculas", async () => {
    const rows = [{ name: "Grano importado", unit: "KG", quantity: 5, minimum: 1 }];
    expect(await db.rpc(owner.userId, "import_stock_count", [IDS.branch, JSON.stringify(rows)])).toMatchObject({ ok: true, rows: 1 });
    rows[0].name = "grano importado";
    rows[0].unit = "kg";
    expect(await db.rpc(owner.userId, "import_stock_count", [IDS.branch, JSON.stringify(rows)])).toMatchObject({ ok: true, rows: 1 });
    const items = await db.admin("select id from public.stock_items where business_id = $1 and private.catalog_key(name) = 'grano importado'", [IDS.business]);
    expect(items).toHaveLength(1);
  });
});
