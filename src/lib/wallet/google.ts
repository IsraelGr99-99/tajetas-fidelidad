import "server-only";
import { createSign } from "node:crypto";
import { z } from "zod";
import { serverEnv } from "@/lib/env";

/**
 * Adaptador de Google Wallet (tarjetas de lealtad).
 * - Autentica con la cuenta de servicio (JWT RS256 → token OAuth) sin librerías externas.
 * - Crea/actualiza la LoyaltyClass del negocio y un LoyaltyObject por tarjeta.
 * - Firma el enlace "Agregar a Google Wallet".
 * Nunca se ejecuta en el navegador ni registra llaves o tokens.
 */

const API = "https://walletobjects.googleapis.com/walletobjects/v1";
const SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";

const serviceAccountSchema = z.object({
  client_email: z.email(),
  private_key: z.string().includes("PRIVATE KEY"),
  token_uri: z.url().default("https://oauth2.googleapis.com/token"),
});

export type GoogleWalletConfig = {
  issuerId: string;
  serviceAccount: z.infer<typeof serviceAccountSchema>;
  mode: "demo" | "public";
  appUrl: string;
  logoUrl: string | null;
};

export function googleWalletConfig(): GoogleWalletConfig | null {
  const env = serverEnv();
  if (!env.GOOGLE_WALLET_ISSUER_ID || !env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_BASE64) return null;
  try {
    const json = JSON.parse(Buffer.from(env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_BASE64, "base64").toString("utf8"));
    return {
      issuerId: env.GOOGLE_WALLET_ISSUER_ID,
      serviceAccount: serviceAccountSchema.parse(json),
      mode: env.GOOGLE_WALLET_MODE,
      appUrl: env.NEXT_PUBLIC_APP_URL.replace(/\/$/, ""),
      logoUrl: env.GOOGLE_WALLET_LOGO_URL ?? null,
    };
  } catch {
    // Configuración inválida: se trata como “no configurado” (sin exponer el contenido).
    return null;
  }
}

const b64url = (value: string | Buffer) => Buffer.from(value).toString("base64url");

export function signJwt(payload: Record<string, unknown>, privateKey: string): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${body}`);
  return `${header}.${body}.${signer.sign(privateKey).toString("base64url")}`;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(config: GoogleWalletConfig): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt(
    { iss: config.serviceAccount.client_email, scope: SCOPE, aud: config.serviceAccount.token_uri, iat: now, exp: now + 3600 },
    config.serviceAccount.private_key,
  );
  const res = await fetch(config.serviceAccount.token_uri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new Error(`Google OAuth respondió ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function api(config: GoogleWalletConfig, method: "GET" | "POST" | "PATCH", path: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${await accessToken(config)}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 404 && method === "GET") return null;
  if (!res.ok) {
    // Solo el código y el mensaje corto de Google; nunca credenciales.
    const detail = await res
      .json()
      .then((j: { error?: { message?: string } }) => j.error?.message ?? "")
      .catch(() => "");
    throw new Error(`Google Wallet ${method} ${path.split("/")[1]} → ${res.status} ${detail}`.slice(0, 280));
  }
  return res.json();
}

// ---------------------------------------------------------------------
// Construcción de clase y objeto
// ---------------------------------------------------------------------
export type CardSnapshot = {
  card_id: string;
  public_serial: string;
  version: number;
  stamps_balance: number;
  rewards_balance: number;
  display_name: string | null;
  customer_active: boolean;
  business_slug: string;
  business_name: string;
  stamps_required: number | null;
  reward_description: string | null;
};

export const classIdFor = (config: GoogleWalletConfig, businessSlug: string) => `${config.issuerId}.${businessSlug}-fidelidad`;
export const objectIdFor = (config: GoogleWalletConfig, card: Pick<CardSnapshot, "public_serial">) => `${config.issuerId}.tarjeta-${card.public_serial}`;

