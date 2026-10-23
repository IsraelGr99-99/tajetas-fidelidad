import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { IDS, TestDb, idemKey, sha256, ticketHash } from "./harness";

let db: TestDb;
let americano: string;
let secondBranch: string;

beforeAll(async () => {
  db = await TestDb.create();
  americano = await db.productId("Americano (ejemplo)");
  [{ id: secondBranch }] = await db.admin<{ id: string }>(
    "insert into public.branches (business_id, slug, name) values ($1, 'segunda', 'Segunda') returning id",
    [IDS.business],
  );
});
afterAll(async () => {
  await db?.close();
});

const hold = () => sha256(`hold-${crypto.randomUUID()}`);
const items = () => JSON.stringify([{ product_id: americano, quantity: 1 }]);

describe("apartado al escanear", () => {
  test("consume el QR del cliente y el apartado sirve para acreditar", async () => {
    const barista = await db.createStaff("barista");
    const c = await db.createCustomer();
    const token = await db.scanToken(c.userId, c.cardId);
    const h = hold();
    const claim = await db.rpc(barista.userId, "staff_claim_card", [IDS.branch, token, h]);
    expect(claim).toMatchObject({ ok: true, purpose: "identify", card_id: c.cardId, stamps_required: 9 });

    // El QR original ya no sirve (ni para otro barista).
    const other = await db.createStaff("barista");
    expect(await db.rpc(other.userId, "staff_claim_card", [IDS.branch, token, hold()])).toMatchObject({ code: "token_invalid" });

    // El apartado acredita, una sola vez.
    expect((await db.rpc(barista.userId, "record_earn", [IDS.branch, idemKey(), ticketHash(), items(), h, null, null])).ok).toBe(true);
    await db.rewindLastEarn(c.cardId);
    expect(await db.rpc(barista.userId, "record_earn", [IDS.branch, idemKey(), ticketHash(), items(), h, null, null])).toMatchObject({
      code: "token_invalid",
    });
  });

  test("el apartado no sirve a otro barista ni en otra sucursal", async () => {
    const barista = await db.createStaff("barista");
    const owner = await db.createStaff("owner", { branchAccess: false });
    const c = await db.createCustomer();
    const h = hold();
    await db.rpc(barista.userId, "staff_claim_card", [IDS.branch, await db.scanToken(c.userId, c.cardId), h]);
    expect(await db.rpc(owner.userId, "record_earn", [IDS.branch, idemKey(), ticketHash(), items(), h, null, null])).toMatchObject({
      code: "token_invalid",
    });
    expect(await db.rpc(owner.userId, "record_earn", [secondBranch, idemKey(), ticketHash(), items(), h, null, null])).toMatchObject({
      code: "token_invalid",
    });
  });

  test("un apartado no puede volver a apartarse ni reutilizar el mismo hash", async () => {
    const barista = await db.createStaff("barista");
    const c = await db.createCustomer();
    const token = await db.scanToken(c.userId, c.cardId);
    expect(await db.rpc(barista.userId, "staff_claim_card", [IDS.branch, token, token])).toMatchObject({ code: "invalid_request" });
    const h = hold();
    await db.rpc(barista.userId, "staff_claim_card", [IDS.branch, token, h]);
    expect(await db.rpc(barista.userId, "staff_claim_card", [IDS.branch, h, hold()])).toMatchObject({ code: "token_invalid" });
  });

  test("liberar el apartado lo invalida; solo su dueño puede liberarlo", async () => {
    const barista = await db.createStaff("barista");
    const other = await db.createStaff("barista");
    const c = await db.createCustomer();
    const h = hold();
    await db.rpc(barista.userId, "staff_claim_card", [IDS.branch, await db.scanToken(c.userId, c.cardId), h]);
    await db.rpc(other.userId, "staff_release_hold", [h]);
    const [t1] = await db.admin<{ consumed: boolean }>("select consumed_at is not null as consumed from public.scan_tokens where token_hash = $1", [h]);
    expect(t1.consumed).toBe(false);
    await db.rpc(barista.userId, "staff_release_hold", [h]);
    expect(await db.rpc(barista.userId, "record_earn", [IDS.branch, idemKey(), ticketHash(), items(), h, null, null])).toMatchObject({
      code: "token_invalid",
    });
  });

  test("apartado de canje: requiere recompensa y canjea una vez", async () => {
    const barista = await db.createStaff("barista");
    const owner = await db.createStaff("owner", { branchAccess: false });
    const c = await db.createCustomer();
    await db.rpc(owner.userId, "adjust_stamps", [c.cardId, 9, "Prueba de canje con apartado", idemKey()]);
    const h = hold();
    const claim = await db.rpc(barista.userId, "staff_claim_card", [IDS.branch, await db.scanToken(c.userId, c.cardId, "redeem"), h]);
    expect(claim).toMatchObject({ ok: true, purpose: "redeem", rewards_balance: 1 });
    expect((await db.rpc(barista.userId, "redeem_reward", [IDS.branch, idemKey(), h])).ok).toBe(true);
    expect(await db.rpc(barista.userId, "redeem_reward", [IDS.branch, idemKey(), h])).toMatchObject({ code: "token_invalid" });
  });

  test("solo personal de la sucursal puede apartar", async () => {
    const noBranch = await db.createStaff("barista", { branchAccess: false });
    const c = await db.createCustomer();
    expect(await db.rpc(noBranch.userId, "staff_claim_card", [IDS.branch, await db.scanToken(c.userId, c.cardId), hold()])).toMatchObject({
      code: "forbidden",
    });
  });
});

describe("estado en vivo del cliente", () => {
  test("refleja escaneo y nuevo sello; no expone tarjetas ajenas", async () => {
    const barista = await db.createStaff("barista");
    const c = await db.createCustomer();
    const other = await db.createCustomer();
    const token = await db.scanToken(c.userId, c.cardId);

    const before = await db.rpc(c.userId, "my_card_status", [c.cardId, token]);
    expect(before).toMatchObject({ ok: true, token_state: "active", stamps_balance: 0 });

    const h = hold();
    await db.rpc(barista.userId, "staff_claim_card", [IDS.branch, token, h]);
    expect(await db.rpc(c.userId, "my_card_status", [c.cardId, token])).toMatchObject({ token_state: "scanned" });

    await db.rpc(barista.userId, "record_earn", [IDS.branch, idemKey(), ticketHash(), items(), h, null, null]);
    const after = await db.rpc(c.userId, "my_card_status", [c.cardId, token]);
    expect(after).toMatchObject({ stamps_balance: 1, last_event: { event_type: "earn", stamps_delta: 1 } });
    expect(Number(after.version)).toBeGreaterThan(Number(before.version));

    expect(await db.rpc(other.userId, "my_card_status", [c.cardId, token])).toMatchObject({ code: "card_not_found" });
  });
});

describe("catálogo de barra", () => {
  test("ordena elegibles primero y por ventas recientes; solo personal", async () => {
    const barista = await db.createStaff("barista");
    const r = await db.rpc(barista.userId, "staff_catalog", [IDS.business]);
    const products = r.products as { name: string; eligible: boolean; sold_30d: number }[];
    expect(products[0].eligible).toBe(true);
    expect(products.find((p) => p.name === "Americano (ejemplo)")!.sold_30d).toBeGreaterThan(0);
    const c = await db.createCustomer();
    expect(await db.rpc(c.userId, "staff_catalog", [IDS.business])).toMatchObject({ code: "forbidden" });
  });
});
