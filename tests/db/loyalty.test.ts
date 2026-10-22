import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { IDS, TestDb, idemKey, ticketHash } from "./harness";

let db: TestDb;
let owner: { userId: string; staffId: string };
let barista: { userId: string; staffId: string };
let manager: { userId: string; staffId: string };
let americano: string;
let espresso: string;
let latte: string;
let concha: string;

beforeAll(async () => {
  db = await TestDb.create();
  owner = await db.createStaff("owner", { branchAccess: false });
  barista = await db.createStaff("barista");
  manager = await db.createStaff("manager");
  americano = await db.productId("Americano (ejemplo)");
  espresso = await db.productId("Espresso (ejemplo)");
  latte = await db.productId("Latte de temporada (ejemplo)");
  concha = await db.productId("Concha artesanal (ejemplo)");
});
afterAll(async () => {
  await db?.close();
});

async function earn(
  customer: { userId: string; cardId: string },
  items: unknown[],
  opts: { key?: string; ticket?: string; staffUserId?: string } = {},
) {
  const token = await db.scanToken(customer.userId, customer.cardId);
  return db.rpc(opts.staffUserId ?? barista.userId, "record_earn", [
    IDS.branch,
    opts.key ?? idemKey(),
    opts.ticket ?? ticketHash(),
    JSON.stringify(items),
    token,
    null,
    null,
  ]);
}

describe("registro de clientes", () => {
  test("se inscribe con correo verificado y no guarda teléfono", async () => {
    const userId = await db.createUser({ email: "Ana@Correo.test" });
    const r = await db.rpc(userId, "enroll_customer", ["cafe-nomada", "Ana", "2026-10-23"]);
    expect(r).toMatchObject({ ok: true, already_enrolled: false, stamps_balance: 0, stamps_required: 9 });
    const [c] = await db.admin<{ contact_channel: string; contact_email: string; contact_phone: string | null }>(
      "select contact_channel, contact_email, contact_phone from public.customers where auth_user_id = $1",
      [userId],
    );
    expect(c).toEqual({ contact_channel: "email", contact_email: "ana@correo.test", contact_phone: null });
  });

  test("se inscribe con teléfono verificado (formato E.164)", async () => {
    const userId = await db.createUser({ phone: "522221234567" });
    const r = await db.rpc(userId, "enroll_customer", ["cafe-nomada", null, "2026-10-23"]);
    expect(r.ok).toBe(true);
    const [c] = await db.admin<{ contact_phone: string }>("select contact_phone from public.customers where auth_user_id = $1", [userId]);
    expect(c.contact_phone).toBe("+522221234567");
  });

  test("rechaza un canal no verificado", async () => {
    const userId = await db.createUser({ email: "sinverificar@correo.test", verified: false });
    expect(await db.rpc(userId, "enroll_customer", ["cafe-nomada", null, "2026-10-23"])).toMatchObject({ ok: false, code: "contact_not_verified" });
  });

  test("inscribirse dos veces devuelve la misma tarjeta", async () => {
    const userId = await db.createUser({ email: "doble@correo.test" });
    const a = await db.rpc(userId, "enroll_customer", ["cafe-nomada", null, "2026-10-23"]);
    const b = await db.rpc(userId, "enroll_customer", ["cafe-nomada", null, "2026-10-23"]);
    expect(b).toMatchObject({ ok: true, already_enrolled: true, card_id: a.card_id });
  });

  test("anon no puede inscribirse", async () => {
    await expect(db.rpc(null, "enroll_customer", ["cafe-nomada", null, "2026-10-23"])).rejects.toThrow(/permission denied/);
  });
});

