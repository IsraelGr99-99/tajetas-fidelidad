import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import { NO_ACCESS_PATH } from "@/domain/staff/routes";
import { requireStaffWithBranch } from "@/lib/staff/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Checkout } from "./Checkout";

export const metadata: Metadata = { title: "Caja" };
const catalogSchema = z.object({ ok: z.literal(true), products: z.array(z.object({
  id: z.uuid(), name: z.string(), category: z.string().default("Productos"), price_cents: z.number().int(), available: z.number().int(),
  image_path: z.string().nullable().optional(), recipe_configured: z.boolean().optional(),
  missing_ingredients: z.array(z.object({ name: z.string(), unit: z.string(), needed: z.coerce.number(), in_stock: z.coerce.number() })).optional(),
})) });

export default async function CheckoutPage() {
  const { membership, activeBranch } = await requireStaffWithBranch();
  if (!["owner", "admin", "manager", "barista"].includes(membership.role)) redirect(NO_ACCESS_PATH);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <p>Caja no configurada: conecta Supabase.</p>;
  const { data, error } = await supabase.rpc("pos_catalog", { p_branch_id: activeBranch.id });
  if (error) return <p>Caja no disponible. Aplica la migración de caja e inventario.</p>;
  const parsed = catalogSchema.safeParse(data);
  if (!parsed.success) return <p>No se pudo leer el catálogo de caja.</p>;
  const products = parsed.data.products.map((product) => ({ ...product,
    imageUrl: product.image_path ? supabase.storage.from("product-photos").getPublicUrl(product.image_path).data.publicUrl : null,
    recipeConfigured: product.recipe_configured ?? false,
    missingIngredients: product.missing_ingredients ?? [],
  }));
  return <Checkout branchId={activeBranch.id} branchName={activeBranch.name} products={products} />;
}
