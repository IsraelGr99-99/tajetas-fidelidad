/**
 * Configuración pública de Supabase (URL y llave publicable). Puede usarse en el
 * navegador: la llave publicable solo es segura porque toda tabla tiene RLS y
 * las escrituras pasan por funciones que validan permisos.
 * Las referencias deben ser literales para que Next las incruste en el bundle.
 */
export function publicSupabaseConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}
