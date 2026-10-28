import { afterAll, beforeAll, expect, test } from "vitest";
import { IDS, TestDb } from "./harness";

let db: TestDb;

beforeAll(async () => { db = await TestDb.create(); });
afterAll(async () => { await db?.close(); });

test("solo propietario con correo verificado y segundo factor crea un negocio DEMO aislado", async () => {
  const owner = await db.createStaff("owner");
  const barista = await db.createStaff("barista");
  const input = ["heladeria-sol", "Heladería Sol", "Centro"];

  await expect(db.rpc(null, "create_demo_business", input)).rejects.toThrow(/permission denied/);
  expect(await db.rpc(barista.userId, "create_demo_business", input, "aal2")).toMatchObject({ ok: false, code: "forbidden" });
  await db.admin("insert into auth.mfa_factors (user_id, status) values ($1, 'verified')", [owner.userId]);
  expect(await db.rpc(owner.userId, "create_demo_business", input)).toMatchObject({ ok: false, code: "mfa_required" });
  const created = await db.rpc(owner.userId, "create_demo_business", input, "aal2");
  expect(created).toMatchObject({ ok: true, slug: "heladeria-sol" });
  const businessId = created.business_id as string;
  const branchId = created.branch_id as string;
  expect(await db.rpc(owner.userId, "create_demo_business", input, "aal2")).toMatchObject({ ok: false, code: "slug_taken" });

  const context = await db.rpc(owner.userId, "get_staff_context", []);
  const memberships = context.memberships as { business_id: string; business_slug: string; branches: { id: string }[] }[];
  expect(memberships.map((item) => item.business_slug).sort()).toEqual(["cafe-nomada", "heladeria-sol"]);
  expect(memberships.find((item) => item.business_id === businessId)?.branches).toEqual([{ id: branchId, slug: "principal", name: "Centro" }]);
  expect(memberships.find((item) => item.business_id === IDS.business)?.branches.some((item) => item.id === branchId)).toBe(false);

  const outsider = await db.createStaff("owner");
  expect(await db.rpc(outsider.userId, "admin_catalog", [businessId], "aal2")).toMatchObject({ ok: false, code: "forbidden" });
  expect(await db.as(outsider.userId, "select id from public.staff_members where business_id = $1", [businessId])).toEqual([]);
  expect(await db.as(barista.userId, "select id from public.products where business_id = $1", [businessId])).toEqual([]);
});

test("un cliente puede tener tarjetas independientes y borrar solo una", async () => {
  const owner = await db.createStaff("owner");
  await db.admin("insert into auth.mfa_factors (user_id, status) values ($1, 'verified')", [owner.userId]);
  const created = await db.rpc(owner.userId, "create_demo_business", ["reposteria-luna", "Repostería Luna", "Principal"], "aal2");
  expect(created.ok).toBe(true);
  const customer = await db.createCustomer();
  const second = await db.rpc(customer.userId, "enroll_customer", ["reposteria-luna", "Cliente", "2026-10-23"]);
  expect(second.ok).toBe(true);
  expect((await db.rpc(customer.userId, "get_my_card", ["cafe-nomada"])).card).toMatchObject({ id: customer.cardId });
  expect((await db.rpc(customer.userId, "get_my_card", ["reposteria-luna"])).card).toMatchObject({ id: second.card_id });
  expect(await db.rpc(customer.userId, "delete_my_customer_data", ["cafe-nomada", "privacidad"])).toMatchObject({ ok: true });
  expect(await db.rpc(customer.userId, "get_my_card", ["cafe-nomada"])).toMatchObject({ ok: false });
  expect((await db.rpc(customer.userId, "get_my_card", ["reposteria-luna"])).card).toMatchObject({ id: second.card_id });
  const remaining = await db.as<{ id: string }>(customer.userId, "select id from public.customers where auth_user_id = $1 and status = 'active'", [customer.userId]);
  expect(remaining).toHaveLength(1);
});

test("el alta exige correo verificado y respeta el límite de espacios DEMO", async () => {
  const owner = await db.createStaff("owner");
  await db.admin("insert into auth.mfa_factors (user_id, status) values ($1, 'verified')", [owner.userId]);
  await db.admin("update auth.users set email_confirmed_at = null where id = $1", [owner.userId]);
  expect(await db.rpc(owner.userId, "create_demo_business", ["sin-correo", "Sin Correo", "Principal"], "aal2"))
    .toMatchObject({ ok: false, code: "email_unverified" });
  await db.admin("update auth.users set email_confirmed_at = now() where id = $1", [owner.userId]);
  expect((await db.rpc(owner.userId, "create_demo_business", ["demo-uno", "Demo Uno", "Principal"], "aal2")).ok).toBe(true);
  expect((await db.rpc(owner.userId, "create_demo_business", ["demo-dos", "Demo Dos", "Principal"], "aal2")).ok).toBe(true);
  expect(await db.rpc(owner.userId, "create_demo_business", ["demo-tres", "Demo Tres", "Principal"], "aal2"))
    .toMatchObject({ ok: false, code: "demo_limit" });
});
