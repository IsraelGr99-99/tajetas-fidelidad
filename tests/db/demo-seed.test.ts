import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { IDS, TestDb } from "./harness";

let db: TestDb;

beforeAll(async () => { db = await TestDb.create(); });
afterAll(async () => { await db?.close(); });

describe("catálogo de la demo guiada", () => {
  test("trae variantes, costos, recetas y una alerta de mínimo sin clientes ficticios", async () => {
    const [summary] = await db.admin<{
      products: number; items: number; with_recipes: number; with_cost: number; variants: number; low_stock: number; customers: number;
    }>(`select
      (select count(*)::int from public.products where business_id = $1) as products,
      (select count(*)::int from public.stock_items where business_id = $1) as items,
      (select count(distinct product_id)::int from public.product_recipes where business_id = $1) as with_recipes,
      (select count(*)::int from public.products where business_id = $1 and cost_cents is not null) as with_cost,
      (select count(*)::int from public.products where business_id = $1 and variant_label is not null) as variants,
      (select count(*)::int from public.stock_balances where business_id = $1 and quantity < minimum) as low_stock,
      (select count(*)::int from public.customers where business_id = $1) as customers`, [IDS.business]);
    expect(summary).toMatchObject({ products: 15, items: 10, with_recipes: 15, with_cost: 15, variants: 7, low_stock: 1, customers: 0 });
  });

  test("repetir el seed no duplica ni sobrescribe el catálogo", async () => {
    const [before] = await db.admin<{ id: string }>("select id from public.products where name = 'Latte · Grande (DEMO)'");
    await db.pg.exec(readFileSync(path.resolve(import.meta.dirname, "../../supabase/seed.sql"), "utf8"));
    const [after] = await db.admin<{ id: string }>("select id from public.products where name = 'Latte · Grande (DEMO)'");
    const [counts] = await db.admin<{ products: number; recipes: number }>(`select
      (select count(*)::int from public.products where business_id = $1) as products,
      (select count(*)::int from public.product_recipes where business_id = $1) as recipes`, [IDS.business]);
    expect(after.id).toBe(before.id);
    expect(counts).toMatchObject({ products: 15, recipes: 28 });
  });

  test("la migración agrega faltantes solo mientras el negocio sea demo", async () => {
    const sql = readFileSync(path.resolve(import.meta.dirname, "../../supabase/migrations/20261030120000_demo_catalog.sql"), "utf8");
    await db.admin("delete from public.product_recipes where product_id in (select id from public.products where name = 'Latte · Grande (DEMO)')");
    await db.admin("delete from public.products where name = 'Latte · Grande (DEMO)'");
    await db.admin("update public.businesses set is_demo = false where id = $1", [IDS.business]);
    await db.pg.exec(sql);
    expect(await db.admin("select id from public.products where name = 'Latte · Grande (DEMO)'")).toEqual([]);

    await db.admin("update public.businesses set is_demo = true where id = $1", [IDS.business]);
    await db.pg.exec(sql);
    const restored = await db.admin("select id from public.products where name = 'Latte · Grande (DEMO)'");
    expect(restored).toHaveLength(1);
    const recipes = await db.admin("select item_id from public.product_recipes where product_id = $1", [(restored[0] as { id: string }).id]);
    expect(recipes).toHaveLength(2);
    await db.pg.exec(sql);
    expect(await db.admin("select id from public.products where name = 'Latte · Grande (DEMO)' ")).toHaveLength(1);
  });
});
