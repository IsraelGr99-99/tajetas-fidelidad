import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { LOGIN_PATH, NO_ACCESS_PATH, isConsolePath, safeNextPath } from "@/domain/staff/routes";

/**
 * Refresca la sesión y saca a los visitantes sin sesión de la consola del personal
 * y de la tarjeta del cliente.
 * Es solo una primera barrera: cada página y Server Action vuelve a verificar
 * identidad y permisos en el servidor, y la base de datos los valida otra vez.
 */
export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  // Tarjeta del cliente: sin sesión, al acceso con código.
  const isCard = pathname === "/tarjeta" || (pathname.startsWith("/tarjeta/") && pathname !== "/tarjeta/acceso");
  if (isCard && !userId) {
    const url = request.nextUrl.clone();
    url.pathname = "/tarjeta/acceso";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if ((isConsolePath(pathname) || pathname === NO_ACCESS_PATH) && !userId) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.search = "";
    url.searchParams.set("siguiente", safeNextPath(pathname + search));
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|brand/|.*\\.(?:svg|png|jpg|jpeg|webp|ico|woff2?)$).*)"],
};
