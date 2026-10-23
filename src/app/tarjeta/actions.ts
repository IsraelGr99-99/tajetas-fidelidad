"use server";

import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { z } from "zod";
import { PRIVACY_VERSION, displayNameSchema } from "@/domain/customer/contact";
import { rpcErrorMessage } from "@/domain/loyalty/messages";
import { PILOT_BUSINESS_SLUG } from "@/lib/business";
import { generateScanToken } from "@/lib/scan-token";
import { googleWalletConfig, saveUrl } from "@/lib/wallet/google";
import { createGoogleWalletPass } from "@/lib/wallet/sync";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FormState = { error: string | null };

/**
 * Crea la tarjeta del cliente autenticado. El contacto lo toma la base de datos de
 * Supabase Auth (ya verificado); el navegador solo aporta el nombre opcional y la aceptación.
 */
export async function enrollAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = displayNameSchema.safeParse(String(formData.get("displayName") ?? ""));
  if (!name.success) return { error: name.error.issues[0]?.message ?? "Revisa tu nombre." };
  if (formData.get("privacy") !== "on") return { error: "Para crear tu tarjeta necesitas aceptar el aviso de privacidad." };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "El servicio no está configurado en este entorno." };

  const { data, error } = await supabase.rpc("enroll_customer", {
    p_business_slug: PILOT_BUSINESS_SLUG,
    p_display_name: name.data,
    p_privacy_version: PRIVACY_VERSION,
  });
  if (error) return { error: "No pudimos crear tu tarjeta. Inténtalo de nuevo en un momento." };
  if (!data?.ok) {
    if (data?.code === "not_authenticated") redirect("/tarjeta/acceso");
    return { error: rpcErrorMessage(data?.code) };
  }
  redirect("/tarjeta?bienvenida=1");
}

const qrRequestSchema = z.object({ cardId: z.uuid(), purpose: z.enum(["identify", "redeem"]) });

export type QrResult =
  | { ok: true; svg: string; expiresAt: string; purpose: "identify" | "redeem"; ref: string }
  | { ok: false; error: string; code?: string };

const QR_TTL_SECONDS = 120;

/**
 * Emite un código QR temporal de un solo uso. La base valida que la tarjeta sea del
 * usuario, aplica límite de frecuencia y guarda solo el hash del token.
 */
export async function issueQrAction(input: { cardId: string; purpose: "identify" | "redeem" }): Promise<QrResult> {
  const parsed = qrRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Solicitud inválida." };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "El servicio no está configurado en este entorno." };

  const { payload, hash } = generateScanToken();
  const { data, error } = await supabase.rpc("issue_scan_token", {
    p_card_id: parsed.data.cardId,
    p_purpose: parsed.data.purpose,
    p_token_hash: hash,
    p_ttl_seconds: QR_TTL_SECONDS,
  });
  if (error) return { ok: false, error: "No pudimos generar tu código. Revisa tu conexión." };
  if (!data?.ok) return { ok: false, error: rpcErrorMessage(data?.code), code: data?.code };

  const svg = await QRCode.toString(payload, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#241914", light: "#FBF7F4" },
  });
  // `ref` es el hash del token (no el token): sirve para consultar si ya lo escanearon.
  return { ok: true, svg, expiresAt: String(data.expires_at), purpose: parsed.data.purpose, ref: hash };
}

const statusInput = z.object({ cardId: z.uuid(), ref: z.string().regex(/^[a-f0-9]{64}$/).nullable() });

export type CardStatus =
  | {
      ok: true;
      version: number;
      stampsBalance: number;
      rewardsBalance: number;
      tokenState: "active" | "scanned" | "expired" | "unknown";
      lastEvent: { eventType: string; stampsDelta: number; rewardsDelta: number } | null;
    }
  | { ok: false };

/** Estado ligero de la tarjeta para actualizar la pantalla del cliente en vivo. */
export async function cardStatusAction(input: { cardId: string; ref: string | null }): Promise<CardStatus> {
  const parsed = statusInput.safeParse(input);
  if (!parsed.success) return { ok: false };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };
  const { data, error } = await supabase.rpc("my_card_status", { p_card_id: parsed.data.cardId, p_token_hash: parsed.data.ref });
  if (error || !data?.ok) return { ok: false };
  const last = data.last_event as { event_type: string; stamps_delta: number; rewards_delta: number } | null;
  return {
    ok: true,
    version: Number(data.version),
    stampsBalance: Number(data.stamps_balance),
    rewardsBalance: Number(data.rewards_balance),
    tokenState: data.token_state,
    lastEvent: last ? { eventType: last.event_type, stampsDelta: last.stamps_delta, rewardsDelta: last.rewards_delta } : null,
  };
}

export async function customerSignOutAction() {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut({ scope: "local" });
  redirect("/tarjeta/acceso?salida=1");
}

/**
 * Elimina los datos personales del cliente (LFPDPPP, derecho de cancelación).
 * 1) La base anonimiza su registro (el historial contable queda sin PII).
 * 2) Si la cuenta no es de personal, se borra también el usuario de Supabase Auth.
 */
export async function deleteMyDataAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "ELIMINAR") {
    return { error: "Escribe ELIMINAR para confirmar." };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "El servicio no está configurado en este entorno." };
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/tarjeta/acceso");

  const { data, error } = await supabase.rpc("delete_my_customer_data", { p_business_slug: PILOT_BUSINESS_SLUG });
  if (error) return { error: "No pudimos eliminar tus datos. Inténtalo de nuevo en un momento." };
  if (!data?.ok) return { error: rpcErrorMessage(data?.code) };

  if (!data.is_staff) {
    const admin = createSupabaseAdminClient();
    // Si falla, los datos de la tarjeta ya están anonimizados; la cuenta de acceso queda vacía.
    if (admin) await admin.auth.admin.deleteUser(userId).catch(() => undefined);
  }
  await supabase.auth.signOut({ scope: "global" }).catch(() => undefined);
  redirect("/tarjeta/acceso?eliminada=1");
}

export type WalletResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Crea o actualiza el pase de Google Wallet de la tarjeta del cliente y devuelve el
 * enlace firmado para guardarlo. La propiedad de la tarjeta se verifica con la sesión.
 */
export async function addToGoogleWalletAction(): Promise<WalletResult> {
  const config = googleWalletConfig();
  if (!config) return { ok: false, error: "Google Wallet no está configurado en este entorno." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "El servicio no está configurado." };
  const { data } = await supabase.rpc("get_my_card", { p_business_slug: PILOT_BUSINESS_SLUG });
  const cardId = data?.ok ? (data.card?.id as string | undefined) : undefined;
  if (!cardId) return { ok: false, error: rpcErrorMessage(data?.code ?? "not_enrolled") };
  if (!rateLimitWallet(cardId)) return { ok: false, error: "Espera un momento antes de volver a intentarlo." };
  try {
    const objectId = await createGoogleWalletPass(cardId);
    return { ok: true, url: saveUrl(config, objectId) };
  } catch {
    return { ok: false, error: "No pudimos preparar tu pase de Google Wallet. Inténtalo más tarde." };
  }
}

// Freno simple por instancia (el pase se puede regenerar sin riesgo; solo evita ráfagas).
const lastWalletRequest = new Map<string, number>();
function rateLimitWallet(cardId: string) {
  const now = Date.now();
  if ((lastWalletRequest.get(cardId) ?? 0) > now - 5_000) return false;
  lastWalletRequest.set(cardId, now);
  return true;
}
