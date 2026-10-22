import { describe, expect, test } from "vitest";
import { formatMxn } from "@/lib/format";
import { PILOT_CAMPAIGN, campaignRulesSchema, describeProgress, describeRewardCap } from "./campaign";

describe("reglas de campaña", () => {
  test("la regla del piloto: 9 sellos, 1 por compra, tope por bebida del ticket", () => {
    expect(PILOT_CAMPAIGN).toMatchObject({
      stampsRequired: 9,
      stampsPerPurchase: 1,
      rewardCap: { kind: "min_eligible_item_in_completing_ticket" },
    });
  });

  test("rechaza valores fuera de rango y campos desconocidos", () => {
    const base = { ...PILOT_CAMPAIGN };
    expect(campaignRulesSchema.safeParse({ ...base, stampsRequired: 0 }).success).toBe(false);
    expect(campaignRulesSchema.safeParse({ ...base, stampsPerPurchase: 10 }).success).toBe(false);
    expect(campaignRulesSchema.safeParse({ ...base, rewardCap: { kind: "fixed", maxCents: null } }).success).toBe(false);
    expect(campaignRulesSchema.safeParse({ ...base, saldoInicial: 50 }).success).toBe(false);
  });

  test("aplica valores por defecto conservadores", () => {
    const parsed = campaignRulesSchema.parse({
      name: "Prueba",
      rewardDescription: "Café",
      stampsRequired: 5,
      rewardCap: { kind: "fixed", maxCents: 5000 },
    });
    expect(parsed).toMatchObject({ stampsPerPurchase: 1, minSecondsBetweenEarns: 600, maxEarnsPerDay: 3 });
  });
});

describe("progreso", () => {
  test("describe avance y recompensas", () => {
    expect(describeProgress({ stampsBalance: 4, stampsRequired: 9, rewardsAvailable: 0 })).toMatchObject({
      filled: 4,
      remaining: 5,
      label: "4 de 9 sellos",
    });
    expect(describeProgress({ stampsBalance: 0, stampsRequired: 9, rewardsAvailable: 2 }).label).toBe(
      "Tienes 2 recompensas listas para canjear",
    );
  });

  test("rechaza saldos inválidos", () => {
    expect(() => describeProgress({ stampsBalance: -1, stampsRequired: 9, rewardsAvailable: 0 })).toThrow(RangeError);
  });

  test("texto del tope de recompensa", () => {
    expect(describeRewardCap({ kind: "fixed", maxCents: 6500 }, formatMxn)).toMatch(/^Hasta \$65\.00$/);
    expect(describeRewardCap({ kind: "min_eligible_item_in_completing_ticket", maxCents: 8000 }, formatMxn)).toContain("$80.00");
  });
});
