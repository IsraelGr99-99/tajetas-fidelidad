import { afterAll, beforeAll, expect, test } from "vitest";
import { IDS, TestDb, idemKey } from "./harness";

let db: TestDb;

beforeAll(async () => {
  db = await TestDb.create();
});
afterAll(async () => {
  await db?.close();
});

test("snapshot sin datos de contacto y ciclo de sincronización", async () => {
  const c = await db.createCustomer({ email: "wallet@correo.test" });
  const [{ r: snap }] = await db.service<{ r: Record<string, unknown> }>("select public.wallet_card_snapshot($1) as r", [c.cardId]);
  expect(snap).toMatchObject({ card_id: c.cardId, stamps_balance: 0, stamps_required: 9, google_object_id: null, customer_active: true });
  expect(JSON.stringify(snap)).not.toContain("wallet@correo.test");

  await db.service("select public.wallet_register_pass($1, 'google', $2)", [c.cardId, `x.card-${snap.public_serial}`]);
  await db.service("select public.wallet_mark_synced($1, 'google', $2, null)", [c.cardId, snap.version]);
  expect(await db.service("select * from public.wallet_stale_passes(10)")).toEqual([]);

  // Un movimiento en el ledger deja el pase desactualizado.
  const owner = await db.createStaff("owner", { branchAccess: false });
  await db.rpc(owner.userId, "adjust_stamps", [c.cardId, 2, "Prueba de sincronización", idemKey()]);
  const stale = await db.service<{ wallet_stale_passes: string }>("select * from public.wallet_stale_passes(10)");
  expect(stale.map((s) => s.wallet_stale_passes)).toEqual([c.cardId]);

  // Un error no avanza la versión sincronizada.
  await db.service("select public.wallet_mark_synced($1, 'google', 999, 'falló la API')", [c.cardId]);
  const [p] = await db.admin<{ synced_version: number; last_error: string }>("select synced_version, last_error from public.wallet_passes where card_id = $1", [c.cardId]);
  expect(p).toMatchObject({ last_error: "falló la API" });
  expect(Number(p.synced_version)).toBe(Number(snap.version));
});

test("registrar dos veces no duplica", async () => {
  const c = await db.createCustomer();
  await db.service("select public.wallet_register_pass($1, 'google', $2)", [c.cardId, `x.card-a-${c.cardId}`]);
  await db.service("select public.wallet_register_pass($1, 'google', $2)", [c.cardId, `x.card-b-${c.cardId}`]);
  const rows = await db.admin("select object_id from public.wallet_passes where card_id = $1", [c.cardId]);
  expect(rows).toHaveLength(1);
});

test("clientes, personal y anon no acceden a pases ni funciones de Wallet", async () => {
  const c = await db.createCustomer();
  const owner = await db.createStaff("owner", { branchAccess: false });
  for (const user of [c.userId, owner.userId, null]) {
    await expect(db.as(user, "select * from public.wallet_passes")).rejects.toThrow(/permission denied/);
    await expect(db.as(user, "select public.wallet_card_snapshot($1)", [c.cardId])).rejects.toThrow(/permission denied/);
  }
  void IDS;
});
