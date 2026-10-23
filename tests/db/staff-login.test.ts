import { afterAll, beforeAll, expect, test } from "vitest";
import { IDS, TestDb, sha256 } from "./harness";

let db: TestDb;
const client = sha256("dispositivo-1");

beforeAll(async () => {
  db = await TestDb.create();
});
afterAll(async () => {
  await db?.close();
});

async function request(email: string, clientHash = client) {
  const [r] = await db.service<{ r: Record<string, unknown> }>("select public.request_staff_login_code($1, $2) as r", [email, clientHash]);
  return r.r;
}

test("personal activo e invitaciones pendientes son elegibles; otros no", async () => {
  const staff = await db.createStaff("barista");
  const [{ email }] = await db.admin<{ email: string }>("select email from auth.users where id = $1", [staff.userId]);
  expect(await request(email)).toEqual({ ok: true, eligible: true });

  const owner = await db.createStaff("owner", { branchAccess: false });
  await db.rpc(owner.userId, "invite_staff", [IDS.business, "invitada@correo.test", "Invitada", "barista", [IDS.branch]]);
  expect(await request("Invitada@Correo.test", sha256("d2"))).toEqual({ ok: true, eligible: true });

  expect(await request("desconocido@correo.test", sha256("d3"))).toEqual({ ok: true, eligible: false });
  const audit = await db.admin("select 1 from public.audit_log where action = 'staff.login_code' and outcome = 'denied'");
  expect(audit.length).toBeGreaterThan(0);
});

test("personal desactivado ya no es elegible", async () => {
  const staff = await db.createStaff("barista");
  const [{ email }] = await db.admin<{ email: string }>("select email from auth.users where id = $1", [staff.userId]);
  await db.admin("update public.staff_members set active = false where user_id = $1", [staff.userId]);
  expect(await request(email, sha256("d4"))).toEqual({ ok: true, eligible: false });
});

test("límite por correo y por dispositivo, sin importar si es elegible", async () => {
  for (let i = 0; i < 5; i++) await request("limite@correo.test", sha256(`x${i}`));
  expect(await request("limite@correo.test", sha256("x9"))).toMatchObject({ ok: false, code: "rate_limited" });
  const device = sha256("mismo-dispositivo");
  for (let i = 0; i < 20; i++) await request(`otro${i}@correo.test`, device);
  expect(await request("otro99@correo.test", device)).toMatchObject({ code: "rate_limited" });
});

test("solo el servidor puede llamarla", async () => {
  const user = await db.createUser({ email: "alguien@correo.test" });
  await expect(db.rpc(user, "request_staff_login_code", ["alguien@correo.test", client])).rejects.toThrow(/permission denied/);
  await expect(db.rpc(null, "request_staff_login_code", ["alguien@correo.test", client])).rejects.toThrow(/permission denied/);
});
