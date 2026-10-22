import { z } from "zod";

/** Contrato de `get_my_card()`: se valida la respuesta del servidor antes de usarla. */
export const historyEntrySchema = z.object({
  id: z.uuid(),
  event_type: z.enum(["earn", "reward_issued", "redeem", "reverse", "manual_adjustment"]),
  stamps_delta: z.number().int(),
  rewards_delta: z.number().int(),
  occurred_at: z.string(),
  branch_name: z.string().nullable(),
  reward_value_cap_cents: z.number().int().nullable(),
});

export const myCardSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    card: z.object({
      id: z.uuid(),
      public_serial: z.string(),
      stamps_balance: z.number().int().nonnegative(),
      rewards_balance: z.number().int().nonnegative(),
    }),
    customer: z.object({
      display_name: z.string().nullable(),
      contact_channel: z.enum(["email", "phone"]),
      contact_masked: z.string().nullable(),
    }),
    campaign: z
      .object({
        name: z.string(),
        version: z.number().int(),
        stamps_required: z.number().int().positive(),
        reward_description: z.string(),
        reward_cap_kind: z.enum(["min_eligible_item_in_completing_ticket", "fixed"]),
        reward_cap_max_cents: z.number().int().nullable(),
      })
      .nullable(),
    history: z.array(historyEntrySchema),
  }),
  z.object({ ok: z.literal(false), code: z.string() }),
]);

export type MyCard = Extract<z.infer<typeof myCardSchema>, { ok: true }>;
export type HistoryEntry = z.infer<typeof historyEntrySchema>;

/** Texto legible de un movimiento del historial. */
export function describeHistoryEntry(e: HistoryEntry): { title: string; detail: string | null; tone: "positive" | "reward" | "neutral" } {
  switch (e.event_type) {
    case "earn":
      return { title: e.stamps_delta === 1 ? "Sello por tu visita" : `${e.stamps_delta} sellos por tu visita`, detail: e.branch_name, tone: "positive" };
    case "reward_issued":
      return { title: "¡Recompensa desbloqueada!", detail: "Completaste tu tarjeta", tone: "reward" };
    case "redeem":
      return { title: "Recompensa canjeada", detail: e.branch_name, tone: "neutral" };
    case "reverse":
      return { title: "Movimiento corregido", detail: "Se anuló un registro anterior", tone: "neutral" };
    case "manual_adjustment":
      return {
        title: e.stamps_delta > 0 ? `Ajuste: +${e.stamps_delta} sellos` : `Ajuste: ${e.stamps_delta} sellos`,
        detail: "Realizado por la cafetería",
        tone: e.stamps_delta > 0 ? "positive" : "neutral",
      };
  }
}
