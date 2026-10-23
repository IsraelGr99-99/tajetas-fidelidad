import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { generateScanToken, parseScanPayload } = await import("./scan-token");
const { hashPurchaseReference, normalizeTicketFolio } = await import("./purchase-reference");

describe("token QR", () => {
  test("el payload no contiene más que prefijo y token aleatorio", () => {
    const { payload, hash } = generateScanToken();
    expect(payload).toMatch(/^CN1\.[A-Za-z0-9_-]{43}$/);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(parseScanPayload(payload)?.hash).toBe(hash);
  });
  test("dos tokens nunca se repiten", () => {
    expect(generateScanToken().payload).not.toBe(generateScanToken().payload);
  });
  test.each(["", "CN1.", "CN1.corto", "https://ejemplo.com", "CN2." + "a".repeat(43), "CN1." + "a".repeat(42) + "*"])(
    "rechaza entrada no confiable %j",
    (raw) => expect(parseScanPayload(raw)).toBeNull(),
  );
});

describe("referencia de compra", () => {
  const pepper = "p".repeat(48);
  const business = "00000000-0000-4000-8000-000000000001";
  const branch = "00000000-0000-4000-8000-0000000000b1";
  test("normaliza el folio", () => {
    expect(normalizeTicketFolio(" a-12 34 ")).toBe("A1234");
  });
  test("mismo folio, empresa y sucursal => mismo hash; otra empresa o sucursal => otro hash", () => {
    const a = hashPurchaseReference(business, branch, "a-1234", pepper);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(hashPurchaseReference(business, branch, "A1234", pepper)).toBe(a);
    expect(hashPurchaseReference("00000000-0000-4000-8000-000000000002", branch, "A1234", pepper)).not.toBe(a);
    expect(hashPurchaseReference(business, "00000000-0000-4000-8000-0000000000b2", "A1234", pepper)).not.toBe(a);
  });
  test("exige pepper fuerte y folio válido", () => {
    expect(() => hashPurchaseReference(business, branch, "A1", "corto")).toThrow();
    expect(() => hashPurchaseReference(business, branch, "", pepper)).toThrow(RangeError);
    expect(() => hashPurchaseReference(business, branch, "<script>", pepper)).toThrow(RangeError);
  });
});
