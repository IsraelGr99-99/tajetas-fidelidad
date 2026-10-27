"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { rpcErrorMessage } from "@/domain/loyalty/messages";
import { getStaffSession } from "@/lib/staff/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Importaciones y finanzas (owner/admin). El navegador ya interpretó el archivo;
 * aquí se vuelve a validar cada renglón y la base valida rol y empresa.
 */

export type FinanceResult = { ok: true; message: string } | { ok: false; message: string };

async function adminContext() {
  const session = await getStaffSession();
  if (session.status !== "staff" || !["owner", "admin"].includes(session.membership.role)) return null;
  const supabase = await createSupabaseServerClient();
  return supabase ? { supabase, businessId: session.membership.business_id } : null;
}

const denied: FinanceResult = { ok: false, message: rpcErrorMessage("forbidden") };
const network: FinanceResult = { ok: false, message: "No se pudo contactar al servidor. Intenta de nuevo." };
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function done(data: { ok?: boolean; code?: string } | null, message: string, paths: string[]): FinanceResult {
  if (!data?.ok) {
    const extra: Record<string, string> = {
      invalid_rows: "Algún renglón no es válido. Revisa la vista previa y vuelve a intentar.",
      duplicate_import: "Ese reporte ya se importó para esa sucursal y periodo.",
      demo_exists: "Ya hay datos de demostración. Bórralos antes de generarlos de nuevo.",
      catalog_empty: "Agrega productos con precio al catálogo antes de generar datos de demostración.",
    };
    return { ok: false, message: (data?.code && extra[data.code]) || rpcErrorMessage(data?.code) };
  }
  for (const p of paths) revalidatePath(p);
  return { ok: true, message };
}

// ---------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------
const productRows = z
  .array(
    z.object({
      name: z.string().trim().min(2).max(60),
      variantLabel: z.string().trim().min(1).max(30).nullable(),
      category: z.string().trim().min(2).max(40),
      priceCents: z.number().int().min(0).max(1_000_000),
      costCents: z.number().int().min(0).max(1_000_000).nullable(),
      eligible: z.boolean(),
      active: z.boolean(),
    }),
  )
  .min(1)
  .max(1000);

export async function importProductsAction(rows: unknown): Promise<FinanceResult> {
  const parsed = productRows.safeParse(rows);
  if (!parsed.success) return { ok: false, message: "Los datos del archivo no son válidos." };
  const ctx = await adminContext();
  if (!ctx) return denied;
  const { data, error } = await ctx.supabase.rpc("bulk_upsert_product_variants", {
    p_business_id: ctx.businessId,
    p_rows: parsed.data.map((r) => ({
      name: r.name,
      variant_label: r.variantLabel,
      category: r.category,
      price_cents: r.priceCents,
      cost_cents: r.costCents,
      eligible: r.eligible,
      active: r.active,
    })),
  });
  if (error) return network;
  return done(data, `Listo: ${data?.inserted ?? 0} productos nuevos y ${data?.updated ?? 0} actualizados.`, ["/negocio/catalogo", "/negocio/inventario", "/barra"]);
}

// ---------------------------------------------------------------------
// Ventas del POS
// ---------------------------------------------------------------------
const salesInput = z.object({
  branchId: z.uuid(),
  fileName: z.string().trim().min(1).max(200),
  rows: z
    .array(
      z.object({
        soldOn: date,
        productName: z.string().trim().min(1).max(120),
        category: z.string().trim().max(60).nullable(),
        quantity: z.number().positive().max(100000),
        totalCents: z.number().int().min(0).max(1_000_000_000),
      }),
    )
    .min(1)
    .max(10000),
});

export async function importSalesAction(input: unknown): Promise<FinanceResult> {
  const parsed = salesInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Los datos del archivo no son válidos." };
  const ctx = await adminContext();
  if (!ctx) return denied;
  const { data, error } = await ctx.supabase.rpc("import_sales", {
    p_business_id: ctx.businessId,
    p_branch_id: parsed.data.branchId,
    p_file_name: parsed.data.fileName,
    p_rows: parsed.data.rows.map((r) => ({
      sold_on: r.soldOn,
      product_name: r.productName,
      category: r.category,
      quantity: r.quantity,
      total_cents: r.totalCents,
    })),
  });
  if (error) return network;
  const unmatched = Number(data?.rows ?? 0) - Number(data?.matched ?? 0);
  return done(
    data,
    `Importadas ${data?.rows ?? 0} ventas.${unmatched > 0 ? ` ${unmatched} no coinciden con el catálogo (se guardan sin costo).` : ""}`,
    ["/negocio", "/negocio/finanzas"],
  );
}

export async function deleteSalesImportAction(id: string): Promise<FinanceResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Solicitud inválida." };
  const ctx = await adminContext();
  if (!ctx) return denied;
  const { data, error } = await ctx.supabase.rpc("delete_sales_import", { p_import_id: id });
  if (error) return network;
  return done(data, "Importación eliminada.", ["/negocio", "/negocio/finanzas"]);
}

// ---------------------------------------------------------------------
// Gastos
// ---------------------------------------------------------------------
const expenseRows = z
  .array(
    z.object({
      branchId: z.uuid().nullable(),
      spentOn: date,
      category: z.string().trim().min(2).max(60),
      description: z.string().trim().max(200).nullable(),
      amountCents: z.number().int().positive().max(100_000_000),
    }),
  )
  .min(1)
  .max(2000);

export async function addExpensesAction(rows: unknown): Promise<FinanceResult> {
  const parsed = expenseRows.safeParse(rows);
  if (!parsed.success) return { ok: false, message: "Revisa fecha, categoría y monto." };
  const ctx = await adminContext();
  if (!ctx) return denied;
  const { data, error } = await ctx.supabase.rpc("add_expenses", {
    p_business_id: ctx.businessId,
    p_rows: parsed.data.map((r) => ({
      branch_id: r.branchId,
      spent_on: r.spentOn,
      category: r.category,
      description: r.description,
      amount_cents: r.amountCents,
    })),
  });
  if (error) return network;
  return done(data, data?.inserted === 1 ? "Gasto registrado." : `Registrados ${data?.inserted ?? 0} gastos.`, ["/negocio", "/negocio/finanzas"]);
}

export async function deleteExpenseAction(id: string): Promise<FinanceResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Solicitud inválida." };
  const ctx = await adminContext();
  if (!ctx) return denied;
  const { data, error } = await ctx.supabase.rpc("delete_expense", { p_expense_id: id });
  if (error) return network;
  return done(data, "Gasto eliminado.", ["/negocio", "/negocio/finanzas"]);
}

// ---------------------------------------------------------------------
// Datos de demostración
// ---------------------------------------------------------------------
export async function generateDemoAction(): Promise<FinanceResult> {
  const ctx = await adminContext();
  if (!ctx) return denied;
  const { data, error } = await ctx.supabase.rpc("generate_demo_finance", { p_business_id: ctx.businessId, p_days: 60 });
  if (error) return network;
  return done(data, "Se generaron 60 días de datos DEMO. Puedes borrarlos cuando quieras.", ["/inicio", "/negocio", "/negocio/finanzas"]);
}

export async function clearDemoAction(): Promise<FinanceResult> {
  const ctx = await adminContext();
  if (!ctx) return denied;
  const { data, error } = await ctx.supabase.rpc("clear_demo_finance", { p_business_id: ctx.businessId });
  if (error) return network;
  return done(data, "Datos DEMO eliminados. Los datos reales no se tocaron.", ["/inicio", "/negocio", "/negocio/finanzas"]);
}
