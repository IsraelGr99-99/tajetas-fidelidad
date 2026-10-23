import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { type Capability, type Membership, can, resolveActiveBranch, staffContextSchema } from "@/domain/staff/permissions";
import { BRANCH_PICKER_PATH, LOGIN_PATH, NO_ACCESS_PATH } from "@/domain/staff/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Cookie con la sucursal elegida. No es una credencial: el servidor la valida contra los permisos. */
export const BRANCH_COOKIE = "cn_sucursal";

export type StaffSession =
  | { status: "not_configured" }
  | { status: "anonymous" }
  | { status: "no_access"; userId: string }
  | {
      status: "staff";
      userId: string;
      email: string | null;
      membership: Membership;
      activeBranch: ReturnType<typeof resolveActiveBranch>;
    };

/**
 * Identidad y permisos del usuario actual, una vez por petición.
 * Identidad: JWT verificado con `getClaims()`. Permisos: `get_staff_context()` en la base.
 */
export const getStaffSession = cache(async (): Promise<StaffSession> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "not_configured" };

  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) return { status: "anonymous" };

  const fetchContext = async () => {
    const { data, error } = await supabase.rpc("get_staff_context");
    if (error) throw new Error(`get_staff_context falló (${error.code ?? "sin código"})`);
    return staffContextSchema.parse(data);
  };
  let context = await fetchContext();
  if (!context.ok) return { status: "anonymous" };

  // Primer ingreso de alguien invitado: acepta sus invitaciones (correo verificado) y recarga.
  if (context.memberships.length === 0) {
    const { data: claim } = await supabase.rpc("claim_staff_invitations");
    if (claim?.ok && Number(claim.claimed) > 0) context = await fetchContext();
    if (!context.ok) return { status: "anonymous" };
  }

  // Piloto: una empresa por persona. Multiempresa en la UI queda para después; el backend ya lo soporta.
  const membership = context.memberships[0];
  if (!membership) return { status: "no_access", userId: claims.sub };

  const cookieStore = await cookies();
  return {
    status: "staff",
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    membership,
    activeBranch: resolveActiveBranch(membership, cookieStore.get(BRANCH_COOKIE)?.value),
  };
});

type StaffOnly = Extract<StaffSession, { status: "staff" }>;

/** Exige personal autenticado; redirige a login o a “sin acceso”. */
export async function requireStaff(): Promise<StaffOnly> {
  const session = await getStaffSession();
  if (session.status === "not_configured" || session.status === "anonymous") redirect(LOGIN_PATH);
  if (session.status === "no_access") redirect(NO_ACCESS_PATH);
  return session;
}

/** Exige personal con sucursal activa elegida. */
export async function requireStaffWithBranch() {
  const session = await requireStaff();
  if (!session.activeBranch) redirect(BRANCH_PICKER_PATH);
  return { ...session, activeBranch: session.activeBranch };
}

/** Exige una capacidad; si falta, muestra “sin acceso” en vez de la página. */
export async function requireCapability(capability: Capability) {
  const session = await requireStaff();
  if (!can(session.membership.role, capability)) redirect(NO_ACCESS_PATH);
  return session;
}
