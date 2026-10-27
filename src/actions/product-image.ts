"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffSession } from "@/lib/staff/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ImageState = { ok: boolean; message: string; imageUrl?: string | null; requiresVerification?: boolean };
const bucket = "product-photos";
const maxBytes = 2 * 1024 * 1024;

function imageType(bytes: Uint8Array): { contentType: string; extension: string } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { contentType: "image/jpeg", extension: "jpg" };
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return { contentType: "image/png", extension: "png" };
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return { contentType: "image/webp", extension: "webp" };
  return null;
}

async function context(productId: string) {
  const session = await getStaffSession();
  if (session.status !== "staff" || !["owner", "admin"].includes(session.membership.role)) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data: product, error } = await supabase.from("products").select("id,business_id,image_path").eq("id", productId).single();
  if (error || !product || product.business_id !== session.membership.business_id) return null;
  return { supabase, product, businessId: session.membership.business_id, mfaPending: session.membership.mfa_pending };
}

export async function uploadProductImage(formData: FormData): Promise<ImageState> {
  const parsedId = z.uuid().safeParse(formData.get("productId"));
  const file = formData.get("image");
  if (!parsedId.success || !(file instanceof File) || file.size === 0 || file.size > maxBytes) {
    return { ok: false, message: "Elige una foto JPG, PNG o WebP de hasta 2 MB." };
  }
  const ctx = await context(parsedId.data);
  if (!ctx) return { ok: false, message: "No tienes acceso a este producto." };
  if (ctx.mfaPending) return { ok: false, message: "Confirma tu identidad en dos pasos antes de subir la foto.", requiresVerification: true };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = imageType(bytes);
  if (!type || file.type !== type.contentType) return { ok: false, message: "El archivo no es una imagen JPG, PNG o WebP válida." };
  const path = `${ctx.businessId}/${parsedId.data}/${randomUUID()}.${type.extension}`;
  const { error: uploadError } = await ctx.supabase.storage.from(bucket).upload(path, bytes, { contentType: type.contentType, cacheControl: "31536000", upsert: false });
  if (uploadError) {
    const status = Number(uploadError.statusCode);
    const detail = uploadError.message.toLowerCase();
    const message = status === 403 || detail.includes("row-level security") || detail.includes("not authorized")
      ? "Storage rechazó la foto por la política del bucket. La cuenta ya pasó la verificación; comprueba que la migración de corrección de rutas esté aplicada."
      : status === 404 || detail.includes("bucket not found")
        ? "No existe el espacio de fotos en Storage. Avisa al administrador."
        : status === 413
          ? "La foto excede el tamaño permitido de 2 MB."
          : "Storage no pudo guardar la foto. Intenta de nuevo; si continúa, avisa al administrador.";
    return { ok: false, message };
  }
  const { data, error } = await ctx.supabase.rpc("set_product_image_path", { p_product_id: parsedId.data, p_image_path: path });
  if (error || !data?.ok) {
    await ctx.supabase.storage.from(bucket).remove([path]);
    return { ok: false, message: "No se pudo asociar la foto al producto. Intenta de nuevo." };
  }
  if (data.previous_path && data.previous_path !== path) await ctx.supabase.storage.from(bucket).remove([data.previous_path]);
  revalidatePath("/negocio/catalogo");
  revalidatePath("/caja");
  return { ok: true, message: "Foto guardada. Ya aparece en caja.", imageUrl: ctx.supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl };
}

async function removeProductImage(formData: FormData): Promise<ImageState> {
  const parsedId = z.uuid().safeParse(formData.get("productId"));
  if (!parsedId.success) return { ok: false, message: "Producto inválido." };
  const ctx = await context(parsedId.data);
  if (!ctx) return { ok: false, message: "No tienes acceso a este producto." };
  if (ctx.mfaPending) return { ok: false, message: "Confirma tu identidad en dos pasos antes de quitar la foto.", requiresVerification: true };
  const { data, error } = await ctx.supabase.rpc("set_product_image_path", { p_product_id: parsedId.data, p_image_path: null });
  if (error || !data?.ok) return { ok: false, message: "No se pudo quitar la foto." };
  if (data.previous_path) await ctx.supabase.storage.from(bucket).remove([data.previous_path]);
  revalidatePath("/negocio/catalogo");
  revalidatePath("/caja");
  return { ok: true, message: "Foto retirada.", imageUrl: null };
}

export async function updateProductImage(_previous: ImageState, formData: FormData): Promise<ImageState> {
  return formData.get("intent") === "remove" ? removeProductImage(formData) : uploadProductImage(formData);
}
