import { afterAll, beforeAll, expect, test } from "vitest";
import { IDS, TestDb } from "./harness";

let db: TestDb;
let secondBranch: string;

beforeAll(async () => {
  db = await TestDb.create();
  [{ id: secondBranch }] = await db.admin<{ id: string }>(
    "insert into public.branches (business_id, slug, name) values ($1, 'centro-historico', 'Centro Histórico') returning id",
    [IDS.business],
  );
});
afterAll(async () => {
  await db?.close();
});

type Membership = { role: string; business_slug: string; branches: { id: string }[] };

test("owner ve todas las sucursales activas", async () => {
  const owner = await db.createStaff("owner", { branchAccess: false });
  const r = await db.rpc(owner.userId, "get_staff_context", []);
  const [m] = r.memberships as Membership[];
  expect(m).toMatchObject({ role: "owner", business_slug: "cafe-nomada" });
  expect(m.branches.map((b) => b.id).sort()).toEqual([IDS.branch, secondBranch].sort());
});

test("barista solo ve sus sucursales asignadas", async () => {
  const barista = await db.createStaff("barista");
  const r = await db.rpc(barista.userId, "get_staff_context", []);
  const [m] = r.memberships as Membership[];
  expect(m.branches.map((b) => b.id)).toEqual([IDS.branch]);
});

test("sucursales inactivas no aparecen", async () => {
  const owner = await db.createStaff("owner", { branchAccess: false });
  await db.admin("update public.branches set active = false where id = $1", [secondBranch]);
  const r = await db.rpc(owner.userId, "get_staff_context", []);
  expect((r.memberships as Membership[])[0].branches.map((b) => b.id)).toEqual([IDS.branch]);
  await db.admin("update public.branches set active = true where id = $1", [secondBranch]);
});

test("un cliente sin rol recibe lista vacía; personal inactivo también", async () => {
  const c = await db.createCustomer();
  expect(await db.rpc(c.userId, "get_staff_context", [])).toEqual({ ok: true, memberships: [] });
  const barista = await db.createStaff("barista");
  await db.admin("update public.staff_members set active = false where user_id = $1", [barista.userId]);
  expect(await db.rpc(barista.userId, "get_staff_context", [])).toEqual({ ok: true, memberships: [] });
});

test("anon no puede consultar el contexto", async () => {
  await expect(db.rpc(null, "get_staff_context", [])).rejects.toThrow(/permission denied/);
});
