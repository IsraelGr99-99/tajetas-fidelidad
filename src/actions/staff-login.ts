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
      const { error: sendError } = await anon.auth
        .signInWithOtp({ email, options: { shouldCreateUser: true, captchaToken: captchaToken ?? undefined } })
        .catch(() => ({ error: { code: "network", status: 0 } }));
      // Un fallo de envío queda registrado (sin el correo) para poder diagnosticarlo.
      if (sendError) {
        await admin
          .from("audit_log")
          .insert({ action: "staff.login_code", outcome: "error", details: { code: sendError.code ?? "unknown", status: sendError.status ?? null } });
      }
    });
  }
  return { ok: true };
}
