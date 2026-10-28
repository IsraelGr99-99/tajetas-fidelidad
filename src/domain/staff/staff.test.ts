import { describe, expect, test } from "vitest";
import { type Membership, can, resolveActiveBranch, resolveActiveMembership, staffContextSchema } from "./permissions";
import { CONSOLE_HOME, safeNextPath } from "./routes";

describe("permisos por rol (espejo de las funciones SQL)", () => {
  test("barista: solo con QR y canje", () => {
    expect(can("barista", "earn_with_qr")).toBe(true);
    expect(can("barista", "redeem")).toBe(true);
    expect(can("barista", "earn_without_qr")).toBe(false);
    expect(can("barista", "reverse")).toBe(false);
    expect(can("barista", "view_customers_pii")).toBe(false);
  });
  test("gerente: revierte pero no ajusta ni administra", () => {
    expect(can("manager", "reverse")).toBe(true);
    expect(can("manager", "adjust_stamps")).toBe(false);
    expect(can("manager", "manage_staff")).toBe(false);
  });
  test("owner y admin administran", () => {
    for (const role of ["owner", "admin"] as const) {
      expect(can(role, "adjust_stamps")).toBe(true);
      expect(can(role, "manage_campaigns")).toBe(true);
    }
  });
});

const membership: Membership = {
  staff_member_id: "11111111-1111-4111-8111-111111111111",
  display_name: "Ana",
  role: "barista",
  business_id: "00000000-0000-4000-8000-000000000001",
  business_slug: "cafe-nomada",
  business_name: "Café Nómada",
  is_demo: true,
  mfa_pending: false,
  branches: [
    { id: "00000000-0000-4000-8000-0000000000b1", slug: "a", name: "A" },
    { id: "00000000-0000-4000-8000-0000000000b2", slug: "b", name: "B" },
  ],
};

describe("sucursal activa", () => {
  test("respeta la cookie solo si la sucursal es del usuario", () => {
    expect(resolveActiveBranch(membership, "00000000-0000-4000-8000-0000000000b2")?.slug).toBe("b");
    expect(resolveActiveBranch(membership, "00000000-0000-4000-8000-0000000000ff")).toBeNull();
    expect(resolveActiveBranch(membership, undefined)).toBeNull();
  });
  test("con una sola sucursal se elige sola", () => {
    expect(resolveActiveBranch({ ...membership, branches: [membership.branches[0]] }, undefined)?.slug).toBe("a");
  });
  test("valida el contrato de get_staff_context", () => {
    expect(staffContextSchema.safeParse({ ok: true, memberships: [membership] }).success).toBe(true);
    expect(staffContextSchema.safeParse({ ok: true, memberships: [{ ...membership, role: "root" }] }).success).toBe(false);
  });
});

describe("negocio activo", () => {
  const other: Membership = { ...membership, business_id: "00000000-0000-4000-8000-000000000002", business_slug: "heladeria-sol", branches: [] };
  test("una sola membresía se selecciona sola", () => {
    expect(resolveActiveMembership([membership], undefined)).toBe(membership);
  });
  test("dos membresías requieren elección explícita", () => {
    expect(resolveActiveMembership([membership, other], undefined)).toBeNull();
    expect(resolveActiveMembership([membership, other], other.business_id)).toBe(other);
  });
  test("cookie de negocio revocado no concede acceso", () => {
    expect(resolveActiveMembership([membership], other.business_id)).toBeNull();
    expect(resolveActiveBranch(other, membership.branches[0].id)).toBeNull();
  });
});

describe("redirección segura después del login", () => {
  test.each([
    ["/inicio", "/inicio"],
    ["/barra", "/barra"],
    ["/negocio/catalogo", "/negocio/catalogo"],
    ["/movimientos?todas=1", "/movimientos?todas=1"],
    ["/cuenta", "/cuenta"],
  ])("acepta %s", (input, expected) => expect(safeNextPath(input)).toBe(expected));

  test.each([
    "https://malicioso.example/barra",
    "//malicioso.example",
    String.raw`/barra\..\x`,
    "/barraca",
    "/",
    "/entrar",
    "/tarjeta",
    "/barra/\u0000",
    null,
    undefined,
  ])("rechaza %s", (input) => expect(safeNextPath(input)).toBe(CONSOLE_HOME));
});
