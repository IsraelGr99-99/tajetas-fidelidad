"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { demoBusinessSchema, toBusinessSlug } from "@/domain/business/onboarding";
import { isValidBusinessSlug } from "@/domain/customer/business-route";
import { BRANCH_COOKIE, BUSINESS_COOKIE, requireStaff } from "@/lib/staff/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CreateBusinessState = { error: string | null };

export async function createDemoBusinessAction(_previous: CreateBusinessState, formData: FormData): Promise<CreateBusinessState> {
  const session = await requireStaff();
  if (session.membership.role !== "owner") return { error: "Solo la persona propietaria puede crear otro espacio de prueba." };
  const parsed = demoBusinessSchema.safeParse({
    name: formData.get("name"), branchName: formData.get("branchName"), slug: formData.get("slug"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  const slug = parsed.data.slug || toBusinessSlug(parsed.data.name);
  if (!isValidBusinessSlug(slug)) return { error: "Escribe una URL corta con letras minúsculas, números y guiones." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "La base de datos no está configurada." };
  const { data, error } = await supabase.rpc("create_demo_business", {
    p_slug: slug, p_name: parsed.data.name, p_branch_name: parsed.data.branchName,
  });
  if (error) return { error: "No se pudo crear el negocio. Comprueba que la migración multiempresa esté aplicada." };
  if (!data?.ok) {
    const messages: Record<string, string> = {
      mfa_required: "Confirma tu identidad con la verificación en dos pasos antes de crear otro negocio.",
      email_unverified: "Primero verifica tu correo de acceso.",
      forbidden: "Solo una cuenta propietaria activa puede crear otro negocio.",
      slug_taken: "Esa URL ya está en uso. Escribe otra URL para este negocio.",
      demo_limit: "Llegaste al límite de tres negocios de demostración.",
      rate_limited: "Espera antes de intentar crear otro negocio.",
      invalid_request: "Revisa el nombre, la sucursal y la URL.",
    };
    return { error: messages[data?.code] ?? "No se pudo crear el negocio." };
  }
  const origin = (await headers()).get("origin");
  const cookieStore = await cookies();
  cookieStore.set(BUSINESS_COOKIE, String(data.business_id), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && !origin?.startsWith("http://"),
    path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  cookieStore.delete(BRANCH_COOKIE);
  redirect("/inicio?nuevo=1");
}
