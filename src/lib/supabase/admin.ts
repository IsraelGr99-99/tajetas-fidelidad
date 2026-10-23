import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

/**
 * Cliente con la llave secreta: OMITE RLS. Uso restringido a operaciones de Auth
 * que la base no puede hacer (p. ej. borrar el usuario de Supabase Auth al eliminar
 * la cuenta). Nunca usarlo para leer o escribir datos de negocio.
 */
export function createSupabaseAdminClient() {
  const env = serverEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SECRET_KEY) return null;
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
