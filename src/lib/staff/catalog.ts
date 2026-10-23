import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CatalogProduct = { id: string; name: string; category: string; priceCents: number; eligible: boolean; sold30d: number };

const response = z.object({
  ok: z.literal(true),
  products: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      category: z.string(),
      price_cents: z.number().int(),
      eligible: z.boolean(),
      sold_30d: z.number().int(),
    }),
  ),
});

/**
 * Catálogo activo para la barra, ordenado por popularidad (elegibles primero).
 * Los precios mostrados son informativos; el servidor usa los suyos al acreditar.
 */
export async function getActiveCatalog(businessId: string): Promise<CatalogProduct[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("staff_catalog", { p_business_id: businessId });
  if (error) throw new Error(`No se pudo leer el catálogo (${error.code ?? "sin código"})`);
  const parsed = response.safeParse(data);
  if (!parsed.success) return [];
  return parsed.data.products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    priceCents: p.price_cents,
    eligible: p.eligible,
    sold30d: p.sold_30d,
  }));
}
