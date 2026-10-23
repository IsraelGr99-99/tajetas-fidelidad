import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CatalogProduct = { id: string; name: string; category: string; priceCents: number; eligible: boolean };

const row = z.object({
  id: z.uuid(),
  name: z.string(),
  category: z.string(),
  price_cents: z.number().int(),
  eligible_for_stamp: z.boolean(),
});

/** Catálogo activo de la empresa (RLS: solo personal). Los precios mostrados son informativos; el servidor usa los suyos. */
export async function getActiveCatalog(businessId: string): Promise<CatalogProduct[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("products")
    .select("id, name, category, price_cents, eligible_for_stamp")
    .eq("business_id", businessId)
    .eq("active", true)
    .order("category")
    .order("name");
  if (error) throw new Error(`No se pudo leer el catálogo (${error.code ?? "sin código"})`);
  return z.array(row).parse(data).map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    priceCents: p.price_cents,
    eligible: p.eligible_for_stamp,
  }));
}
