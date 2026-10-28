import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { IDS, TestDb, idemKey, ticketHash } from "./harness";

/** Regresiones de la auditoría de seguridad independiente (ver docs/seguridad.md). */
let db: TestDb;
let americano: string;

beforeAll(async () => {
  db = await TestDb.create();
  americano = await db.productId("Americano (ejemplo)");
});
afterAll(async () => {
  await db?.close();
});

const items = () => JSON.stringify([{ product_id: americano, quantity: 1 }]);

describe("M1: el personal no se acredita a sí mismo", () => {
  test("un barista inscrito como cliente no puede apartar, acreditar ni canjear su tarjeta", async () => {
    const barista = await db.createStaff("barista");
    const r = await db.rpc(barista.userId, "enroll_customer", ["cafe-nomada", "Yo", "2026-10-23"]);
    expect(r.ok).toBe(true);
    const cardId = r.card_id as string;

    const token = await db.scanToken(barista.userId, cardId);
    expect(await db.rpc(barista.userId, "staff_claim_card", [IDS.branch, token, ticketHash()])).toMatchObject({ code: "self_service_forbidden" });
    const token2 = await db.scanToken(barista.userId, cardId);
    expect(await db.rpc(barista.userId, "record_earn", [IDS.branch, idemKey(), ticketHash(), items(), token2, null, null])).toMatchObject({
      code: "self_service_forbidden",
    });

    // Un compañero sí puede atenderlo (queda auditado con su nombre).
    const coworker = await db.createStaff("barista");
    const token3 = await db.scanToken(barista.userId, cardId);
    expect((await db.rpc(coworker.userId, "record_earn", [IDS.branch, idemKey(), ticketHash(), items(), token3, null, null])).ok).toBe(true);
  });
});

describe("M2: la baja del cliente actualiza la versión de la tarjeta (para el pase de Wallet)", () => {
  test("version sube al eliminar los datos", async () => {
    const c = await db.createCustomer();
    const [before] = await db.admin<{ version: number }>("select version from public.loyalty_cards where id = $1", [c.cardId]);
    await db.rpc(c.userId, "delete_my_customer_data", ["cafe-nomada", "privacidad"]);
    const [after] = await db.admin<{ version: number }>("select version from public.loyalty_cards where id = $1", [c.cardId]);
    expect(Number(after.version)).toBe(Number(before.version) + 1);
    const [{ r: snap }] = await db.service<{ r: Record<string, unknown> }>("select public.wallet_card_snapshot($1) as r", [c.cardId]);
    expect(snap).toMatchObject({ customer_active: false, display_name: null });
  });
});

describe("M4: MFA para owner/admin", () => {
  test("con un factor verificado, administrar exige sesión aal2; sin factor no cambia", async () => {
    const owner = await db.createStaff("owner", { branchAccess: false });
    expect((await db.rpc(owner.userId, "business_summary", [IDS.business])).ok).toBe(true);

    await db.admin("insert into auth.mfa_factors (user_id, status) values ($1, 'verified')", [owner.userId]);
    expect(await db.rpc(owner.userId, "business_summary", [IDS.business], "aal1")).toMatchObject({ code: "forbidden" });
    expect((await db.rpc(owner.userId, "business_summary", [IDS.business], "aal2")).ok).toBe(true);

    // El contexto avisa a la UI que falta el segundo paso.
    const ctx = await db.rpc(owner.userId, "get_staff_context", [], "aal1");
    expect((ctx.memberships as { mfa_pending: boolean }[])[0].mfa_pending).toBe(true);
    const ctx2 = await db.rpc(owner.userId, "get_staff_context", [], "aal2");
    expect((ctx2.memberships as { mfa_pending: boolean }[])[0].mfa_pending).toBe(false);
  });

  test("un barista con MFA no necesita aal2 para la barra", async () => {
    const barista = await db.createStaff("barista");
    await db.admin("insert into auth.mfa_factors (user_id, status) values ($1, 'verified')", [barista.userId]);
    const c = await db.createCustomer();
    const token = await db.scanToken(c.userId, c.cardId);
    expect((await db.rpc(barista.userId, "staff_claim_card", [IDS.branch, token, ticketHash()], "aal1")).ok).toBe(true);
  });
});

