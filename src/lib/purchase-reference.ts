import "server-only";
import { createHmac } from "node:crypto";

/**
 * Seudonimiza el folio del ticket: HMAC-SHA256 con un pepper secreto del servidor,
 * separado por empresa y sucursal (cada punto de venta puede reiniciar sus folios). La base nunca ve el folio en claro y no puede revertirse sin el secreto.
 */
export function normalizeTicketFolio(folio: string): string {
  return folio.normalize("NFKC").trim().toUpperCase().replace(/[\s-]+/g, "");
}

export function hashPurchaseReference(businessId: string, branchId: string, folio: string, pepper: string): string {
  if (pepper.length < 32) throw new Error("PURCHASE_REFERENCE_PEPPER debe tener al menos 32 caracteres");
  const normalized = normalizeTicketFolio(folio);
  if (!/^[A-Z0-9#/_.]{1,40}$/.test(normalized)) throw new RangeError("Folio de ticket inválido");
  return createHmac("sha256", pepper).update(`${businessId}:${branchId}:${normalized}`, "utf8").digest("hex");
}
