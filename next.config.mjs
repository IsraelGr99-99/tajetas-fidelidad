const legacyRedirects = [
  { source: "/personal", destination: "/inicio" },
  { source: "/personal/ingresar", destination: "/entrar" },
  { source: "/personal/visita", destination: "/barra" },
  { source: "/personal/canje", destination: "/barra" },
  { source: "/personal/sucursal", destination: "/cuenta" },
  { source: "/personal/sin-acceso", destination: "/sin-acceso" },
  { source: "/personal/movimientos", destination: "/movimientos" },
  { source: "/personal/admin", destination: "/negocio" },
  { source: "/personal/admin/catalogo", destination: "/negocio/catalogo" },
  { source: "/personal/admin/campana", destination: "/negocio/programa" },
  { source: "/personal/admin/personal", destination: "/negocio/equipo" },
  { source: "/personal/admin/sucursales", destination: "/negocio/equipo" },
  { source: "/personal/admin/clientes", destination: "/negocio/clientes" },
];

/** Cabeceras de seguridad base. La CSP con nonce la pone `src/proxy.ts`. */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

// Una Secret Key de Turnstile no debe quedar en una variable pública.
const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
if (turnstileSiteKey && turnstileSiteKey.length !== 24) {
  throw new Error(
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY no parece una Site Key de Turnstile (deben ser 24 caracteres). ¿Pegaste la Secret Key? La Secret Key va en Supabase, nunca en una variable NEXT_PUBLIC_.",
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  async redirects() {
    return legacyRedirects.map((r) => ({ ...r, permanent: false }));
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