describe("B1: rechazos de usuarios ajenos no van a la bitácora de la empresa", () => {
  test("se registran sin empresa y con límite por usuario", async () => {
    const intruder = await db.createUser({ email: `i-${randomUUID().slice(0, 6)}@correo.test` });
    for (let i = 0; i < 70; i++) await db.rpc(intruder, "upsert_product", [IDS.business, null, "Hack", "Bebidas", 1, true, true]);
    const rows = await db.admin<{ business_id: string | null }>("select business_id from public.audit_log where actor_user_id = $1", [intruder]);
    expect(rows.every((r) => r.business_id === null)).toBe(true);
    expect(rows.length).toBeLessThanOrEqual(60);
  });
});

describe("B4: un cambio de regla no emite recompensas en masa", () => {
  test("como máximo una recompensa por evento", async () => {
    const owner = await db.createStaff("owner", { branchAccess: false });
    const c = await db.createCustomer();
    const r = await db.rpc(owner.userId, "adjust_stamps", [c.cardId, 20, "Migración de tarjeta física", idemKey()]);
    expect(r).toMatchObject({ ok: true, rewards_issued: 1, rewards_balance: 1, stamps_balance: 11 });
  });
});

describe("B5: la sucursal demo no se activa", () => {
  test("upsert_branch rechaza activar una sucursal demo", async () => {
    const owner = await db.createStaff("owner", { branchAccess: false });
    expect((await db.rpc(owner.userId, "generate_demo_finance", [IDS.business, 7])).ok).toBe(true);
    const [demo] = await db.admin<{ id: string }>("select id from public.branches where is_demo");
    expect(await db.rpc(owner.userId, "upsert_branch", [IDS.business, demo.id, "x", "Angelópolis (DEMO)", null, true])).toMatchObject({
      code: "demo_branch_locked",
    });
    await db.rpc(owner.userId, "clear_demo_finance", [IDS.business]);
  });
});

describe("B8: revertir un descuento manual puede completar el ciclo", () => {
  test("emite la recompensa al revertir", async () => {
    const owner = await db.createStaff("owner", { branchAccess: false });
    const c = await db.createCustomer();
    await db.rpc(owner.userId, "adjust_stamps", [c.cardId, 8, "Saldo inicial de prueba", idemKey()]);
    const down = await db.rpc(owner.userId, "adjust_stamps", [c.cardId, -3, "Corrección equivocada", idemKey()]);
    await db.rpc(owner.userId, "adjust_stamps", [c.cardId, 4, "Nuevos sellos", idemKey()]); // 9 → emite 1
    const before = await db.card(c.cardId);
    const r = await db.rpc(owner.userId, "reverse_ledger_event", [down.event_id, "La corrección fue un error", idemKey(), "voided"]);
    expect(r.ok).toBe(true);
    const after = await db.card(c.cardId);
    expect(after.rewards_balance).toBe(before.rewards_balance + (before.stamps_balance + 3 >= 9 ? 1 : 0));
    expect(after.consistent).toBe(true);
  });
});

describe("I2/I3: lectura acotada de campañas y tarjetas", () => {
  test("otra empresa no lee campañas; un gerente no lee todas las tarjetas", async () => {
    const [{ id: other }] = await db.admin<{ id: string }>("insert into public.businesses (slug, name) values ('ajena', 'Ajena') returning id");
    const outsider = await db.createStaff("owner", { businessId: other, branchAccess: false });
    expect(await db.as(outsider.userId, "select id from public.campaign_versions where business_id = $1", [IDS.business])).toEqual([]);
    const manager = await db.createStaff("manager");
    await db.createCustomer();
    expect(await db.as(manager.userId, "select id from public.loyalty_cards")).toEqual([]);
    const customer = await db.createCustomer();
    expect((await db.as(customer.userId, "select id from public.campaign_versions")).length).toBeGreaterThan(0);
  });
});

