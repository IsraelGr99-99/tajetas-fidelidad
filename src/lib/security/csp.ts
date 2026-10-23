/**
 * Content Security Policy con nonce por petición (la aplica `proxy.ts`).
 * - Scripts: solo los del propio sitio con el nonce de esta respuesta ('strict-dynamic'
 *   permite los que esos scripts carguen, p. ej. Turnstile).
 * - Estilos: 'unsafe-inline' porque React escribe atributos `style`; el riesgo es
 *   mucho menor que en scripts y se compensa con el resto de la política.
 */
export function buildCsp(nonce: string, opts: { dev: boolean; supabaseUrl?: string }): string {
  const supabase = opts.supabaseUrl ? new URL(opts.supabaseUrl).origin : "";
  const supabaseWs = supabase ? supabase.replace(/^http/, "ws") : "";
  const turnstile = "https://challenges.cloudflare.com";
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${turnstile}${opts.dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${supabase} ${supabaseWs} ${turnstile}`.trim(),
    `frame-src ${turnstile}`,
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(opts.dev ? [] : ["upgrade-insecure-requests"]),
  ];
  return directives.join("; ");
}

export function createNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}
