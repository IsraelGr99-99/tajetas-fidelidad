"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CONSOLE_HOME, LOGIN_PATH } from "@/domain/staff/routes";
import { BRANCH_COOKIE, getStaffSession } from "@/lib/staff/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Cierra la sesión en Supabase (revoca el refresh token) y limpia la sucursal elegida. */
export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut({ scope: "local" });
  (await cookies()).delete(BRANCH_COOKIE);
  redirect(`${LOGIN_PATH}?salida=1`);
}

const selectBranchSchema = z.object({ branchId: z.uuid() });

/**
 * Guarda la sucursal elegida. Las Server Actions son accesibles por POST directo,
 * así que se revalida la identidad y que la sucursal pertenezca al usuario.
 */
export async function selectBranchAction(formData: FormData) {
  const parsed = selectBranchSchema.safeParse({ branchId: formData.get("branchId") });
  const session = await getStaffSession();
  if (session.status !== "staff") redirect(LOGIN_PATH);
  if (!parsed.success || !session.membership.branches.some((b) => b.id === parsed.data.branchId)) {
    redirect(`${CONSOLE_HOME}/sucursal?error=sucursal`);
  }

  (await cookies()).set(BRANCH_COOKIE, parsed.data.branchId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/personal",
    maxAge: 60 * 60 * 12, // un turno
  });
  redirect(CONSOLE_HOME);
}
