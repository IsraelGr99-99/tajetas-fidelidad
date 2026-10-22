import "server-only";
import { createHash, randomBytes } from "node:crypto";

/**
 * Códigos QR temporales. El QR solo lleva `CN1.<token>`: 32 bytes aleatorios en
 * base64url, sin nombre, contacto ni saldo. La base guarda únicamente el SHA-256.
 */
export const SCAN_PAYLOAD_PREFIX = "CN1.";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateScanToken(): { payload: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { payload: SCAN_PAYLOAD_PREFIX + token, hash: hashScanToken(token) };
}

export function hashScanToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Interpreta lo leído por la cámara. Entrada no confiable: formato estricto o null. */
export function parseScanPayload(raw: string): { hash: string } | null {
  const text = raw.trim();
  if (!text.startsWith(SCAN_PAYLOAD_PREFIX)) return null;
  const token = text.slice(SCAN_PAYLOAD_PREFIX.length);
  return TOKEN_PATTERN.test(token) ? { hash: hashScanToken(token) } : null;
}
