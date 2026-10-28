"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { LOGIN_PATH, safeNextPath } from "@/domain/staff/routes";
import { BRANCH_COOKIE, BUSINESS_COOKIE, getStaffSession } from "@/lib/staff/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Cierra la sesión en Supabase (revoca el refresh token) y limpia la sucursal elegida. */
export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut({ scope: "local" });
  (await cookies()).delete(BRANCH_COOKIE);
  (await cookies()).delete(BUSINESS_COOKIE);
  redirect(`${LOGIN_PATH}?salida=1`);
}

const selectBranchSchema = z.object({ branchId: z.uuid() });

/** Cambia el negocio activo tras consultar membresías vigentes en la base. */
export async function selectBusinessAction(formData: FormData) {
  const businessId = z.uuid().safeParse(formData.get("businessId"));
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect(LOGIN_PATH);
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect(LOGIN_PATH);
  const { data, error } = await supabase.rpc("get_staff_context");
  const memberships = !error && data?.ok && Array.isArray(data.memberships) ? data.memberships : [];
  if (!businessId.success || !memberships.some((item: { business_id?: string }) => item.business_id === businessId.data)) {
    redirect("/seleccionar-negocio?error=acceso");
  }
  const origin = (await headers()).get("origin");
  const cookieStore = await cookies();
  cookieStore.set(BUSINESS_COOKIE, businessId.data, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && !origin?.startsWith("http://"),
    path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  cookieStore.delete(BRANCH_COOKIE);
  redirect(safeNextPath(String(formData.get("returnTo") ?? "")));
}

/**
 * Guarda la sucursal elegida. Las Server Actions son accesibles por POST directo,
 * así que se revalida la identidad y que la sucursal pertenezca al usuario.
 */
export async function selectBranchAction(formData: FormData) {
  const parsed = selectBranchSchema.safeParse({ branchId: formData.get("branchId") });
  const session = await getStaffSession();
  if (session.status !== "staff") redirect(LOGIN_PATH);
  if (!parsed.success || !session.membership.branches.some((b) => b.id === parsed.data.branchId)) {
    redirect("/cuenta?error=sucursal");
  }

  // La sucursal es una preferencia, no una credencial. En el piloto HTTP local/LAN
  // el atributo Secure impediría conservarla; en HTTPS sí se exige.
  const origin = (await headers()).get("origin");
  (await cookies()).set(BRANCH_COOKIE, parsed.data.branchId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !origin?.startsWith("http://"),
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // preferencia; se revalida contra los permisos en cada petición
  });
  // Vuelve a la pantalla desde donde se cambió (solo rutas internas de la consola).
  redirect(safeNextPath(String(formData.get("returnTo") ?? "")));
}
