import type { NextConfig } from "next";
import { LEGACY_REDIRECTS } from "./src/domain/staff/routes";

/**
 * Cabeceras de seguridad base. La CSP (con nonce por petición) la pone `src/proxy.ts`.
 */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

// Protección: una Secret Key de Turnstile (35 caracteres) en una variable pública
// quedaría en el código del navegador. Las Site Keys miden 24.
const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
if (turnstileSiteKey && turnstileSiteKey.length !== 24) {
  throw new Error(
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY no parece una Site Key de Turnstile (deben ser 24 caracteres). ¿Pegaste la Secret Key? La Secret Key va en Supabase, nunca en una variable NEXT_PUBLIC_.",
  );
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  // Rutas anteriores de la consola: redirección temporal a las nuevas, cortas.
  async redirects() {
    return LEGACY_REDIRECTS.map((r) => ({ ...r, permanent: false }));
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
