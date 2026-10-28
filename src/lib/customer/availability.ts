import "server-only";
/** El piloto conserva su alta. Otros negocios requieren aviso legal propio antes de abrir el registro. */
export function customerEnrollmentOpen(slug: string): boolean {
  return slug === "cafe-nomada" || process.env.ENABLE_MULTI_BUSINESS_ENROLLMENT === "true";
}
