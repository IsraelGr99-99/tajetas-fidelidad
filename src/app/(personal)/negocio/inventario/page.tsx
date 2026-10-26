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

export default async function InventoryPage() {
  const { membership } = await requireCapability("manage_staff");
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <p>Inventario no configurado: conecta Supabase.</p>;
  const { data, error } = await supabase.rpc("inventory_overview", { p_business_id: membership.business_id });
  if (error) return <p>Inventario no disponible. Aplica la migración de caja e inventario y vuelve a intentar.</p>;
  const parsed = dataSchema.safeParse(data);
  if (!parsed.success) return <p>No se pudo leer el inventario.</p>;
  return <InventoryManager businessId={membership.business_id} branches={membership.branches} data={parsed.data} />;
}
