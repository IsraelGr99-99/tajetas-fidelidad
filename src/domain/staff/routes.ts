/** Rutas de la consola del personal: cortas y en español. */
export const CONSOLE_HOME = "/barra";
export const LOGIN_PATH = "/entrar";
export const BRANCH_PICKER_PATH = "/cuenta";
export const NO_ACCESS_PATH = "/sin-acceso";

/** Secciones que requieren sesión de personal (las protege `proxy.ts`). */
export const CONSOLE_PREFIXES = ["/barra", "/movimientos", "/negocio", "/cuenta"] as const;

export function isConsolePath(pathname: string): boolean {
  return CONSOLE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Evita redirecciones abiertas: solo se aceptan rutas internas de la consola.
 * Cualquier otra cosa (URLs absolutas, `//host`, `\\`, control) vuelve al inicio de la consola.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || typeof value !== "string" || value.length > 300) return CONSOLE_HOME;
  if (value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) return CONSOLE_HOME;
  const pathname = value.split(/[?#]/)[0];
  return isConsolePath(pathname) ? value : CONSOLE_HOME;
}

/** Rutas anteriores (etapas 3–5) que redirigen a las nuevas. */
export const LEGACY_REDIRECTS: { source: string; destination: string }[] = [
  { source: "/personal", destination: "/barra" },
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
