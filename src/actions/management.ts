"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { campaignRulesSchema } from "@/domain/loyalty/campaign";
import { rpcErrorMessage } from "@/domain/loyalty/messages";
import { type Capability, STAFF_ROLES, can } from "@/domain/staff/permissions";
import { getStaffSession } from "@/lib/staff/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncWalletAfterResponse } from "@/lib/wallet/sync";

/**
 * Acciones de gerencia y administración. Cada una revalida identidad y capacidad
 * (las Server Actions aceptan POST directo) y la base vuelve a validar el permiso
 * sobre el objeto concreto. La empresa siempre sale de la sesión, nunca del formulario.
 */

export type ActionState = { ok: boolean; message: string | null; fieldErrors?: Record<string, string> };
const idle: ActionState = { ok: false, message: null };
export async function initialState(): Promise<ActionState> {
  return idle;
}

async function context(capability: Capability) {
  const session = await getStaffSession();
  if (session.status !== "staff") return { error: rpcErrorMessage("not_authenticated") };
  if (!can(session.membership.role, capability)) return { error: rpcErrorMessage("forbidden") };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "El servicio no está configurado." };
  return { session, supabase, businessId: session.membership.business_id };
}

function fromZod(error: z.ZodError): ActionState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return { ok: false, message: "Revisa los campos marcados.", fieldErrors };
}

async function run(rpc: PromiseLike<{ data: unknown; error: unknown }>, success: string, paths: string[]): Promise<ActionState> {
  const { data, error } = await rpc;
  if (error) return { ok: false, message: "No se pudo contactar al servidor. Intenta de nuevo." };
  const result = data as { ok?: boolean; code?: string; card_id?: string } | null;
  if (!result?.ok) return { ok: false, message: rpcErrorMessage(result?.code) };
  // Reversos y ajustes cambian la tarjeta: actualizar su pase de Wallet en segundo plano.
  syncWalletAfterResponse(result.card_id);
  for (const p of paths) revalidatePath(p);
  return { ok: true, message: success };
}

const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
const optionalUuid = z.preprocess((v) => (v === "" || v == null ? null : v), z.uuid().nullable());
const idemKey = z.string().regex(/^[A-Za-z0-9:_-]{8,100}$/, "Recarga la página e inténtalo de nuevo.");

// ---------------------------------------------------------------------
// Reversos (gerencia)
// ---------------------------------------------------------------------
const reverseSchema = z.object({
  eventId: z.uuid(),
  reason: z.string().trim().min(5, "Explica el motivo (mínimo 5 caracteres).").max(300),
  purchaseStatus: z.enum(["voided", "refunded"]),
  idempotencyKey: idemKey,
});

export async function reverseEventAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = reverseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZod(parsed.error);
  const ctx = await context("reverse");
  if ("error" in ctx) return { ok: false, message: ctx.error ?? null };
  return run(
    ctx.supabase.rpc("reverse_ledger_event", {
      p_event_id: parsed.data.eventId,
      p_reason: parsed.data.reason,
      p_idempotency_key: parsed.data.idempotencyKey,
      p_purchase_status: parsed.data.purchaseStatus,
    }),
    "Movimiento revertido. Quedó registrado con tu nombre y el motivo.",
    ["/movimientos"],
  );
}

// ---------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------
const productSchema = z.object({
  productId: optionalUuid,
  name: z.string().trim().min(2, "Mínimo 2 caracteres.").max(80),
  category: z.string().trim().min(2, "Mínimo 2 caracteres.").max(40),
  price: z
    .string()
    .trim()
    .regex(/^\d{1,5}(\.\d{1,2})?$/, "Precio en pesos, por ejemplo 65 o 65.50.")
    .transform((v) => Math.round(Number(v) * 100)),
  cost: z
    .string()
    .trim()
    .regex(/^(\d{1,5}(\.\d{1,2})?)?$/, "Costo en pesos, por ejemplo 14.50 (o vacío).")
    .transform((v) => (v === "" ? null : Math.round(Number(v) * 100))),
  eligible: checkbox,
  active: checkbox,
});

