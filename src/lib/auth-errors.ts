/**
 * Motivo técnico que Supabase adjunta a `captcha_failed`, p. ej. "invalid-input-response"
 * o "timeout-or-duplicate" (códigos de Cloudflare). No contiene datos personales.
 */
export function captchaReason(message: string | undefined): string | null {
  const m = message?.match(/request disallowed \(([a-z-]+)\)/i);
  return m ? m[1] : null;
}

/** Mensaje para el usuario según el motivo de Cloudflare. */
export function captchaFailedMessage(message: string | undefined): string {
  const reason = captchaReason(message);
  if (reason === "timeout-or-duplicate") return "La verificación de seguridad caducó o ya se usó. Espera a que se vuelva a completar e inténtalo de nuevo.";
  if (reason === "invalid-input-response")
    return "Supabase no aceptó la verificación de seguridad (motivo: invalid-input-response). Revisa que la Site Key de la app y la Secret Key de Supabase sean del mismo widget de Cloudflare.";
  if (reason === "invalid-input-secret") return "La llave secreta del CAPTCHA en Supabase no es válida (motivo: invalid-input-secret).";
  return `La verificación de seguridad no pasó${reason ? ` (motivo: ${reason})` : ""}. Espera a que se complete e inténtalo de nuevo.`;
}
