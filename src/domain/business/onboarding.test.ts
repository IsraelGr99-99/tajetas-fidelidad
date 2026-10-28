import { expect, test } from "vitest";
import { toBusinessSlug } from "./onboarding";

test("normaliza un nombre de negocio a URL estable", () => {
  expect(toBusinessSlug("Heladería Sol & Luna")).toBe("heladeria-sol-luna");
  expect(toBusinessSlug("  Café   Nómada ")).toBe("cafe-nomada");
});
