/** Rutas de la consola del personal: cortas y en español. */
export const CONSOLE_HOME = "/inicio";
export const LOGIN_PATH = "/entrar";
export const BRANCH_PICKER_PATH = "/cuenta";
export const NO_ACCESS_PATH = "/sin-acceso";

/** Secciones que requieren sesión de personal (las protege `proxy.ts`). */
export const CONSOLE_PREFIXES = ["/inicio", "/barra", "/caja", "/movimientos", "/negocio", "/cuenta", "/seleccionar-negocio"] as const;

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
