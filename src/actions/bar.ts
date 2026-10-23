"use server";

import { z } from "zod";
import { rpcErrorMessage } from "@/domain/loyalty/messages";
import { serverEnv } from "@/lib/env";
import { hashPurchaseReference } from "@/lib/purchase-reference";
import { parseScanPayload } from "@/lib/scan-token";
import { getStaffSession } from "@/lib/staff/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Operaciones de barra. Las Server Actions son invocables por POST directo, así que
 * cada una verifica sesión y sucursal; la autorización final la hace PostgreSQL.
 * El navegador nunca decide saldos, precios ni elegibilidad: solo envía ids,
 * cantidades, el folio (que aquí se convierte en HMAC) y el código QR escaneado.
 */

type Failure = { ok: false; error: string; code?: string };

async function operatorContext() {
  const session = await getStaffSession();
  if (session.status !== "staff") return { error: { ok: false, error: rpcErrorMessage("not_authenticated"), code: "not_authenticated" } as Failure };
  if (!session.activeBranch) return { error: { ok: false, error: "Elige una sucursal antes de operar.", code: "no_branch" } as Failure };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: { ok: false, error: "El servicio no está configurado.", code: "not_configured" } as Failure };
  return { session, branchId: session.activeBranch.id, supabase };
}

function fail(code: unknown): Failure {
  return { ok: false, error: rpcErrorMessage(code), code: typeof code === "string" ? code : undefined };
}

const networkFailure: Failure = { ok: false, error: "No se pudo contactar al servidor. Revisa la conexión y reintenta.", code: "network" };

// ---------------------------------------------------------------------
// Identificar la tarjeta (no consume el código)
// ---------------------------------------------------------------------
export type LookupResult =
  | {
      ok: true;
      purpose: "identify" | "redeem";
      displayName: string | null;
      contactMasked: string | null;
      stampsBalance: number;
      rewardsBalance: number;
      stampsRequired: number;
      expiresAt: string;
    }
  | Failure;

const lookupResponse = z.object({
  ok: z.literal(true),
  purpose: z.enum(["identify", "redeem"]),
  expires_at: z.string(),
  display_name: z.string().nullable(),
  contact_masked: z.string().nullable(),
  stamps_balance: z.number().int(),
  rewards_balance: z.number().int(),
  stamps_required: z.number().int(),
});

export async function lookupCardAction(input: { payload: string }): Promise<LookupResult> {
  const parsed = parseScanPayload(String(input?.payload ?? "").slice(0, 200));
  if (!parsed) return { ok: false, error: "Ese código no es una tarjeta de Café Nómada.", code: "token_invalid" };

  const ctx = await operatorContext();
  if ("error" in ctx) return ctx.error!;

  const { data, error } = await ctx.supabase.rpc("staff_lookup_card", { p_branch_id: ctx.branchId, p_token_hash: parsed.hash });
  if (error) return networkFailure;
  if (!data?.ok) return fail(data?.code);
  const r = lookupResponse.parse(data);
  return {
    ok: true,
    purpose: r.purpose,
    displayName: r.display_name,
    contactMasked: r.contact_masked,
    stampsBalance: r.stamps_balance,
    rewardsBalance: r.rewards_balance,
    stampsRequired: r.stamps_required,
    expiresAt: r.expires_at,
  };
}

// ---------------------------------------------------------------------
// Acreditar una compra
// ---------------------------------------------------------------------
const idempotencyKey = z.string().regex(/^[A-Za-z0-9:_-]{8,100}$/);

const earnInput = z.object({
  payload: z.string().max(200),
  folio: z.string().trim().min(1, "Escribe el folio del ticket.").max(40, "El folio es demasiado largo."),
  items: z
    .array(z.object({ productId: z.uuid(), quantity: z.number().int().min(1).max(20), complimentary: z.boolean() }))
    .min(1, "Agrega al menos un producto.")
    .max(30),
  idempotencyKey,
});

export type EarnResult =
  | { ok: true; replayed: boolean; stampsAdded: number; rewardsIssued: number; stampsBalance: number; rewardsBalance: number; stampsRequired: number }
  | (Failure & { retryAfterSeconds?: number });

export async function recordEarnAction(input: z.input<typeof earnInput>): Promise<EarnResult> {
  const parsed = earnInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos.", code: "invalid_request" };
  const scan = parseScanPayload(parsed.data.payload);
  if (!scan) return { ok: false, error: "Vuelve a escanear el código del cliente.", code: "token_invalid" };

  const pepper = serverEnv().PURCHASE_REFERENCE_PEPPER;
  if (!pepper) return { ok: false, error: "Falta configurar el servidor (referencia de tickets).", code: "not_configured" };

  const ctx = await operatorContext();
  if ("error" in ctx) return ctx.error!;

  let referenceHash: string;
  try {
    referenceHash = hashPurchaseReference(ctx.session.membership.business_id, parsed.data.folio, pepper);
  } catch {
    return { ok: false, error: "El folio solo puede tener letras, números y los signos # / _ .", code: "invalid_request" };
  }

  const { data, error } = await ctx.supabase.rpc("record_earn", {
    p_branch_id: ctx.branchId,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_purchase_reference_hash: referenceHash,
    p_items: parsed.data.items.map((i) => ({ product_id: i.productId, quantity: i.quantity, complimentary: i.complimentary })),
    p_scan_token_hash: scan.hash,
    p_card_id: null,
    p_nfc_public_id: null,
  });
  if (error) return networkFailure;
  if (!data?.ok) {
    const base = fail(data?.code);
    return typeof data?.retry_after_seconds === "number" ? { ...base, retryAfterSeconds: data.retry_after_seconds } : base;
  }
  return {
    ok: true,
    replayed: Boolean(data.replayed),
    stampsAdded: Number(data.stamps_added ?? 0),
    rewardsIssued: Number(data.rewards_issued ?? 0),
    stampsBalance: Number(data.stamps_balance),
    rewardsBalance: Number(data.rewards_balance),
    stampsRequired: Number(data.stamps_required),
  };
}

// ---------------------------------------------------------------------
// Canjear una recompensa (el QR de canje es la confirmación del cliente)
// ---------------------------------------------------------------------
const redeemInput = z.object({ payload: z.string().max(200), idempotencyKey });

export type RedeemResult =
  | { ok: true; replayed: boolean; rewardValueCapCents: number | null; rewardDescription: string | null; rewardsBalance: number }
  | Failure;

export async function redeemAction(input: z.input<typeof redeemInput>): Promise<RedeemResult> {
  const parsed = redeemInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisa los datos.", code: "invalid_request" };
  const scan = parseScanPayload(parsed.data.payload);
  if (!scan) return { ok: false, error: "Vuelve a escanear el código de canje.", code: "token_invalid" };

  const ctx = await operatorContext();
  if ("error" in ctx) return ctx.error!;

  const { data, error } = await ctx.supabase.rpc("redeem_reward", {
    p_branch_id: ctx.branchId,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_scan_token_hash: scan.hash,
  });
  if (error) return networkFailure;
  if (!data?.ok) return fail(data?.code);
  return {
    ok: true,
    replayed: Boolean(data.replayed),
    rewardValueCapCents: typeof data.reward_value_cap_cents === "number" ? data.reward_value_cap_cents : null,
    rewardDescription: typeof data.reward_description === "string" ? data.reward_description : null,
    rewardsBalance: Number(data.rewards_balance),
  };
}
