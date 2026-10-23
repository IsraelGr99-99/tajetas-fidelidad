"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { emailSchema } from "@/domain/customer/contact";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type StaffCodeCheck = { ok: true; eligible: boolean } | { ok: false; message: string };

/**
 * IP del cliente, seudonimizada para el límite de intentos. Solo se confía en la cabecera
 * que el hosting reescribe (`TRUSTED_IP_HEADER`; en Vercel, `x-vercel-forwarded-for`).
 * Cualquier otra cabecera la puede inventar el navegador.
 */
async function clientHash() {
  const h = await headers();
  const trusted = (process.env.TRUSTED_IP_HEADER || "x-vercel-forwarded-for").toLowerCase();
  const ip = h.get(trusted)?.split(",")[0]?.trim() || "desconocido";
  return createHash("sha256").update(`staff-otp:${ip}`).digest("hex");
}

/**
 * ¿Puede este correo recibir un código de acceso del personal? (personal activo o
 * invitación pendiente). Con límite por correo y por dispositivo.
 *
 * El envío lo hace el navegador con su propio token de CAPTCHA: Supabase valida el
 * token del visitante en su petición. Reenviarlo desde el servidor lo hacía fallar
 * (`captcha_failed`). Riesgo aceptado: quien inspeccione la red puede saber si un
 * correo es del personal (limitado a 5 consultas por correo y hora).
 */
export async function checkStaffCodeAction(rawEmail: string): Promise<StaffCodeCheck> {
  const parsed = emailSchema.safeParse(String(rawEmail ?? ""));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Correo inválido." };

  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, message: "El acceso no está configurado en este entorno." };

  const { data, error } = await admin.rpc("request_staff_login_code", { p_email: parsed.data, p_client_hash: await clientHash() });
  if (error) return { ok: false, message: "No se pudo contactar al servidor. Intenta de nuevo." };
  if (!data?.ok) return { ok: false, message: data?.code === "rate_limited" ? "Demasiados intentos. Espera unos minutos." : "Revisa el correo e inténtalo de nuevo." };
  return { ok: true, eligible: Boolean(data.eligible) };
}
