import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { IDS, TestDb, idemKey, ticketHash } from "./harness";

let db: TestDb;
let owner: { userId: string; staffId: string };
let manager: { userId: string; staffId: string };
let barista: { userId: string; staffId: string };

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

beforeAll(async () => {
  db = await TestDb.create();
  owner = await db.createStaff("owner", { branchAccess: false });
  manager = await db.createStaff("manager");
  barista = await db.createStaff("barista");
});
afterAll(async () => {
  await db?.close();
});

describe("catálogo por importación", () => {
  test("alta y actualización por nombre (sin importar mayúsculas), con costo", async () => {
    const r = await db.rpc(owner.userId, "bulk_upsert_products", [
      IDS.business,
      JSON.stringify([
        { name: "Cold brew", category: "Bebidas", price_cents: 6800, cost_cents: 1900, eligible: true, active: true },
        { name: "americano (ejemplo)", category: "Bebidas", price_cents: 5200, cost_cents: 1200, eligible: true, active: true },
      ]),
    ]);
    expect(r).toMatchObject({ ok: true, inserted: 1, updated: 1 });
    const [p] = await db.admin<{ price_cents: number; cost_cents: number }>(
      "select price_cents, cost_cents from public.products where name = 'Americano (ejemplo)'",
    );
    expect(p).toEqual({ price_cents: 5200, cost_cents: 1200 });
  });

  test("todo o nada: un renglón inválido no guarda ninguno", async () => {
    const r = await db.rpc(owner.userId, "bulk_upsert_products", [
      IDS.business,
      JSON.stringify([
        { name: "Válido nuevo", category: "Bebidas", price_cents: 5000, eligible: true },
        { name: "X", category: "Bebidas", price_cents: -1 },
      ]),
    ]);
    expect(r).toMatchObject({ ok: false, code: "invalid_rows" });
    expect(await db.admin("select 1 from public.products where name = 'Válido nuevo'")).toEqual([]);
  });

  test("gerente y barista no importan; el costo no es visible para el barista", async () => {
    expect(await db.rpc(manager.userId, "bulk_upsert_products", [IDS.business, "[]"])).toMatchObject({ code: "forbidden" });
    await expect(db.as(barista.userId, "select cost_cents from public.products")).rejects.toThrow(/permission denied/);
    expect((await db.as(barista.userId, "select name from public.products")).length).toBeGreaterThan(0);
    expect(await db.rpc(barista.userId, "admin_catalog", [IDS.business])).toMatchObject({ code: "forbidden" });
  });
});

describe("ventas del POS", () => {
  const rows = () =>
    JSON.stringify([
      { sold_on: daysAgo(1), product_name: "Cold brew", quantity: 3, total_cents: 20400 },
      { sold_on: daysAgo(1), product_name: "Producto que no existe", category: "Otros", quantity: 1, total_cents: 5000 },
      { sold_on: today(), product_name: "COLD BREW", quantity: 1, total_cents: 6800 },
    ]);

  test("importa, empata productos por nombre y rechaza el mismo archivo dos veces", async () => {
    const r = await db.rpc(owner.userId, "import_sales", [IDS.business, IDS.branch, "ventas.xlsx", rows()]);
    expect(r).toMatchObject({ ok: true, rows: 3, matched: 2, total_cents: 32200 });
    expect(await db.rpc(owner.userId, "import_sales", [IDS.business, IDS.branch, "ventas.xlsx", rows()])).toMatchObject({ code: "duplicate_import" });
  });

  test("renglones inválidos se rechazan completos", async () => {
    const bad = JSON.stringify([{ sold_on: "no-es-fecha", product_name: "X", quantity: 1, total_cents: 1 }]);
    expect(await db.rpc(owner.userId, "import_sales", [IDS.business, IDS.branch, "malo.csv", bad])).toMatchObject({ code: "invalid_rows" });
  });

  test("sucursal de otra empresa: no encontrada", async () => {
    const [{ id: other }] = await db.admin<{ id: string }>("insert into public.businesses (slug, name) values ('otro-negocio', 'Otro') returning id");
    const [{ id: otherBranch }] = await db.admin<{ id: string }>(
      "insert into public.branches (business_id, slug, name) values ($1, 'xalapa', 'Xalapa') returning id",
      [other],
    );
    expect(await db.rpc(owner.userId, "import_sales", [IDS.business, otherBranch, "x.csv", rows()])).toMatchObject({ code: "not_found" });
  });
});

