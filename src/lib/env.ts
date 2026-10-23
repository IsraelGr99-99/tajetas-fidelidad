import "server-only";
import { z } from "zod";

/**
 * Variables de entorno del servidor. Se validan una sola vez y de forma perezosa
 * para que las páginas públicas funcionen aunque las integraciones no estén configuradas.
 * Nunca importar este módulo desde componentes de cliente (lo impide `server-only`).
 */
const optional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const serverEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_BUSINESS_URL: z.url().default("https://iautomexa.com"),
  NEXT_PUBLIC_SUPABASE_URL: optional,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optional,
  SUPABASE_SECRET_KEY: optional,
  PURCHASE_REFERENCE_PEPPER: optional,
  APPLE_TEAM_ID: optional,
  APPLE_PASS_TYPE_ID: optional,
  APPLE_PASS_CERT_BASE64: optional,
  APPLE_PASS_KEY_BASE64: optional,
  APPLE_PASS_KEY_PASSPHRASE: optional,
  APPLE_WWDR_CERT_BASE64: optional,
  APPLE_APNS_KEY_ID: optional,
  APPLE_APNS_KEY_BASE64: optional,
  GOOGLE_WALLET_ISSUER_ID: optional,
  GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_BASE64: optional,
  GOOGLE_WALLET_MODE: z.enum(["demo", "public"]).default("demo"),
  /** Imagen pública HTTPS del logotipo (Google la descarga para mostrarla en el pase). */
  GOOGLE_WALLET_LOGO_URL: z.url().optional().or(z.literal("").transform(() => undefined)),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= serverEnvSchema.parse(process.env);
  return cached;
}

/** Estado de integraciones para mostrar mensajes honestos de “no configurado” en la UI. */
export function integrationStatus(env: ServerEnv = serverEnv()) {
  return {
    supabase: Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && env.SUPABASE_SECRET_KEY),
    appleWallet: Boolean(
      env.APPLE_TEAM_ID && env.APPLE_PASS_TYPE_ID && env.APPLE_PASS_CERT_BASE64 && env.APPLE_PASS_KEY_BASE64 && env.APPLE_WWDR_CERT_BASE64,
    ),
    googleWallet: Boolean(env.GOOGLE_WALLET_ISSUER_ID && env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_BASE64),
    googleWalletMode: env.GOOGLE_WALLET_MODE,
  } as const;
}
