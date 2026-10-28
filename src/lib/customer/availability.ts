import "server-only";
import { PILOT_BUSINESS_SLUG } from "@/lib/business";

/** El piloto conserva su alta. Otros negocios requieren aviso legal propio antes de abrir el registro. */
export function customerEnrollmentOpen(slug: string): boolean {
  return slug === PILOT_BUSINESS_SLUG || process.env.ENABLE_MULTI_BUSINESS_ENROLLMENT === "true";
}
