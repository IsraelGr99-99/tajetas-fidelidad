"use server";

/**
 * SOLO DESARROLLO. Valida un token de Turnstile directamente con Cloudflare usando
 * `TURNSTILE_SECRET_KEY` de `.env.local`, para saber si la Site Key de la app y la
 * Secret Key pertenecen al mismo widget. Nunca devuelve ni registra la llave.
 */
export type CaptchaDiagnosis = { ok: boolean; detail: string; hostname?: string; errorCodes?: string[] };

export async function diagnoseCaptchaAction(token: string): Promise<CaptchaDiagnosis> {
  if (process.env.NODE_ENV === "production") return { ok: false, detail: "No disponible en producción." };
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: false, detail: "Agrega TURNSTILE_SECRET_KEY a .env.local (la Secret Key del widget) y reinicia npm run dev." };
  if (typeof token !== "string" || token.length < 10 || token.length > 4096) return { ok: false, detail: "Token inválido." };

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token }),
  });
  const data = (await res.json()) as { success: boolean; hostname?: string; "error-codes"?: string[] };
  return {
    ok: data.success,
    hostname: data.hostname,
    errorCodes: data["error-codes"],
    detail: data.success
      ? "Cloudflare acepta el token con esta Secret Key: las llaves SÍ son del mismo widget. El problema está en Supabase: confirma que el proveedor sea Turnstile y pega exactamente esta misma Secret Key."
      : "Cloudflare rechaza el token con esta Secret Key: la Site Key de la app y esta Secret Key NO son del mismo widget (o la Secret Key se regeneró).",
  };
}
