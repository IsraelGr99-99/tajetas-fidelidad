import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicSupabaseConfig } from "./config";

/**
 * Refresca la sesión de Supabase en cada navegación y devuelve si hay usuario
 * con JWT verificado (`getClaims`). No decide permisos: eso lo hace el servidor.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = publicSupabaseConfig();
  if (!config) return { response, userId: null as string | null };

  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  return { response, userId: typeof sub === "string" ? sub : null };
}
