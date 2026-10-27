import { describe, expect, test } from "vitest";
import { contrastRatio, isHexColor } from "./branding";

describe("colores de tarjeta", () => {
  test("valida hexadecimales y contraste de texto", () => {
    expect(isHexColor("#ffffff")).toBe(true);
    expect(isHexColor("red")).toBe(false);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21);
    expect(contrastRatio("#ffffff", "#eeeeee")).toBeLessThan(4.5);
  });
});
