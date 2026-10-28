import type { Metadata } from "next";
import { z } from "zod";
import { requireCapability } from "@/lib/staff/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InventoryManager } from "./InventoryManager";

export const metadata: Metadata = { title: "Inventario por sucursal" };
const dataSchema = z.object({
  ok: z.literal(true),
  items: z.array(z.object({ id: z.uuid(), name: z.string(), unit: z.string() })),
  balances: z.array(z.object({ branch_id: z.uuid(), item_id: z.uuid(), quantity: z.coerce.number(), minimum: z.coerce.number() })),
  recipes: z.array(z.object({ product_id: z.uuid(), item_id: z.uuid(), quantity: z.coerce.number() })),
  products: z.array(z.object({ id: z.uuid(), name: z.string() })),
});
const catalogSchema = z.object({
  ok: z.literal(true),
  products: z.array(z.object({
    id: z.uuid(), name: z.string(), category: z.string(), price_cents: z.number().int(),
    cost_cents: z.number().int().nullable(), active: z.boolean(),
  })),
});

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ vista?: string; producto?: string }> }) {
  const params = await searchParams;
  const initialView = params.vista === "recetas" || params.producto ? "recipes" : ["gestionar", "ajustar", "importar"].includes(params.vista ?? "") ? "manage" : "stock";
  const initialManageMode = params.vista === "ajustar" ? "adjust" : params.vista === "importar" ? "import" : "create";
  const { membership, activeBranch } = await requireCapability("manage_staff");
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <p>Inventario no configurado: conecta Supabase.</p>;
  const [{ data, error }, catalogResult] = await Promise.all([
    supabase.rpc("inventory_overview", { p_business_id: membership.business_id }),
    supabase.rpc("admin_catalog", { p_business_id: membership.business_id }),
  ]);
  if (error) return <p>Inventario no disponible. Aplica la migración de caja e inventario y vuelve a intentar.</p>;
  const parsed = dataSchema.safeParse(data);
  if (!parsed.success) return <p>No se pudo leer el inventario.</p>;
  const catalog = catalogSchema.safeParse(catalogResult.data);
  const requestedProduct = z.uuid().safeParse(params.producto);
  const initialProductId = requestedProduct.success && parsed.data.products.some((product) => product.id === requestedProduct.data)
    ? requestedProduct.data : null;
  return <InventoryManager key={`${params.vista ?? "stock"}:${initialProductId ?? ""}`} businessId={membership.business_id} branches={membership.branches} initialBranchId={activeBranch?.id ?? null} initialView={initialView} initialManageMode={initialManageMode} initialProductId={initialProductId} data={parsed.data} catalog={catalog.success ? catalog.data.products : null} />;
}
