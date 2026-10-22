import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicSupabaseConfig } from "./config";

/**
 * Cliente de Supabase con la sesión del usuario (cookies). Usa la llave publicable:
 * todo lo que hace está limitado por RLS y por las funciones RPC.
 * Devuelve null si Supabase no está configurado.
 */
export async function createSupabaseServerClient() {
  const config = publicSupabaseConfig();
  if (!config) return null;
  const cookieStore = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // En Server Components no se pueden escribir cookies; el proxy refresca la sesión.
        }
      },
    },
  });
}