describe("acreditación de sellos", () => {
  test("una compra elegible suma exactamente un sello aunque tenga varias bebidas", async () => {
    const c = await db.createCustomer();
    const r = await earn(c, [{ product_id: americano, quantity: 3 }, { product_id: latte, quantity: 1 }]);
    expect(r).toMatchObject({ ok: true, stamps_added: 1, stamps_balance: 1, rewards_issued: 0 });
    expect((await db.card(c.cardId)).consistent).toBe(true);
  });

  test("reintento con la misma llave de idempotencia no duplica", async () => {
    const c = await db.createCustomer();
    const key = idemKey();
    const ticket = ticketHash();
    const first = await earn(c, [{ product_id: americano, quantity: 1 }], { key, ticket });
    const replay = await db.rpc(barista.userId, "record_earn", [
      IDS.branch, key, ticket, JSON.stringify([{ product_id: americano, quantity: 1 }]), await db.scanToken(c.userId, c.cardId), null, null,
    ]);
    expect(replay).toMatchObject({ ok: true, replayed: true, event_id: first.event_id, stamps_balance: 1 });
  });

  test("misma llave con otro ticket es conflicto", async () => {
    const c = await db.createCustomer();
    const key = idemKey();
    await earn(c, [{ product_id: americano, quantity: 1 }], { key });
    await db.rewindLastEarn(c.cardId);
    expect(await earn(c, [{ product_id: americano, quantity: 1 }], { key })).toMatchObject({ ok: false, code: "idempotency_conflict" });
  });

  test("el mismo ticket no acredita dos veces", async () => {
    const a = await db.createCustomer();
    const b = await db.createCustomer();
    const ticket = ticketHash();
    expect((await earn(a, [{ product_id: americano, quantity: 1 }], { ticket })).ok).toBe(true);
    expect(await earn(b, [{ product_id: americano, quantity: 1 }], { ticket })).toMatchObject({ ok: false, code: "duplicate_purchase" });
  });

  test("cortesías y productos no elegibles no suman", async () => {
    const c = await db.createCustomer();
    expect(await earn(c, [{ product_id: americano, quantity: 1, complimentary: true }])).toMatchObject({ code: "not_eligible" });
    expect(await earn(c, [{ product_id: concha, quantity: 2 }])).toMatchObject({ code: "not_eligible" });
    expect((await db.card(c.cardId)).stamps_balance).toBe(0);
  });

  test("productos de otra empresa, inexistentes o cantidades inválidas se rechazan", async () => {
    const c = await db.createCustomer();
    expect(await earn(c, [{ product_id: "00000000-0000-4000-8000-00000000dead", quantity: 1 }])).toMatchObject({ code: "invalid_items" });
    expect(await earn(c, [{ product_id: americano, quantity: 0 }])).toMatchObject({ code: "invalid_items" });
    expect(await earn(c, [{ product_id: "no-es-uuid", quantity: 1 }])).toMatchObject({ code: "invalid_items" });
  });

  test("el código QR es de un solo uso", async () => {
    const c = await db.createCustomer();
    const token = await db.scanToken(c.userId, c.cardId);
    const items = JSON.stringify([{ product_id: americano, quantity: 1 }]);
    expect((await db.rpc(barista.userId, "record_earn", [IDS.branch, idemKey(), ticketHash(), items, token, null, null])).ok).toBe(true);
    await db.rewindLastEarn(c.cardId);
    expect(await db.rpc(barista.userId, "record_earn", [IDS.branch, idemKey(), ticketHash(), items, token, null, null])).toMatchObject({
      ok: false,
      code: "token_invalid",
    });
  });

  test("un código expirado no sirve", async () => {
    const c = await db.createCustomer();
    const token = await db.scanToken(c.userId, c.cardId);
    await db.admin("update public.scan_tokens set created_at = now() - interval '5 minutes', expires_at = now() - interval '1 second' where token_hash = $1", [token]);
    const items = JSON.stringify([{ product_id: americano, quantity: 1 }]);
    expect(await db.rpc(barista.userId, "record_earn", [IDS.branch, idemKey(), ticketHash(), items, token, null, null])).toMatchObject({
      code: "token_invalid",
    });
  });

  test("respeta la espera mínima entre sellos", async () => {
    const c = await db.createCustomer();
    await earn(c, [{ product_id: americano, quantity: 1 }]);
    const r = await earn(c, [{ product_id: americano, quantity: 1 }]);
    expect(r).toMatchObject({ ok: false, code: "too_soon" });
    expect(r.retry_after_seconds).toBeGreaterThan(0);
  });

  test("respeta el máximo diario", async () => {
    const c = await db.createCustomer();
    for (let i = 0; i < 3; i++) {
      expect((await earn(c, [{ product_id: americano, quantity: 1 }])).ok).toBe(true);
      await db.rewindLastEarn(c.cardId, 700);
    }
    expect(await earn(c, [{ product_id: americano, quantity: 1 }])).toMatchObject({ code: "daily_limit" });
  });

  test("barista no puede acreditar sin el QR del cliente; gerente sí (queda como búsqueda)", async () => {
    const c = await db.createCustomer();
    const items = JSON.stringify([{ product_id: americano, quantity: 1 }]);
    expect(await db.rpc(barista.userId, "record_earn", [IDS.branch, idemKey(), ticketHash(), items, null, c.cardId, null])).toMatchObject({
      code: "forbidden",
    });
    const r = await db.rpc(manager.userId, "record_earn", [IDS.branch, idemKey(), ticketHash(), items, null, c.cardId, null]);
    expect(r.ok).toBe(true);
    const [e] = await db.admin<{ source: string }>("select source from public.ledger_events where id = $1", [r.event_id]);
    expect(e.source).toBe("staff_lookup");
  });

  test("un identificador NFC de otra sucursal o inexistente no autoriza", async () => {
    const c = await db.createCustomer();
    const token = await db.scanToken(c.userId, c.cardId);
    const items = JSON.stringify([{ product_id: americano, quantity: 1 }]);
    expect(
      await db.rpc(barista.userId, "record_earn", [IDS.branch, idemKey(), ticketHash(), items, token, null, "inexistente_aaaaaaaaaaaaaaaa"]),
    ).toMatchObject({ code: "nfc_invalid" });
  });

  test("el NFC válido se registra como origen, pero sigue exigiendo QR y empleado", async () => {
    await db.admin("insert into public.nfc_devices (business_id, branch_id, public_id, label) values ($1, $2, $3, $4)", [
      IDS.business, IDS.branch, "sello_barra_01_xxxxxxxxxxxx", "Sello barra",
    ]);
    const c = await db.createCustomer();
    const token = await db.scanToken(c.userId, c.cardId);
    const items = JSON.stringify([{ product_id: americano, quantity: 1 }]);
    const r = await db.rpc(barista.userId, "record_earn", [IDS.branch, idemKey(), ticketHash(), items, token, null, "sello_barra_01_xxxxxxxxxxxx"]);
    expect(r.ok).toBe(true);
    const [e] = await db.admin<{ source: string }>("select source from public.ledger_events where id = $1", [r.event_id]);
    expect(e.source).toBe("staff_nfc");
  });
});

