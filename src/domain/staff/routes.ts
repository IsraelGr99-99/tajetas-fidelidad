export const CONSOLE_HOME = "/personal";
export const LOGIN_PATH = "/personal/ingresar";
export const BRANCH_PICKER_PATH = "/personal/sucursal";
export const NO_ACCESS_PATH = "/personal/sin-acceso";

/**
 * Evita redirecciones abiertas: solo se aceptan rutas internas de la consola.
 * Cualquier otra cosa (URLs absolutas, `//host`, `\`) vuelve al inicio de la consola.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || typeof value !== "string" || value.length > 300) return CONSOLE_HOME;
  if (!value.startsWith("/personal") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) {
    return CONSOLE_HOME;
  }
  if (value.startsWith(LOGIN_PATH)) return CONSOLE_HOME;
  const next = value.slice("/personal".length);
  if (next !== "" && !next.startsWith("/") && !next.startsWith("?")) return CONSOLE_HOME;
  return value;
}