export function buildLoyaltyClass(config: GoogleWalletConfig, card: CardSnapshot) {
  if (!config.logoUrl) throw new Error("Falta GOOGLE_WALLET_LOGO_URL (imagen pública HTTPS del logotipo).");
  return {
    id: classIdFor(config, card.business_slug),
    issuerName: card.business_name.slice(0, 20),
    programName: "Bitácora del viajero",
    programLogo: { sourceUri: { uri: config.logoUrl }, contentDescription: { defaultValue: { language: "es-MX", value: `Logotipo de ${card.business_name}` } } },
    hexBackgroundColor: "#3D2C24",
    reviewStatus: "UNDER_REVIEW",
    countryCode: "MX",
    localizedIssuerName: { defaultValue: { language: "es-MX", value: card.business_name.slice(0, 20) } },
    localizedProgramName: { defaultValue: { language: "es-MX", value: "Bitácora del viajero" } },
  };
}

export function buildLoyaltyObject(config: GoogleWalletConfig, card: CardSnapshot) {
  const required = card.stamps_required ?? 0;
  return {
    id: objectIdFor(config, card),
    classId: classIdFor(config, card.business_slug),
    state: card.customer_active ? "ACTIVE" : "INACTIVE",
    // Sin PII de contacto: número corto de tarjeta y nombre opcional elegido por el cliente.
    accountId: card.public_serial.slice(0, 8).toUpperCase(),
    accountName: card.display_name ?? "Viajero",
    loyaltyPoints: { label: "Sellos", balance: { string: required ? `${Math.min(card.stamps_balance, required)} de ${required}` : String(card.stamps_balance) } },
    secondaryLoyaltyPoints: { label: "Recompensas", balance: { int: card.rewards_balance } },
    textModulesData: [
      {
        id: "regla",
        header: "Tu recompensa",
        body: required && card.reward_description ? `${required} compras elegibles = ${card.reward_description.toLowerCase()}.` : "Programa en pausa.",
      },
      {
        id: "como-usar",
        header: "Cómo sumar sellos",
        body: "Abre tu tarjeta desde el enlace y muestra el código QR al pagar. El código cambia cada 2 minutos por seguridad.",
      },
    ],
    linksModuleData: { uris: [{ id: "tarjeta", uri: `${config.appUrl}/tarjeta`, description: "Abrir mi tarjeta y mostrar mi código" }] },
  };
}

// ---------------------------------------------------------------------
// Operaciones
// ---------------------------------------------------------------------
const ensuredClasses = new Set<string>();

async function ensureClass(config: GoogleWalletConfig, card: CardSnapshot) {
  const klass = buildLoyaltyClass(config, card);
  if (ensuredClasses.has(klass.id)) return;
  const existing = await api(config, "GET", `/loyaltyClass/${encodeURIComponent(klass.id)}`);
  if (existing) {
    // reviewStatus no se reenvía: Google lo controla una vez aprobada la clase.
    const { reviewStatus: _omit, ...patch } = klass;
    void _omit;
    await api(config, "PATCH", `/loyaltyClass/${encodeURIComponent(klass.id)}`, patch);
  } else {
    await api(config, "POST", "/loyaltyClass", klass);
  }
  ensuredClasses.add(klass.id);
}

/** Crea o actualiza el objeto de la tarjeta (y la clase si hace falta). */
export async function upsertLoyaltyObject(config: GoogleWalletConfig, card: CardSnapshot) {
  await ensureClass(config, card);
  const object = buildLoyaltyObject(config, card);
  const path = `/loyaltyObject/${encodeURIComponent(object.id)}`;
  const existing = await api(config, "GET", path);
  if (existing) await api(config, "PATCH", path, object);
  else await api(config, "POST", "/loyaltyObject", object);
  return object.id;
}

/** Enlace firmado "Agregar a Google Wallet" para un objeto ya creado. */
export function saveUrl(config: GoogleWalletConfig, objectId: string): string {
  const jwt = signJwt(
    {
      iss: config.serviceAccount.client_email,
      aud: "google",
      typ: "savetowallet",
      iat: Math.floor(Date.now() / 1000),
      origins: [config.appUrl],
      payload: { loyaltyObjects: [{ id: objectId }] },
    },
    config.serviceAccount.private_key,
  );
  return `https://pay.google.com/gp/v/save/${jwt}`;
}
