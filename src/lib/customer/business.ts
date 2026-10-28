import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { DEFAULT_CARD_THEME, type CardTheme } from "@/domain/loyalty/branding";
import { isValidBusinessSlug } from "@/domain/customer/business-route";
import { PILOT_BUSINESS_SLUG } from "@/lib/business";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const getCustomerBusiness = cache(async (slug: string): Promise<CardTheme> => {
  if (!isValidBusinessSlug(slug)) notFound();
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    if (slug !== PILOT_BUSINESS_SLUG) notFound();
    return DEFAULT_CARD_THEME;
  }
  const { data, error } = await supabase.from("businesses")
    .select("name,card_background_color,card_secondary_color,card_text_color,card_logo_path")
    .eq("slug", slug).maybeSingle();
  if (error || !data) {
    // El piloto conserva su acceso durante una caída temporal de la consulta
    // pública; el formulario de autenticación comunica su propio error.
    if (slug === PILOT_BUSINESS_SLUG) return DEFAULT_CARD_THEME;
    notFound();
  }
  return {
    businessName: data.name,
    background: data.card_background_color ?? DEFAULT_CARD_THEME.background,
    secondary: data.card_secondary_color ?? DEFAULT_CARD_THEME.secondary,
    text: data.card_text_color ?? DEFAULT_CARD_THEME.text,
    logoUrl: data.card_logo_path ? supabase.storage.from("business-logos").getPublicUrl(data.card_logo_path).data.publicUrl : null,
  };
});
