"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffSession } from "@/lib/staff/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CheckoutResult = { ok: boolean; message: string; saleId?: string; totalCents?: number };
const unavailable = { ok: false, message: "La caja no está configurada o no tienes acceso." };
const failed = { ok: false, message: "No se pudo completar la operación. Intenta de nuevo." };

async function context(admin = false) {
  const session = await getStaffSession();
  if (session.status !== "staff" || (admin && !["owner", "admin"].includes(session.membership.role))) return null;
  const supabase = await createSupabaseServerClient();
  return supabase ? { session, supabase } : null;
}

const saleInput = z.object({
  branchId: z.uuid(),
  key: z.uuid(),
  paymentMethod: z.enum(["cash", "card_manual", "transfer_manual"]),
  lines: z.array(z.object({ product_id: z.uuid(), quantity: z.number().int().min(1).max(100) })).min(1).max(50),
});

export async function recordSaleAction(input: unknown): Promise<CheckoutResult> {
  const parsed = saleInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Revisa los productos y cantidades." };
  const ctx = await context();
  if (!ctx || ctx.session.activeBranch?.id !== parsed.data.branchId) return unavailable;
  const { data, error } = await ctx.supabase.rpc("record_pos_sale", {
    p_branch_id: parsed.data.branchId,
    p_idempotency_key: parsed.data.key,
    p_payment_method: parsed.data.paymentMethod,
    p_lines: parsed.data.lines,
  });
  if (error) return failed;
  if (!data?.ok) {
    const messages: Record<string, string> = {
      insufficient_stock: "No hay existencias suficientes. Actualiza el inventario antes de cobrar.",
      product_unavailable: "Un producto está inactivo o no tiene receta configurada.",
      duplicate_product: "Un producto aparece dos veces en el carrito.",
      forbidden: "No tienes permiso para operar esta sucursal.",
    };
    return { ok: false, message: messages[data?.code] ?? "No se pudo registrar la venta. Revisa el carrito." };
  }
  revalidatePath("/caja");
  revalidatePath("/negocio/inventario");
  revalidatePath("/negocio/ventas");
  return { ok: true, message: data.replayed ? "Esta venta ya estaba registrada; no se cobró dos veces." : "Venta registrada. Verifica el cobro físico o externo.",
    saleId: data.sale_id, totalCents: data.total_cents };
}

const itemInput = z.object({ businessId: z.uuid(), name: z.string().trim().min(2).max(100), unit: z.enum(["pieza", "g", "kg", "ml", "l"]) });
export async function upsertStockItemAction(input: unknown): Promise<CheckoutResult> {
  const parsed = itemInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Revisa el nombre y la unidad del insumo." };
  const ctx = await context(true);
  if (!ctx || ctx.session.membership.business_id !== parsed.data.businessId) return unavailable;
  const { data, error } = await ctx.supabase.rpc("upsert_stock_item", {
    p_business_id: parsed.data.businessId, p_name: parsed.data.name, p_unit: parsed.data.unit,
  });
  if (error || !data?.ok) return failed;
  revalidatePath("/negocio/inventario");
  return { ok: true, message: "Insumo guardado." };
}

const maxThreeDecimals = (n: number) => Math.abs(Math.round(n * 1000) - n * 1000) < 1e-7;
const recipeInput = z.object({ businessId: z.uuid(), productId: z.uuid(), components: z.array(z.object({ item_id: z.uuid(), quantity: z.number().positive().max(100000).refine(maxThreeDecimals) })).min(1).max(30) });
export async function setRecipeAction(input: unknown): Promise<CheckoutResult> {
  const parsed = recipeInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Revisa los componentes de la receta." };
  const ctx = await context(true);
  if (!ctx || ctx.session.membership.business_id !== parsed.data.businessId) return unavailable;
  const { data, error } = await ctx.supabase.rpc("set_product_recipe", {
    p_business_id: parsed.data.businessId, p_product_id: parsed.data.productId, p_components: parsed.data.components,
  });
  if (error || !data?.ok) return failed;
  revalidatePath("/negocio/inventario");
  revalidatePath("/caja");
  return { ok: true, message: "Receta guardada. Reemplaza la configuración anterior." };
}

const adjustInput = z.object({ branchId: z.uuid(), itemId: z.uuid(), delta: z.number().finite().refine((n) => n !== 0 && Math.abs(n) <= 1000000 && maxThreeDecimals(n)), minimum: z.number().nonnegative().max(1000000).refine(maxThreeDecimals), reason: z.string().trim().min(3).max(200) });
export async function adjustStockAction(input: unknown): Promise<CheckoutResult> {
  const parsed = adjustInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Revisa cantidad, mínimo y motivo." };
  const ctx = await context(true);
  if (!ctx || !ctx.session.membership.branches.some((b) => b.id === parsed.data.branchId)) return unavailable;
  const { data, error } = await ctx.supabase.rpc("adjust_stock", {
    p_branch_id: parsed.data.branchId, p_item_id: parsed.data.itemId, p_delta: parsed.data.delta,
    p_minimum: parsed.data.minimum, p_reason: parsed.data.reason,
  });
  if (error) return failed;
  if (!data?.ok) return { ok: false, message: data?.code === "insufficient_stock" ? "El ajuste dejaría existencias negativas." : "No se pudo ajustar el stock." };
  revalidatePath("/negocio/inventario");
  revalidatePath("/caja");
  return { ok: true, message: `Existencia actual: ${data.quantity}` };
}

const stockRows = z.array(z.object({
  name: z.string().trim().min(2).max(100), unit: z.enum(["pieza", "g", "kg", "ml", "l"]),
  quantity: z.number().nonnegative().max(1000000).refine(maxThreeDecimals), minimum: z.number().nonnegative().max(1000000).refine(maxThreeDecimals),
})).min(1).max(500);
export async function importStockCountAction(branchId: string, rows: unknown): Promise<CheckoutResult> {
  const parsed = stockRows.safeParse(rows);
  if (!z.uuid().safeParse(branchId).success || !parsed.success) return { ok: false, message: "El archivo contiene datos inválidos." };
  const ctx = await context(true);
  if (!ctx || !ctx.session.membership.branches.some((b) => b.id === branchId)) return unavailable;
  const { data, error } = await ctx.supabase.rpc("import_stock_count", { p_branch_id: branchId, p_rows: parsed.data });
  if (error) return failed;
  if (!data?.ok) return { ok: false, message: data?.code === "duplicate_item" ? "El archivo repite un insumo." : "Revisa las unidades, cantidades y nombres del archivo." };
  revalidatePath("/negocio/inventario"); revalidatePath("/caja");
  return { ok: true, message: `${data.rows} existencias actualizadas para la sucursal.` };
}