describe("ciclo completo, recompensa, canje y reversos", () => {
  beforeAll(async () => {
    // Versión 2 de la campaña: misma regla pero sin espera para poder simular un ciclo en una prueba.
    const r = await db.rpc(owner.userId, "publish_campaign_version", [
      IDS.campaign,
      JSON.stringify({
        name: "Bitácora del viajero",
        rewardDescription: "Una bebida estándar de cortesía",
        stampsRequired: 9,
        stampsPerPurchase: 1,
        rewardCap: { kind: "min_eligible_item_in_completing_ticket", maxCents: null },
        minSecondsBetweenEarns: 0,
        maxEarnsPerDay: 20,
      }),
      "Pruebas de ciclo completo",
    ]);
    expect(r).toMatchObject({ ok: true, version: 2 });
  });

  async function fillCard(c: { userId: string; cardId: string }, n: number, lastItems?: unknown[]) {
    // Barista dedicado por tarjeta: el límite de 60 acreditaciones/10 min por empleado es real.
    const staff = await db.createStaff("barista");
    let last: Record<string, unknown> = {};
    for (let i = 0; i < n; i++) {
      const items = i === n - 1 && lastItems ? lastItems : [{ product_id: latte, quantity: 1 }];
      last = await earn(c, items, { staffUserId: staff.userId });
      expect(last.ok).toBe(true);
    }
    return last;
  }

  test("al noveno sello se emite una recompensa con tope de la bebida elegible más barata del ticket", async () => {
    const c = await db.createCustomer();
    const r = await fillCard(c, 9, [{ product_id: latte, quantity: 1 }, { product_id: espresso, quantity: 1 }, { product_id: concha, quantity: 1 }]);
    expect(r).toMatchObject({ rewards_issued: 1, stamps_balance: 0, rewards_balance: 1 });
    const [rw] = await db.admin<{ reward_value_cap_cents: number }>(
      "select reward_value_cap_cents from public.ledger_events where card_id = $1 and event_type = 'reward_issued'",
      [c.cardId],
    );
    expect(rw.reward_value_cap_cents).toBe(4500); // espresso, no la concha (no elegible)
    expect((await db.card(c.cardId)).consistent).toBe(true);
  });

  test("canje requiere el QR de canje del cliente y no se duplica", async () => {
    const c = await db.createCustomer();
    await fillCard(c, 9);
    const identifyToken = await db.scanToken(c.userId, c.cardId, "identify");
    expect(await db.rpc(barista.userId, "redeem_reward", [IDS.branch, idemKey(), identifyToken])).toMatchObject({ code: "token_invalid" });

    const redeemToken = await db.scanToken(c.userId, c.cardId, "redeem");
    const key = idemKey();
    const r = await db.rpc(barista.userId, "redeem_reward", [IDS.branch, key, redeemToken]);
    expect(r).toMatchObject({ ok: true, rewards_balance: 0, reward_value_cap_cents: 7500 });

    // Reintento con la misma llave: misma respuesta, sin segundo canje.
    expect(await db.rpc(barista.userId, "redeem_reward", [IDS.branch, key, redeemToken])).toMatchObject({ ok: true, replayed: true });
    // Sin recompensas ya no se puede generar QR de canje.
    expect(await db.rpc(c.userId, "issue_scan_token", [c.cardId, "redeem", ticketHash(), 120])).toMatchObject({ code: "no_reward_available" });
    expect((await db.card(c.cardId)).consistent).toBe(true);
  });

  test("dos tokens de canje para una sola recompensa: solo uno procede", async () => {
    const c = await db.createCustomer();
    await fillCard(c, 9);
    const t1 = await db.scanToken(c.userId, c.cardId, "redeem");
    const t2 = await db.scanToken(c.userId, c.cardId, "redeem");
    const results = await Promise.all([
      db.rpc(barista.userId, "redeem_reward", [IDS.branch, idemKey(), t1]),
      db.rpc(barista.userId, "redeem_reward", [IDS.branch, idemKey(), t2]),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)[0]).toMatchObject({ code: "no_reward_available" });
    expect(await db.card(c.cardId)).toMatchObject({ rewards_balance: 0, consistent: true });
  });

  test("revertir una acreditación resta el sello y marca la compra", async () => {
    const c = await db.createCustomer();
    const e = await earn(c, [{ product_id: americano, quantity: 1 }], { staffUserId: (await db.createStaff("barista")).userId });
    const r = await db.rpc(manager.userId, "reverse_ledger_event", [e.event_id, "Ticket anulado en caja", idemKey(), "voided"]);
    expect(r).toMatchObject({ ok: true, stamps_balance: 0 });
    const [p] = await db.admin<{ status: string }>(
      "select p.status from public.purchases p join public.ledger_events e on e.purchase_id = p.id where e.id = $1",
      [e.event_id],
    );
    expect(p.status).toBe("voided");
    expect(await db.rpc(manager.userId, "reverse_ledger_event", [e.event_id, "Otra vez", idemKey(), "voided"])).toMatchObject({
      code: "already_reversed",
    });
  });

  test("revertir el sello que completó el ciclo anula la recompensa no canjeada", async () => {
    const c = await db.createCustomer();
    const last = await fillCard(c, 9);
    const r = await db.rpc(manager.userId, "reverse_ledger_event", [last.event_id, "Devolución del ticket", idemKey(), "refunded"]);
    expect(r).toMatchObject({ ok: true, stamps_balance: 8, rewards_balance: 0 });
    expect((await db.card(c.cardId)).consistent).toBe(true);
  });

  test("si la recompensa ya se canjeó, el reverso exige revisión manual", async () => {
    const c = await db.createCustomer();
    const last = await fillCard(c, 9);
    await db.rpc(barista.userId, "redeem_reward", [IDS.branch, idemKey(), await db.scanToken(c.userId, c.cardId, "redeem")]);
    expect(await db.rpc(manager.userId, "reverse_ledger_event", [last.event_id, "Devolución tardía", idemKey(), "refunded"])).toMatchObject({
      code: "requires_manual_review",
    });
  });

  test("revertir un canje devuelve la recompensa y puede canjearse de nuevo", async () => {
    const c = await db.createCustomer();
    await fillCard(c, 9);
    const red = await db.rpc(barista.userId, "redeem_reward", [IDS.branch, idemKey(), await db.scanToken(c.userId, c.cardId, "redeem")]);
    expect(await db.rpc(manager.userId, "reverse_ledger_event", [red.event_id, "Canje por error", idemKey(), "voided"])).toMatchObject({
      ok: true,
      rewards_balance: 1,
    });
    const again = await db.rpc(barista.userId, "redeem_reward", [IDS.branch, idemKey(), await db.scanToken(c.userId, c.cardId, "redeem")]);
    expect(again).toMatchObject({ ok: true, rewards_balance: 0 });
    expect((await db.card(c.cardId)).consistent).toBe(true);
  });

  test("barista no puede revertir ni ajustar", async () => {
    const c = await db.createCustomer();
    const e = await earn(c, [{ product_id: americano, quantity: 1 }], { staffUserId: (await db.createStaff("barista")).userId });
    expect(e.ok).toBe(true);
    expect(await db.rpc(barista.userId, "reverse_ledger_event", [e.event_id, "Intento", idemKey(), "voided"])).toMatchObject({ code: "forbidden" });
    expect(await db.rpc(barista.userId, "adjust_stamps", [c.cardId, 3, "Intento de ajuste", idemKey()])).toMatchObject({ code: "forbidden" });
    expect(await db.rpc(manager.userId, "adjust_stamps", [c.cardId, 3, "Intento de ajuste", idemKey()])).toMatchObject({ code: "forbidden" });
  });

  test("ajuste manual con motivo, sin saldo negativo, y puede completar un ciclo", async () => {
    const c = await db.createCustomer();
    expect(await db.rpc(owner.userId, "adjust_stamps", [c.cardId, -1, "Corrección de saldo", idemKey()])).toMatchObject({
      code: "would_go_negative",
    });
    expect(await db.rpc(owner.userId, "adjust_stamps", [c.cardId, 2, "x", idemKey()])).toMatchObject({ code: "invalid_request" });
    const r = await db.rpc(owner.userId, "adjust_stamps", [c.cardId, 9, "Migración de tarjeta física", idemKey()]);
    expect(r).toMatchObject({ ok: true, rewards_issued: 1, stamps_balance: 0, rewards_balance: 1 });
    const [rw] = await db.admin<{ reward_value_cap_cents: number }>(
      "select reward_value_cap_cents from public.ledger_events where card_id = $1 and event_type = 'reward_issued'",
      [c.cardId],
    );
    expect(rw.reward_value_cap_cents).toBe(4500); // bebida elegible activa más económica
  });

  test("las reglas inválidas de campaña se rechazan y las versiones quedan en historial", async () => {
    expect(
      await db.rpc(owner.userId, "publish_campaign_version", [IDS.campaign, JSON.stringify({ name: "X", stampsRequired: 0 }), "Prueba inválida"]),
    ).toMatchObject({ code: "invalid_rules" });
    expect(await db.rpc(barista.userId, "publish_campaign_version", [IDS.campaign, "{}", "Sin permiso"])).toMatchObject({ code: "forbidden" });
    const versions = await db.admin<{ version: number }>("select version from public.campaign_versions order by version");
    expect(versions.map((v) => v.version)).toEqual([1, 2]);
  });
});

