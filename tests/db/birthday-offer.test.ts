import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { TestDb } from "./harness";

let db: TestDb;
beforeAll(async () => { db = await TestDb.create(); });
afterAll(async () => db?.close());

describe("cumpleaños opcional", () => {
  test("la tarjeta se crea sin aceptar promociones ni guardar fecha", async () => {
    const userId = await db.createUser({ email: "sin-promo@correo.test" });
    expect(await db.rpc(userId, "enroll_customer_with_birthday", ["cafe-nomada", "Ana", "2026-10-26", null, null, false, "2026-10-26"]))
      .toMatchObject({ ok: true });
    expect(await db.rpc(userId, "get_my_birthday_offer", ["cafe-nomada"]))
      .toMatchObject({ ok: true, opted_in: false, month: null, day: null });
  });

  test("opt-in válido es revocable y la baja borra día y mes", async () => {
    const userId = await db.createUser({ email: "con-promo@correo.test" });
    expect(await db.rpc(userId, "enroll_customer_with_birthday", ["cafe-nomada", "Luz", "2026-10-26", 2, 29, true, "2026-10-26"]))
      .toMatchObject({ ok: true });
    expect(await db.rpc(userId, "get_my_birthday_offer", ["cafe-nomada"]))
      .toMatchObject({ ok: true, opted_in: true, month: 2, day: 29 });
    expect(await db.rpc(userId, "set_my_birthday_offer", ["cafe-nomada", null, null, false, "2026-10-26"]))
      .toMatchObject({ ok: true, opted_in: false });
    expect(await db.rpc(userId, "get_my_birthday_offer", ["cafe-nomada"]))
      .toMatchObject({ ok: true, opted_in: false, month: null, day: null });
    await db.rpc(userId, "set_my_birthday_offer", ["cafe-nomada", 6, 15, true, "2026-10-26"]);
    await db.rpc(userId, "delete_my_customer_data", ["cafe-nomada", "privacidad"]);
    const [row] = await db.admin<{ birth_month: number | null; birth_day: number | null }>(
      "select birth_month, birth_day from public.customers where contact_email is null and display_name is null order by deleted_at desc limit 1",
    );
    expect(row).toEqual({ birth_month: null, birth_day: null });
  });

  test("fecha inválida y opt-in sin fecha se rechazan antes de registrar", async () => {
    const userId = await db.createUser({ email: "fecha-invalida@correo.test" });
    expect(await db.rpc(userId, "enroll_customer_with_birthday", ["cafe-nomada", "Sol", "2026-10-26", 2, 30, true, "2026-10-26"]))
      .toMatchObject({ code: "invalid_request" });
    expect(await db.rpc(userId, "get_my_birthday_offer", ["cafe-nomada"]))
      .toMatchObject({ code: "not_enrolled" });
  });
});
