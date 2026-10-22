import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { IDS, TestDb, idemKey, ticketHash } from "./harness";

let db: TestDb;
let otherBusiness: string;
let otherBranch: string;

beforeAll(async () => {
  db = await TestDb.create();
  [{ id: otherBusiness }] = await db.admin<{ id: string }>(
    "insert into public.businesses (slug, name) values ('otro-cafe', 'Otro Café') returning id",
  );
  [{ id: otherBranch }] = await db.admin<{ id: string }>(
    "insert into public.branches (business_id, slug, name) values ($1, 'centro', 'Centro') returning id",
    [otherBusiness],
  );
});
afterAll(async () => {
  await db?.close();
});

describe("acceso anónimo", () => {
  test.each(["customers", "loyalty_cards", "ledger_events", "staff_members", "scan_tokens", "audit_log", "purchases"])(
    "anon no puede leer %s",
    async (table) => {
      await expect(db.as(null, `select * from public.${table}`)).rejects.toThrow(/permission denied/);
    },
  );

  test("anon solo ve datos públicos del negocio", async () => {
    const rows = await db.as<{ slug: string }>(null, "select slug from public.businesses order by slug");
    expect(rows.map((r) => r.slug)).toContain("cafe-nomada");
  });

  test.each(["record_earn", "redeem_reward", "get_my_card", "adjust_stamps"])("anon no puede ejecutar %s", async (fn) => {
    await expect(db.as(null, `select public.${fn}()`)).rejects.toThrow(/permission denied|does not exist/);
  });

  test("anon no puede ejecutar helpers internos", async () => {
    await expect(db.as(null, "select private.rate_limit_allow('x', 1, 60)")).rejects.toThrow(/permission denied/);
  });
});

describe("escrituras directas bloqueadas", () => {
  test("un usuario autenticado no puede insertar ni modificar el ledger ni saldos", async () => {
    const c = await db.createCustomer();
    await expect(db.as(c.userId, "update public.loyalty_cards set stamps_balance = 99")).rejects.toThrow(/permission denied/);
    await expect(
      db.as(c.userId, "insert into public.ledger_events (business_id, card_id, customer_id, event_type, stamps_delta, idempotency_key, source) values ($1, $2, $2, 'earn', 9, 'abcdefgh', 'system')", [IDS.business, c.cardId]),
    ).rejects.toThrow(/permission denied/);
    await expect(db.as(c.userId, "insert into public.scan_tokens (business_id, card_id, purpose, token_hash, expires_at) values ($1,$2,'identify',$3, now() + interval '1 minute')", [IDS.business, c.cardId, ticketHash()])).rejects.toThrow(/permission denied/);
    await expect(db.as(c.userId, "select private.rate_limit_allow('x', 1, 60)")).rejects.toThrow(/permission denied/);
  });

  test("el ledger es append-only incluso para el superusuario", async () => {
    const staff = await db.createStaff("barista");
    const c = await db.createCustomer();
    const token = await db.scanToken(c.userId, c.cardId);
    const americano = await db.productId("Americano (ejemplo)");
    const r = await db.rpc(staff.userId, "record_earn", [IDS.branch, idemKey(), ticketHash(), JSON.stringify([{ product_id: americano, quantity: 1 }]), token, null, null]);
    expect(r.ok).toBe(true);
    await expect(db.admin("update public.ledger_events set stamps_delta = 5 where id = $1", [r.event_id])).rejects.toThrow(/append-only/);
    await expect(db.admin("delete from public.ledger_events where id = $1", [r.event_id])).rejects.toThrow(/append-only/);
    await expect(db.admin("truncate public.ledger_events cascade")).rejects.toThrow(/append-only/);
    await expect(db.admin("delete from public.audit_log")).rejects.toThrow(/append-only/);
    await expect(db.admin("update public.campaign_versions set stamps_required = 1")).rejects.toThrow(/append-only/);
  });
});