export async function upsertProductAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZod(parsed.error);
  const ctx = await context("manage_campaigns");
  if ("error" in ctx) return { ok: false, message: ctx.error ?? null };
  const d = parsed.data;
  const saved = await run(
    ctx.supabase.rpc("upsert_product", {
      p_business_id: ctx.businessId,
      p_product_id: d.productId,
      p_name: d.name,
      p_category: d.category,
      p_price_cents: d.price,
      p_eligible: d.eligible,
      p_active: d.active,
    }),
    d.productId ? "Producto actualizado." : "Producto agregado.",
    ["/negocio/catalogo", "/barra"],
  );
  if (!saved.ok) return saved;
  // El costo es interno (solo administración); se guarda aparte para no exponerlo al personal.
  const productId =
    d.productId ??
    (await ctx.supabase.rpc("admin_catalog", { p_business_id: ctx.businessId })).data?.products?.find(
      (p: { name: string }) => p.name.toLowerCase() === d.name.toLowerCase(),
    )?.id;
  if (productId) await ctx.supabase.rpc("set_product_cost", { p_business_id: ctx.businessId, p_product_id: productId, p_cost_cents: d.cost });
  return saved;
}

// ---------------------------------------------------------------------
// Sucursales
// ---------------------------------------------------------------------
const branchSchema = z.object({
  branchId: optionalUuid,
  name: z.string().trim().min(2, "Mínimo 2 caracteres.").max(120),
  address: z.string().trim().max(240).optional(),
  active: checkbox,
});

function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function upsertBranchAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = branchSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZod(parsed.error);
  const ctx = await context("manage_staff");
  if ("error" in ctx) return { ok: false, message: ctx.error ?? null };
  const d = parsed.data;
  return run(
    ctx.supabase.rpc("upsert_branch", {
      p_business_id: ctx.businessId,
      p_branch_id: d.branchId,
      p_slug: slugify(d.name) || "sucursal",
      p_name: d.name,
      p_address: d.address ?? null,
      p_active: d.active,
    }),
    d.branchId ? "Sucursal actualizada." : "Sucursal creada.",
    ["/negocio/equipo", "/cuenta"],
  );
}

// ---------------------------------------------------------------------
// Campaña (nueva versión inmutable)
// ---------------------------------------------------------------------
const campaignFormSchema = z.object({
  campaignId: z.uuid(),
  name: z.string(),
  rewardDescription: z.string(),
  stampsRequired: z.coerce.number(),
  stampsPerPurchase: z.coerce.number(),
  capKind: z.enum(["min_eligible_item_in_completing_ticket", "fixed"]),
  capMax: z.string().trim().optional(),
  minMinutesBetweenEarns: z.coerce.number(),
  maxEarnsPerDay: z.coerce.number(),
  reason: z.string().trim().min(5, "Explica por qué cambia la regla (mínimo 5 caracteres).").max(300),
});

export async function publishCampaignAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const form = campaignFormSchema.safeParse(Object.fromEntries(formData));
  if (!form.success) return fromZod(form.error);
  const f = form.data;
  const capMaxCents = f.capMax ? Math.round(Number(f.capMax) * 100) : null;
  if (f.capMax && (!Number.isFinite(capMaxCents) || (capMaxCents ?? 0) <= 0)) {
    return { ok: false, message: "Revisa los campos marcados.", fieldErrors: { capMax: "Monto en pesos mayor a 0." } };
  }
  const rules = campaignRulesSchema.safeParse({
    name: f.name,
    rewardDescription: f.rewardDescription,
    stampsRequired: f.stampsRequired,
    stampsPerPurchase: f.stampsPerPurchase,
    rewardCap: f.capKind === "fixed" ? { kind: "fixed", maxCents: capMaxCents } : { kind: f.capKind, maxCents: capMaxCents },
    minSecondsBetweenEarns: Math.round(f.minMinutesBetweenEarns * 60),
    maxEarnsPerDay: f.maxEarnsPerDay,
  });
  if (!rules.success) return fromZod(rules.error);

  const ctx = await context("manage_campaigns");
  if ("error" in ctx) return { ok: false, message: ctx.error ?? null };
  return run(
    ctx.supabase.rpc("publish_campaign_version", { p_campaign_id: f.campaignId, p_rules: rules.data, p_reason: f.reason }),
    "Nueva versión publicada. Las tarjetas conservan sus sellos; las recompensas ya emitidas mantienen su tope.",
    ["/negocio/programa", "/tarjeta"],
  );
}

// ---------------------------------------------------------------------
// Personal
// ---------------------------------------------------------------------
function branchIds(formData: FormData) {
  return formData.getAll("branchIds").map(String);
}

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Correo inválido.")),
  displayName: z.string().trim().min(1, "Escribe su nombre.").max(80),
  role: z.enum(STAFF_ROLES),
  branchIds: z.array(z.uuid()).max(50),
});