describe("gastos y dashboard", () => {
  test("gastos manuales y cálculo de utilidad con costo conocido", async () => {
    expect(
      await db.rpc(owner.userId, "add_expenses", [
        IDS.business,
        JSON.stringify([{ branch_id: IDS.branch, spent_on: daysAgo(1), category: "Insumos", description: "Leche", amount_cents: 10000 }]),
      ]),
    ).toMatchObject({ ok: true, inserted: 1 });

    // Una visita con tarjeta para la sección de fidelidad.
    const c = await db.createCustomer();
    const token = await db.scanToken(c.userId, c.cardId);
    const americano = await db.productId("Americano (ejemplo)");
    await db.rpc(barista.userId, "record_earn", [IDS.branch, idemKey(), ticketHash(), JSON.stringify([{ product_id: americano, quantity: 1 }]), token, null, null]);

    const d = await db.rpc(owner.userId, "finance_dashboard", [IDS.business, daysAgo(7), today(), false]);
    const t = d.totals as Record<string, number>;
    expect(d).toMatchObject({ ok: true, has_pos_data: true });
    expect(t.pos_sales_cents).toBe(32200);
    // Costo conocido solo para Cold brew: 4 × $19.00.
    expect(t.cogs_cents).toBe(7600);
    expect(t.gross_profit_cents).toBe(32200 - 7600);
    expect(t.expenses_cents).toBe(10000);
    expect(t.net_profit_cents).toBe(32200 - 7600 - 10000);
    expect(t.card_visits).toBe(1);
    expect(t.card_sales_cents).toBe(5200);
    const top = d.top_products as { name: string; revenue_cents: number }[];
    expect(top[0]).toMatchObject({ revenue_cents: 20400 });
    expect((d.by_day as unknown[]).length).toBe(8);
  });

  test("solo administración ve el dashboard; rango inválido rechazado", async () => {
    expect(await db.rpc(manager.userId, "finance_dashboard", [IDS.business, daysAgo(7), today(), true])).toMatchObject({ code: "forbidden" });
    expect(await db.rpc(owner.userId, "finance_dashboard", [IDS.business, today(), daysAgo(7), true])).toMatchObject({ code: "invalid_request" });
    expect(await db.rpc(owner.userId, "finance_dashboard", [IDS.business, daysAgo(400), today(), true])).toMatchObject({ code: "invalid_request" });
  });
});

describe("datos de demostración", () => {
  test("se generan marcados como demo, se excluyen a voluntad y se borran", async () => {
    const r = await db.rpc(owner.userId, "generate_demo_finance", [IDS.business, 30]);
    expect(r).toMatchObject({ ok: true, days: 30 });
    expect(await db.rpc(owner.userId, "generate_demo_finance", [IDS.business, 30])).toMatchObject({ code: "demo_exists" });

    const withDemo = await db.rpc(owner.userId, "finance_dashboard", [IDS.business, daysAgo(29), today(), true]);
    const withoutDemo = await db.rpc(owner.userId, "finance_dashboard", [IDS.business, daysAgo(29), today(), false]);
    expect((withDemo.totals as Record<string, number>).pos_sales_cents).toBeGreaterThan((withoutDemo.totals as Record<string, number>).pos_sales_cents);
    expect(withDemo.has_demo).toBe(true);
    const branches = withDemo.by_branch as { name: string; is_demo: boolean; pos_sales_cents: number }[];
    expect(branches.find((b) => b.is_demo)?.name).toContain("DEMO");
    // La sucursal demo no aparece para operar.
    const [demoBranch] = await db.admin<{ active: boolean }>("select active from public.branches where is_demo");
    expect(demoBranch.active).toBe(false);

    expect((await db.rpc(owner.userId, "clear_demo_finance", [IDS.business])).ok).toBe(true);
    expect(await db.admin("select 1 from public.sales_lines where is_demo")).toEqual([]);
    expect(await db.admin("select 1 from public.expenses where is_demo")).toEqual([]);
    expect(await db.admin("select 1 from public.branches where is_demo")).toEqual([]);
    // Los datos reales siguen ahí.
    expect((await db.admin("select 1 from public.sales_lines where not is_demo")).length).toBe(3);
  });

  test("solo administración genera datos demo", async () => {
    expect(await db.rpc(manager.userId, "generate_demo_finance", [IDS.business, 30])).toMatchObject({ code: "forbidden" });
  });
});

describe("privilegios", () => {
  test.each(["import_sales", "add_expenses", "finance_dashboard", "generate_demo_finance", "bulk_upsert_products"])("anon no ejecuta %s", async (fn) => {
    await expect(db.as(null, `select public.${fn}()`)).rejects.toThrow(/permission denied|does not exist/);
  });
  test("barista no lee ventas ni gastos", async () => {
    expect(await db.as(barista.userId, "select id from public.sales_lines")).toEqual([]);
    expect(await db.as(barista.userId, "select id from public.expenses")).toEqual([]);
  });
});