describe("I5: inventario de funciones ejecutables", () => {
  test("anon no ejecuta ninguna función de public ni de private", async () => {
    const rows = await db.admin<{ name: string }>(`
      select n.nspname || '.' || p.proname as name
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private') and has_function_privilege('anon', p.oid, 'execute')`);
    expect(rows).toEqual([]);
  });

  test("authenticated solo ejecuta la lista permitida", async () => {
    const allowed = new Set([
      "public.enroll_customer", "public.get_my_card", "public.issue_scan_token", "public.record_earn", "public.redeem_reward",
      "public.reverse_ledger_event", "public.adjust_stamps", "public.publish_campaign_version", "public.get_staff_context",
      "public.list_ledger", "public.business_summary", "public.upsert_product", "public.upsert_branch", "public.invite_staff",
      "public.revoke_staff_invitation", "public.claim_staff_invitations", "public.update_staff_member", "public.list_staff",
      "public.admin_find_customers", "public.delete_my_customer_data", "public.staff_claim_card", "public.staff_release_hold",
      "public.my_card_status", "public.staff_catalog", "public.bulk_upsert_products", "public.set_product_cost", "public.admin_catalog",
      "public.import_sales", "public.delete_sales_import", "public.add_expenses", "public.delete_expense", "public.generate_demo_finance",
      "public.clear_demo_finance", "public.finance_dashboard", "public.finance_records",
      "public.upsert_stock_item", "public.set_product_recipe", "public.adjust_stock", "public.import_stock_count",
      "public.record_pos_sale", "public.inventory_overview", "public.pos_catalog", "public.pos_sales_report",
      "public.upsert_product_category", "public.upsert_product_variant", "public.bulk_upsert_product_variants", "public.set_product_image_path",
      "public.operations_dashboard", "public.set_my_birthday_offer", "public.get_my_birthday_offer", "public.enroll_customer_with_birthday",
      "public.get_my_account_status", "public.disable_my_customer_account", "public.reactivate_my_customer_account",
      "public.change_stock_item_unit", "public.set_business_card_theme", "public.create_demo_business",
      "private.staff_role_in", "private.has_role", "private.can_operate_branch", "private.owns_card",
    ]);
    const rows = await db.admin<{ name: string }>(`
      select distinct n.nspname || '.' || p.proname as name
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private') and has_function_privilege('authenticated', p.oid, 'execute')`);
    const unexpected = rows.map((r) => r.name).filter((n) => !allowed.has(n));
    expect(unexpected).toEqual([]);
  });
});

describe("Retención de datos temporales", () => {
  test("cleanup_ephemeral borra códigos caducados hace más de 24 h y conserva los vigentes", async () => {
    const c = await db.createCustomer();
    const fresh = await db.scanToken(c.userId, c.cardId);
    const old = await db.scanToken(c.userId, c.cardId);
    await db.admin(
      "update public.scan_tokens set created_at = now() - interval '3 days', expires_at = now() - interval '3 days' + interval '2 minutes' where token_hash = $1",
      [old],
    );
    const [{ r }] = await db.admin<{ r: { scan_tokens: number } }>("select private.cleanup_ephemeral() as r");
    expect(r.scan_tokens).toBeGreaterThanOrEqual(1);
    expect(await db.admin("select 1 from public.scan_tokens where token_hash = $1", [old])).toEqual([]);
    expect((await db.admin("select 1 from public.scan_tokens where token_hash = $1", [fresh])).length).toBe(1);
  });
});

describe("Re-revisión", () => {
  test("N2: un owner con MFA y sesión aal1 puede operar la barra, pero no administrar", async () => {
    const owner = await db.createStaff("owner", { branchAccess: false });
    await db.admin("insert into auth.mfa_factors (user_id, status) values ($1, 'verified')", [owner.userId]);
    const c = await db.createCustomer();
    const token = await db.scanToken(c.userId, c.cardId);
    expect((await db.rpc(owner.userId, "staff_claim_card", [IDS.branch, token, ticketHash()], "aal1")).ok).toBe(true);
    expect(await db.rpc(owner.userId, "adjust_stamps", [c.cardId, 1, "Ajuste sin segundo paso", idemKey()], "aal1")).toMatchObject({ code: "not_found" });
  });
});
