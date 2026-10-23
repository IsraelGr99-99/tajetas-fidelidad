import "server-only";
import { after } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { type CardSnapshot, googleWalletConfig, upsertLoyaltyObject } from "./google";

type Snapshot = CardSnapshot & { google_object_id: string | null; google_synced_version: number | null };

async function snapshot(cardId: string): Promise<Snapshot | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.rpc("wallet_card_snapshot", { p_card_id: cardId });
  return error || !data ? null : (data as Snapshot);
}

/**
 * Sincroniza el pase de Google Wallet de una tarjeta si existe y está desactualizado.
 * Nunca lanza: un fallo queda registrado en `wallet_passes.last_error` y se reintenta
 * en la siguiente visita a /tarjeta o al procesar pases atrasados.
 */
export async function syncGoogleWallet(cardId: string, { force = false } = {}): Promise<void> {
  const config = googleWalletConfig();
  const admin = createSupabaseAdminClient();
  if (!config || !admin) return;
  const card = await snapshot(cardId);
  if (!card?.google_object_id) return;
  if (!force && card.google_synced_version === card.version) return;
  try {
    await upsertLoyaltyObject(config, card);
    await admin.rpc("wallet_mark_synced", { p_card_id: cardId, p_platform: "google", p_version: card.version, p_error: null });
  } catch (e) {
    const message = e instanceof Error ? e.message : "error desconocido";
    await admin.rpc("wallet_mark_synced", { p_card_id: cardId, p_platform: "google", p_version: card.version, p_error: message });
  }
}

/** Programa la sincronización después de responder, para no hacer esperar a la barra. */
export function syncWalletAfterResponse(cardId: string | null | undefined) {
  if (!cardId || !googleWalletConfig()) return;
  after(() => syncGoogleWallet(cardId));
}

/** Crea el pase (si no existe), lo actualiza y devuelve el id del objeto. Lanza si falla. */
export async function createGoogleWalletPass(cardId: string): Promise<string> {
  const config = googleWalletConfig();
  const admin = createSupabaseAdminClient();
  if (!config || !admin) throw new Error("not_configured");
  const card = await snapshot(cardId);
  if (!card || !card.customer_active) throw new Error("card_not_found");
  const objectId = await upsertLoyaltyObject(config, card);
  await admin.rpc("wallet_register_pass", { p_card_id: cardId, p_platform: "google", p_object_id: objectId });
  await admin.rpc("wallet_mark_synced", { p_card_id: cardId, p_platform: "google", p_version: card.version, p_error: null });
  return objectId;
}

/** Reintenta pases atrasados (para una tarea programada o un botón de administración). */
export async function syncStalePasses(limit = 50): Promise<number> {
  const admin = createSupabaseAdminClient();
  if (!admin || !googleWalletConfig()) return 0;
  const { data } = await admin.rpc("wallet_stale_passes", { p_limit: limit });
  const ids = ((data ?? []) as (string | { wallet_stale_passes: string })[]).map((r) => (typeof r === "string" ? r : r.wallet_stale_passes));
  for (const id of ids) await syncGoogleWallet(id);
  return ids.length;
}

/** Estado de Wallet para la página del cliente; si el pase quedó atrasado, lo reintenta en segundo plano. */
export async function walletStatusForCard(cardId: string) {
  const config = googleWalletConfig();
  if (!config) return { googleConfigured: false, googleMode: "demo" as const, hasGooglePass: false };
  const card = await snapshot(cardId);
  const hasGooglePass = Boolean(card?.google_object_id);
  if (card && hasGooglePass && card.google_synced_version !== card.version) syncWalletAfterResponse(cardId);
  return { googleConfigured: true, googleMode: config.mode, hasGooglePass };
}
