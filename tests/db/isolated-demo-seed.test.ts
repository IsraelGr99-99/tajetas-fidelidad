import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { TestDb } from "./harness";

const seed = readFileSync(path.resolve(import.meta.dirname, "../../supabase/demo/seed.sql"), "utf8");
const richSeed = readFileSync(path.resolve(import.meta.dirname, "../../supabase/demo/seed-rich.sql"), "utf8");
const attachStaff = readFileSync(path.resolve(import.meta.dirname, "../../supabase/demo/attach-staff.sql"), "utf8");
let db: TestDb;

beforeAll(async () => {
  db = await TestDb.create({ seed: false });
  await db.pg.exec(seed);
});
afterAll(async () => { await db?.close(); });

describe("seed aislado para demostración", () => {
  test("rechaza una base que ya contiene el piloto", async () => {
    const pilot = await TestDb.create();
    try {
      await expect(pilot.pg.exec(seed)).rejects.toThrow(/contiene otras empresas/);
      await pilot.pg.exec("rollback");
      const rows = await pilot.admin("select id from public.businesses where slug in ('norte-barber-studio', 'brisa-helados')");
      expect(rows).toEqual([]);
    } finally {
      await pilot.close();
    }
  });

  test("crea dos empresas, cuatro sucursales, catálogo y recetas sin clientes", async () => {
    const rows = await db.admin<{
      slug: string; branches: number; products: number; ingredients: number; recipes: number; customers: number;
    }>(`select b.slug,
      (select count(*)::int from public.branches br where br.business_id = b.id) as branches,
      (select count(*)::int from public.products p where p.business_id = b.id) as products,
      (select count(*)::int from public.stock_items i where i.business_id = b.id) as ingredients,
      (select count(*)::int from public.product_recipes r where r.business_id = b.id) as recipes,
      (select count(*)::int from public.customers c where c.business_id = b.id) as customers
      from public.businesses b where b.slug in ('norte-barber-studio', 'brisa-helados') order by b.slug`);
    expect(rows).toEqual([
      { slug: "brisa-helados", branches: 2, products: 6, ingredients: 6, recipes: 12, customers: 0 },
      { slug: "norte-barber-studio", branches: 2, products: 6, ingredients: 5, recipes: 8, customers: 0 },
    ]);
    expect(await db.admin("select id from public.businesses where slug = 'cafe-nomada'")).toEqual([]);
  });

  test("historial sintético consistente, aislado por empresa y reejecutable", async () => {
    const summary = async () => db.admin<{
      slug: string; imports: number; lines: number; expenses: number; mismatched: number; all_demo: boolean;
    }>(`select b.slug,
      (select count(*)::int from public.sales_imports i where i.business_id = b.id) as imports,
      (select count(*)::int from public.sales_lines l where l.business_id = b.id) as lines,
      (select count(*)::int from public.expenses e where e.business_id = b.id) as expenses,
      (select count(*)::int from public.sales_lines l join public.products p on p.id = l.product_id
         where l.business_id = b.id and p.business_id <> b.id) as mismatched,
      (select bool_and(is_demo) from public.sales_lines l where l.business_id = b.id) as all_demo
      from public.businesses b where b.slug in ('norte-barber-studio', 'brisa-helados') order by b.slug`);
    const first = await summary();
    expect(first).toEqual([
      { slug: "brisa-helados", imports: 2, lines: 720, expenses: 52, mismatched: 0, all_demo: true },
      { slug: "norte-barber-studio", imports: 2, lines: 720, expenses: 52, mismatched: 0, all_demo: true },
    ]);
    await db.pg.exec(seed);
    expect(await summary()).toEqual(first);
  });

  test("amplía el catálogo sin duplicados, con receta y existencias para cada producto", async () => {
    const demo = await TestDb.create({ seed: false });
    try {
      await demo.pg.exec(seed);
      const summary = async () => demo.admin<{
        slug: string; products: number; ingredients: number; recipes: number; without_recipe: number;
        balances: number; imports: number; lines: number; expenses: number; customers: number;
        import_mismatches: number;
      }>(`select b.slug,
        (select count(*)::int from public.products p where p.business_id = b.id) as products,
        (select count(*)::int from public.stock_items i where i.business_id = b.id) as ingredients,
        (select count(*)::int from public.product_recipes r where r.business_id = b.id) as recipes,
        (select count(*)::int from public.products p where p.business_id = b.id and not exists
          (select 1 from public.product_recipes r where r.product_id = p.id)) as without_recipe,
        (select count(*)::int from public.stock_balances s where s.business_id = b.id) as balances,
        (select count(*)::int from public.sales_imports i where i.business_id = b.id) as imports,
        (select count(*)::int from public.sales_lines l where l.business_id = b.id) as lines,
        (select count(*)::int from public.expenses e where e.business_id = b.id) as expenses,
        (select count(*)::int from public.customers c where c.business_id = b.id) as customers,
        (select count(*)::int from public.sales_imports i where i.business_id = b.id and
          (i.row_count <> (select count(*) from public.sales_lines l where l.import_id = i.id)
           or i.total_cents <> (select coalesce(sum(l.total_cents), 0) from public.sales_lines l where l.import_id = i.id))) as import_mismatches
        from public.businesses b order by b.slug`);
      await demo.pg.exec(richSeed);
      const first = await summary();
      expect(first).toEqual([
        { slug: "brisa-helados", products: 14, ingredients: 13, recipes: 29, without_recipe: 0,
          balances: 26, imports: 4, lines: 1680, expenses: 60, customers: 0, import_mismatches: 0 },
        { slug: "norte-barber-studio", products: 14, ingredients: 12, recipes: 22, without_recipe: 0,
          balances: 24, imports: 4, lines: 1680, expenses: 60, customers: 0, import_mismatches: 0 },
      ]);
      await demo.pg.exec(richSeed);
      expect(await summary()).toEqual(first);
    } finally {
      await demo.close();
    }
  });

  test("vincula al propietario y responsables únicamente con cuentas Auth verificadas", async () => {
    const owner = await db.createUser({ email: "owner-demo@staff.test" });
    const norte = await db.createUser({ email: "norte-demo@staff.test" });
    const brisa = await db.createUser({ email: "brisa-demo@staff.test" });
    await db.admin("select set_config('app.demo_owner_user_id', $1, false)", [owner]);
    await db.admin("select set_config('app.demo_norte_manager_user_id', $1, false)", [norte]);
    await db.admin("select set_config('app.demo_brisa_manager_user_id', $1, false)", [brisa]);
    await db.pg.exec(attachStaff);
    await db.pg.exec(attachStaff);
    const rows = await db.admin<{ slug: string; role: string; count: number }>(`select b.slug, sm.role::text as role, count(*)::int as count
      from public.staff_members sm join public.businesses b on b.id = sm.business_id
      where b.slug in ('norte-barber-studio', 'brisa-helados')
      group by b.slug, sm.role order by b.slug, sm.role`);
    expect(rows).toEqual([
      { slug: "brisa-helados", role: "owner", count: 1 },
      { slug: "brisa-helados", role: "manager", count: 1 },
      { slug: "norte-barber-studio", role: "owner", count: 1 },
      { slug: "norte-barber-studio", role: "manager", count: 1 },
    ]);
    const visibleToNorte = await db.as<{ business_id: string }>(norte,
      "select distinct business_id from public.products order by business_id");
    expect(visibleToNorte).toEqual([{ business_id: "10000000-0000-4000-8000-000000000001" }]);
    const visibleToBrisa = await db.as<{ business_id: string }>(brisa,
      "select distinct business_id from public.products order by business_id");
    expect(visibleToBrisa).toEqual([{ business_id: "20000000-0000-4000-8000-000000000001" }]);
  });
});