describe("límites por empleado", () => {
  test("un empleado no puede acreditar más de 60 veces en 10 minutos", async () => {
    const staff = await db.createStaff("barista");
    let last: Record<string, unknown> = {};
    for (let i = 0; i < 61; i++) {
      const c = await db.createCustomer();
      last = await earn(c, [{ product_id: americano, quantity: 1 }], { staffUserId: staff.userId });
    }
    expect(last).toMatchObject({ ok: false, code: "rate_limited" });
  });
});

describe("aviso de privacidad", () => {
  test("el alta exige versión del aviso y la registra", async () => {
    const userId = await db.createUser({ email: "privacidad@correo.test" });
    expect(await db.rpc(userId, "enroll_customer", ["cafe-nomada", null, null])).toMatchObject({ ok: false, code: "invalid_request" });
    expect(await db.rpc(userId, "enroll_customer", ["cafe-nomada", null, "v1"])).toMatchObject({ ok: false, code: "invalid_request" });
    expect((await db.rpc(userId, "enroll_customer", ["cafe-nomada", null, "2026-10-23"])).ok).toBe(true);
    const [c] = await db.admin<{ privacy_version: string; accepted: boolean }>(
      "select privacy_version, privacy_accepted_at is not null as accepted from public.customers where auth_user_id = $1",
      [userId],
    );
    expect(c).toEqual({ privacy_version: "2026-10-23", accepted: true });
  });

  test("la firma anterior sin aviso ya no existe", async () => {
    const userId = await db.createUser({ email: "firma-vieja@correo.test" });
    await expect(db.rpc(userId, "enroll_customer", ["cafe-nomada", null])).rejects.toThrow(/does not exist/);
  });
});