export async function inviteStaffAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = inviteSchema.safeParse({ ...Object.fromEntries(formData), branchIds: branchIds(formData) });
  if (!parsed.success) return fromZod(parsed.error);
  const ctx = await context("manage_staff");
  if ("error" in ctx) return { ok: false, message: ctx.error ?? null };
  const d = parsed.data;
  return run(
    ctx.supabase.rpc("invite_staff", {
      p_business_id: ctx.businessId,
      p_email: d.email,
      p_display_name: d.displayName,
      p_role: d.role,
      p_branch_ids: d.branchIds,
    }),
    `Invitación creada. Pide a ${d.displayName} que entre en /entrar con “código por correo” usando ${d.email}.`,
    ["/negocio/equipo"],
  );
}

export async function revokeInvitationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = z.uuid().safeParse(formData.get("invitationId"));
  if (!id.success) return { ok: false, message: "Solicitud inválida." };
  const ctx = await context("manage_staff");
  if ("error" in ctx) return { ok: false, message: ctx.error ?? null };
  return run(ctx.supabase.rpc("revoke_staff_invitation", { p_invitation_id: id.data }), "Invitación revocada.", ["/negocio/equipo"]);
}

const updateStaffSchema = z.object({
  staffMemberId: z.uuid(),
  role: z.enum(STAFF_ROLES),
  active: checkbox,
  branchIds: z.array(z.uuid()).max(50),
});

export async function updateStaffAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = updateStaffSchema.safeParse({ ...Object.fromEntries(formData), branchIds: branchIds(formData) });
  if (!parsed.success) return fromZod(parsed.error);
  const ctx = await context("manage_staff");
  if ("error" in ctx) return { ok: false, message: ctx.error ?? null };
  const d = parsed.data;
  return run(
    ctx.supabase.rpc("update_staff_member", {
      p_staff_member_id: d.staffMemberId,
      p_role: d.role,
      p_active: d.active,
      p_branch_ids: d.branchIds,
    }),
    "Cambios guardados.",
    ["/negocio/equipo"],
  );
}

// ---------------------------------------------------------------------
// Clientes: ajuste manual de sellos
// ---------------------------------------------------------------------
const adjustSchema = z.object({
  cardId: z.uuid(),
  delta: z.coerce
    .number()
    .int("Debe ser un número entero.")
    .min(-50)
    .max(50)
    .refine((v) => v !== 0, "El ajuste no puede ser 0."),
  reason: z.string().trim().min(5, "Explica el motivo (mínimo 5 caracteres).").max(300),
  idempotencyKey: idemKey,
});

export async function adjustStampsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = adjustSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZod(parsed.error);
  const ctx = await context("adjust_stamps");
  if ("error" in ctx) return { ok: false, message: ctx.error ?? null };
  const d = parsed.data;
  return run(
    ctx.supabase.rpc("adjust_stamps", { p_card_id: d.cardId, p_delta: d.delta, p_reason: d.reason, p_idempotency_key: d.idempotencyKey }),
    `Ajuste aplicado (${d.delta > 0 ? "+" : ""}${d.delta} sellos).`,
    ["/negocio/clientes", "/movimientos"],
  );
}

// ---------------------------------------------------------------------
// Clientes: búsqueda exacta (por POST, para no poner PII en la URL)
// ---------------------------------------------------------------------
const customerRow = z.object({
  card_id: z.uuid(),
  card_serial: z.string(),
  display_name: z.string().nullable(),
  contact_masked: z.string().nullable(),
  contact_channel: z.enum(["email", "phone"]),
  stamps_balance: z.number().int(),
  rewards_balance: z.number().int(),
  enrolled_at: z.string(),
  last_earn_at: z.string().nullable(),
});
export type CustomerRow = z.infer<typeof customerRow>;

export async function findCustomersAction(query: string): Promise<{ ok: true; customers: CustomerRow[] } | { ok: false; message: string }> {
  const q = String(query ?? "").trim().slice(0, 254);
  if (q.length < 4) return { ok: false, message: "Escribe el correo completo, el teléfono a 10 dígitos o el serial de la tarjeta." };
  const ctx = await context("view_customers_pii");
  if ("error" in ctx) return { ok: false, message: ctx.error ?? "" };
  const { data, error } = await ctx.supabase.rpc("admin_find_customers", { p_business_id: ctx.businessId, p_query: q });
  if (error) return { ok: false, message: "No se pudo contactar al servidor." };
  if (!data?.ok) return { ok: false, message: rpcErrorMessage(data?.code) };
  return { ok: true, customers: z.array(customerRow).parse(data.customers) };
}
