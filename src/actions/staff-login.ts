"use server";

import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { after } from "next/server";
import { emailSchema } from "@/domain/customer/contact";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { publicSupabaseConfig } from "@/lib/supabase/config";

export type StaffCodeResult = { ok: true } | { ok: false; message: string };

/**
 * IP del cliente según el proveedor de hosting (cabeceras que el proveedor reescribe y el
 * navegador no puede falsificar), seudonimizada para el límite de intentos.
 */
async function clientHash() {
  const h = await headers();
  const ip =
    h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "desconocido";
  return createHash("sha256").update(`staff-otp:${ip}`).digest("hex");
}

/**
 * Pide un código de acceso para el personal. Solo se envía si el correo es de
 * personal activo o tiene invitación pendiente. La respuesta y su tiempo son iguales
 * en ambos casos: el envío ocurre después de responder (`after`).
 */
export async function requestStaffCodeAction(rawEmail: string, captchaToken?: string | null): Promise<StaffCodeResult> {
  const parsed = emailSchema.safeParse(String(rawEmail ?? ""));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Correo inválido." };

  const admin = createSupabaseAdminClient();
  const config = publicSupabaseConfig();
  if (!admin || !config) return { ok: false, message: "El acceso no está configurado en este entorno." };

  const { data, error } = await admin.rpc("request_staff_login_code", { p_email: parsed.data, p_client_hash: await clientHash() });
  if (error) return { ok: false, message: "No se pudo contactar al servidor. Intenta de nuevo." };
  // El límite de intentos aplica igual a cualquier correo, así que revelarlo no filtra nada.
  if (!data?.ok) return { ok: false, message: data?.code === "rate_limited" ? "Demasiados intentos. Espera unos minutos." : "Revisa el correo e inténtalo de nuevo." };

  if (data.eligible) {
    const email = parsed.data;
    after(async () => {
      const anon = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
      await anon.auth.signInWithOtp({ email, options: { shouldCreateUser: true, captchaToken: captchaToken ?? undefined } }).catch(() => undefined);
    });
  }
  return { ok: true };
}
