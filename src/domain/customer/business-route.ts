import { PILOT_BUSINESS_SLUG } from "@/lib/business";

export function isValidBusinessSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 60;
}

/** Las URL antiguas del piloto siguen funcionando; el resto tiene ruta propia. */
export function customerPaths(slug: string) {
  if (!isValidBusinessSlug(slug)) throw new Error("Negocio inválido");
  const card = slug === PILOT_BUSINESS_SLUG ? "/tarjeta" : `/c/${slug}/tarjeta`;
  return { home: `/c/${slug}`, card, access: `${card}/acceso` };
}
