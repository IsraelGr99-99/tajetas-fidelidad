import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ledgerRow = z.object({
  id: z.uuid(),
  event_type: z.enum(["earn", "reward_issued", "redeem", "reverse", "manual_adjustment"]),
  stamps_delta: z.number().int(),
  rewards_delta: z.number().int(),
  occurred_at: z.string(),
  source: z.string(),
  reason: z.string().nullable(),
  reward_value_cap_cents: z.number().int().nullable(),
  related_event_id: z.uuid().nullable(),
  branch_name: z.string().nullable(),
  actor_name: z.string().nullable(),
  customer_label: z.string(),
  customer_contact_masked: z.string().nullable(),
  card_serial: z.string(),
  purchase_total_cents: z.number().int().nullable(),
  purchase_status: z.enum(["completed", "voided", "refunded"]).nullable(),
  reversed: z.boolean(),
  reversible: z.boolean(),
});
export type LedgerRow = z.infer<typeof ledgerRow>;

export const LEDGER_PAGE_SIZE = 50;

/** Bitácora vía `list_ledger` (la base decide qué puede ver cada rol). */
export async function getLedger(businessId: string, branchId: string | null, before: string | null) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, code: "not_configured" };
  const { data, error } = await supabase.rpc("list_ledger", {
    p_business_id: businessId,
    p_branch_id: branchId,
    p_limit: LEDGER_PAGE_SIZE,
    p_before: before,
  });
  if (error) throw new Error(`list_ledger falló (${error.code ?? "sin código"})`);
  if (!data?.ok) return { ok: false as const, code: String(data?.code ?? "error") };
  return { ok: true as const, events: z.array(ledgerRow).parse(data.events) };
}
