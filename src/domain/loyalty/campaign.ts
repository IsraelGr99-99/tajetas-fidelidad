import { z } from "zod";

/**
 * Reglas de una versión de campaña. Es la forma que el panel de administración
 * edita y que la función SQL `publish_campaign_version` persiste de forma inmutable.
 * El servidor (PostgreSQL) es quien aplica las reglas; este esquema valida entrada
 * y alimenta textos de UI, nunca decide saldos.
 */
export const rewardCapSchema = z.discriminatedUnion("kind", [
  z.object({
    /** Tope = precio de la bebida elegible más barata del ticket que completó el ciclo. */
    kind: z.literal("min_eligible_item_in_completing_ticket"),
    /** Tope adicional opcional en centavos (se aplica el menor de ambos). */
    maxCents: z.number().int().positive().max(1_000_000).nullable(),
  }),
  z.object({
    kind: z.literal("fixed"),
    maxCents: z.number().int().positive().max(1_000_000),
  }),
]);

export const campaignRulesSchema = z
  .object({
    name: z.string().trim().min(3).max(80),
    rewardDescription: z.string().trim().min(3).max(160),
    stampsRequired: z.number().int().min(1).max(50),
    /** Sellos por operación elegible. Por defecto 1: una compra nunca suma varios sellos. */
    stampsPerPurchase: z.number().int().min(1).max(5).default(1),
    rewardCap: rewardCapSchema,
    /** Espera mínima entre acreditaciones de la misma tarjeta (anti-repetición). */
    minSecondsBetweenEarns: z.number().int().min(0).max(86_400).default(600),
    /** Máximo de acreditaciones por tarjeta por día calendario del negocio. */
    maxEarnsPerDay: z.number().int().min(1).max(20).default(3),
  })
  .strict();

export type CampaignRules = z.infer<typeof campaignRulesSchema>;
export type RewardCap = z.infer<typeof rewardCapSchema>;

/** Regla del piloto Café Nómada (editable desde administración; aquí solo es el valor inicial). */
export const PILOT_CAMPAIGN: CampaignRules = campaignRulesSchema.parse({
  name: "Bitácora del viajero",
  rewardDescription: "Una bebida estándar de cortesía",
  stampsRequired: 9,
  stampsPerPurchase: 1,
  rewardCap: { kind: "min_eligible_item_in_completing_ticket", maxCents: null },
  minSecondsBetweenEarns: 600,
  maxEarnsPerDay: 3,
});

export type CardProgress = {
  stampsBalance: number;
  stampsRequired: number;
  rewardsAvailable: number;
};

/** Datos de presentación del progreso. Los valores vienen del servidor (proyección del ledger). */
export function describeProgress({ stampsBalance, stampsRequired, rewardsAvailable }: CardProgress) {
  if (!Number.isInteger(stampsBalance) || stampsBalance < 0) throw new RangeError("stampsBalance inválido");
  if (!Number.isInteger(stampsRequired) || stampsRequired < 1) throw new RangeError("stampsRequired inválido");
  const filled = Math.min(stampsBalance, stampsRequired);
  return {
    filled,
    remaining: stampsRequired - filled,
    ratio: filled / stampsRequired,
    hasReward: rewardsAvailable > 0,
    label:
      rewardsAvailable > 0
        ? rewardsAvailable === 1
          ? "Tienes 1 recompensa lista para canjear"
          : `Tienes ${rewardsAvailable} recompensas listas para canjear`
        : `${filled} de ${stampsRequired} sellos`,
  };
}

/** Texto legible de la regla del tope de recompensa. */
export function describeRewardCap(cap: RewardCap, formatCents: (cents: number) => string): string {
  if (cap.kind === "fixed") return `Hasta ${formatCents(cap.maxCents)}`;
  const base = "Hasta el valor de la bebida elegible de menor precio del ticket que completó tu tarjeta";
  return cap.maxCents ? `${base}, con un máximo de ${formatCents(cap.maxCents)}` : base;
}
