/** Empresa del piloto. La arquitectura es multiempresa; la UI del cliente sirve a una por despliegue. */
export const PILOT_BUSINESS_SLUG = process.env.NEXT_PUBLIC_BUSINESS_SLUG ?? "cafe-nomada";

/** El canal teléfono requiere un proveedor SMS configurado en Supabase Auth. */
export const PHONE_AUTH_ENABLED = process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED === "true";
