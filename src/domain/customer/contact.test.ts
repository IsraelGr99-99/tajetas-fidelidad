import { describe, expect, test } from "vitest";
import { RPC_ERROR_MESSAGES, rpcErrorMessage } from "@/domain/loyalty/messages";
import { displayNameSchema, emailSchema, mxPhoneSchema, otpSchema } from "./contact";

describe("contacto", () => {
  test("correo se normaliza a minúsculas", () => {
    expect(emailSchema.parse("  Ana@Correo.MX ")).toBe("ana@correo.mx");
    expect(emailSchema.safeParse("ana@").success).toBe(false);
  });
  test.each([
    ["222 123 4567", "+522221234567"],
    ["+52 222 123 4567", "+522221234567"],
    ["52 (222) 123-4567", "+522221234567"],
    ["+521 222 123 4567", "+522221234567"],
  ])("teléfono %s => %s", (input, out) => expect(mxPhoneSchema.parse(input)).toBe(out));
  test.each(["12345", "0221234567", "+1 415 555 0100", "abc"])("teléfono inválido %s", (input) =>
    expect(mxPhoneSchema.safeParse(input).success).toBe(false),
  );
  test("código de 6 a 10 dígitos (la longitud la define Supabase)", () => {
    expect(otpSchema.parse("123 456")).toBe("123456");
    expect(otpSchema.parse("1234-5678")).toBe("12345678");
    expect(otpSchema.parse("1234567890")).toBe("1234567890");
    expect(otpSchema.safeParse("12345").success).toBe(false);
    expect(otpSchema.safeParse("12345678901").success).toBe(false);
  });
  test("nombre opcional y seguro", () => {
    expect(displayNameSchema.parse("  ")).toBeNull();
    expect(displayNameSchema.parse("Lucía")).toBe("Lucía");
    expect(displayNameSchema.safeParse("<b>x</b>").success).toBe(false);
  });
});

describe("mensajes de error", () => {
  test("todos los códigos documentados tienen mensaje", () => {
    const documented = ["not_authenticated", "forbidden", "not_found", "invalid_request", "invalid_items", "idempotency_conflict",
      "rate_limited", "token_invalid", "nfc_invalid", "card_not_found", "card_inactive", "no_active_campaign", "duplicate_purchase",
      "not_eligible", "too_soon", "daily_limit", "no_reward_available", "not_reversible", "already_reversed", "requires_manual_review",
      "would_go_negative", "invalid_rules", "contact_not_verified", "contact_already_enrolled", "business_not_found", "not_enrolled"];
    for (const code of documented) expect(RPC_ERROR_MESSAGES[code], code).toBeTruthy();
  });
  test("código desconocido => mensaje genérico", () => {
    expect(rpcErrorMessage("x")).toMatch(/Algo salió mal/);
    expect(rpcErrorMessage(undefined)).toMatch(/Algo salió mal/);
  });
});