describe("aislamiento entre clientes y roles (IDOR/BOLA)", () => {
  test("un cliente solo ve su propio registro y tarjeta", async () => {
    const a = await db.createCustomer();
    const b = await db.createCustomer();
    const customers = await db.as<{ auth_user_id: string }>(a.userId, "select auth_user_id from public.customers");
    expect(customers.map((c) => c.auth_user_id)).toEqual([a.userId]);
    const cards = await db.as<{ id: string }>(a.userId, "select id from public.loyalty_cards");
    expect(cards.map((c) => c.id)).toEqual([a.cardId]);
    expect(await db.as(a.userId, "select id from public.ledger_events")).toEqual([]);
    // No puede emitir códigos para la tarjeta de otro.
    expect(await db.rpc(a.userId, "issue_scan_token", [b.cardId, "identify", ticketHash(), 120])).toMatchObject({ code: "card_not_found" });
  });

  test("get_my_card no expone actores, hashes ni datos de contacto completos", async () => {
    const c = await db.createCustomer({ phone: "522229876543" });
    const r = await db.rpc(c.userId, "get_my_card", ["cafe-nomada"]);
    expect(r).toMatchObject({ ok: true, customer: { contact_masked: "•••• 6543" } });
    expect(JSON.stringify(r)).not.toMatch(/522229876543|actor|reference_hash|idempotency/);
  });

  test("barista no ve PII de clientes en tablas; owner sí", async () => {
    const barista = await db.createStaff("barista");
    const owner = await db.createStaff("owner", { branchAccess: false });
    await db.createCustomer();
    expect(await db.as(barista.userId, "select contact_email from public.customers")).toEqual([]);
    expect((await db.as(owner.userId, "select contact_email from public.customers")).length).toBeGreaterThan(0);
  });

  test("lookup de tarjeta enmascara el contacto y no consume el código", async () => {
    const barista = await db.createStaff("barista");
    const c = await db.createCustomer({ email: "lucia.viajera@correo.test" });
    const token = await db.scanToken(c.userId, c.cardId);
    const r = await db.rpc(barista.userId, "staff_lookup_card", [IDS.branch, token]);
    expect(r).toMatchObject({ ok: true, card_id: c.cardId, contact_masked: "l•••@correo.test" });
    expect((await db.rpc(barista.userId, "staff_lookup_card", [IDS.branch, token])).ok).toBe(true);
  });

  test("personal de otra empresa no puede operar ni descubrir eventos", async () => {
    const outsider = await db.createStaff("owner", { businessId: otherBusiness });
    const barista = await db.createStaff("barista");
    const c = await db.createCustomer();
    const token = await db.scanToken(c.userId, c.cardId);
    const americano = await db.productId("Americano (ejemplo)");
    const items = JSON.stringify([{ product_id: americano, quantity: 1 }]);

    expect(await db.rpc(outsider.userId, "record_earn", [IDS.branch, idemKey(), ticketHash(), items, token, null, null])).toMatchObject({ code: "forbidden" });
    expect(await db.rpc(outsider.userId, "staff_lookup_card", [IDS.branch, token])).toMatchObject({ code: "forbidden" });
    // En su propia sucursal, el token de otra empresa no existe.
    expect(await db.rpc(outsider.userId, "record_earn", [otherBranch, idemKey(), ticketHash(), items, token, null, null])).toMatchObject({ code: "token_invalid" });

    const e = await db.rpc(barista.userId, "record_earn", [IDS.branch, idemKey(), ticketHash(), items, token, null, null]);
    expect(await db.rpc(outsider.userId, "reverse_ledger_event", [e.event_id, "Intento ajeno", idemKey(), "voided"])).toMatchObject({ code: "not_found" });
    expect(await db.rpc(outsider.userId, "adjust_stamps", [c.cardId, 5, "Intento ajeno", idemKey()])).toMatchObject({ code: "not_found" });
    expect(await db.as(outsider.userId, "select id from public.ledger_events where business_id = $1", [IDS.business])).toEqual([]);
  });

  test("barista sin acceso a la sucursal no puede operar", async () => {
    const barista = await db.createStaff("barista", { branchAccess: false });
    const c = await db.createCustomer();
    const token = await db.scanToken(c.userId, c.cardId);
    expect(await db.rpc(barista.userId, "staff_lookup_card", [IDS.branch, token])).toMatchObject({ code: "forbidden" });
  });

  test("personal desactivado pierde acceso de inmediato", async () => {
    const barista = await db.createStaff("barista");
    await db.admin("update public.staff_members set active = false where user_id = $1", [barista.userId]);
    const c = await db.createCustomer();
    const token = await db.scanToken(c.userId, c.cardId);
    expect(await db.rpc(barista.userId, "staff_lookup_card", [IDS.branch, token])).toMatchObject({ code: "forbidden" });
  });

  test("los rechazos quedan auditados sin tokens", async () => {
    const intruder = await db.createUser({ email: `x-${randomUUID().slice(0, 6)}@correo.test` });
    const hash = ticketHash();
    await db.rpc(intruder, "staff_lookup_card", [IDS.branch, hash]);
    const rows = await db.admin<{ outcome: string; details: unknown }>(
      "select outcome, details from public.audit_log where actor_user_id = $1",
      [intruder],
    );
    expect(rows[0].outcome).toBe("denied");
    expect(JSON.stringify(rows)).not.toContain(hash);
  });
});

describe("rate limiting", () => {
  test("limita la emisión de códigos QR por usuario", async () => {
    const c = await db.createCustomer();
    const results = [];
    for (let i = 0; i < 31; i++) results.push(await db.rpc(c.userId, "issue_scan_token", [c.cardId, "identify", ticketHash(), 60]));
    expect(results.at(-1)).toMatchObject({ ok: false, code: "rate_limited" });
  });
});
