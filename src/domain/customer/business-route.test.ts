import { expect, test } from "vitest";
import { PILOT_BUSINESS_SLUG } from "@/lib/business";
import { customerPaths, isValidBusinessSlug } from "./business-route";

test("conserva las rutas públicas del piloto y separa las de otro negocio", () => {
  expect(customerPaths(PILOT_BUSINESS_SLUG).card).toBe("/tarjeta");
  expect(customerPaths("heladeria-sol")).toEqual({
    home: "/c/heladeria-sol", card: "/c/heladeria-sol/tarjeta", access: "/c/heladeria-sol/tarjeta/acceso",
  });
});

test.each(["", "../otro", "Café", "cafE", "a--b", "-a", "a-", "a".repeat(61)])("rechaza slug inválido %s", (slug) => {
  expect(isValidBusinessSlug(slug)).toBe(false);
  expect(() => customerPaths(slug)).toThrow("Negocio inválido");
});
