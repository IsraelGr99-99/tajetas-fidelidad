"use server";

import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { emailSchema } from "@/domain/customer/contact";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { publicSupabaseConfig } from "@/lib/supabase/config";

export type StaffCodeResult = { ok: true } | { ok: false; message: string };

/** Identificador seudónimo del dispositivo para limitar intentos (no se guarda la IP en claro). */
async function clientHash() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconocido";
  return createHash("sha256").update(`staff-otp:${ip}`).digest("hex");
}

/**
 * Pide un código de acceso para el personal. Solo se envía si el correo es de
 * personal activo o tiene una invitación pendiente. La respuesta es la misma en
 * ambos casos para no revelar quién pertenece al personal.
 */
export async function requestStaffCodeAction(rawEmail: string): Promise<StaffCodeResult> {
  const parsed = emailSchema.safeParse(String(rawEmail ?? ""));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Correo inválido." };

  const admin = createSupabaseAdminClient();
  const config = publicSupabaseConfig();
  if (!admin || !config) return { ok: false, message: "El acceso no está configurado en este entorno." };

  const { data, error } = await admin.rpc("request_staff_login_code", { p_email: parsed.data, p_client_hash: await clientHash() });
  if (error) return { ok: false, message: "No se pudo contactar al servidor. Intenta de nuevo." };
  if (!data?.ok) {
    return { ok: false, message: data?.code === "rate_limited" ? "Demasiados intentos. Espera unos minutos." : "Revisa el correo e inténtalo de nuevo." };
  }

  if (data.eligible) {
    // Cliente sin sesión: solo dispara el correo. La verificación del código ocurre en el navegador.
    const anon = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: sendError } = await anon.auth.signInWithOtp({ email: parsed.data, options: { shouldCreateUser: true } });
    if (sendError && (sendError.status === 429 || sendError.code?.startsWith("over_"))) {
      return { ok: false, message: "Se alcanzó el límite de envíos. Espera unos minutos." };
    }
  }
  return { ok: true };
}
