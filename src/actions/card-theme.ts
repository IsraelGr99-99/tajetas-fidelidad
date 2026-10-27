"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { contrastRatio, isHexColor } from "@/domain/loyalty/branding";
import { getStaffSession } from "@/lib/staff/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CardThemeState = { ok: boolean; message: string };
const bucket = "business-logos";

function imageType(bytes: Uint8Array): { mime: string; extension: string } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", extension: "jpg" };
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value)) return { mime: "image/png", extension: "png" };
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return { mime: "image/webp", extension: "webp" };
  return null;
}

export async function saveCardTheme(_previous: CardThemeState, formData: FormData): Promise<CardThemeState> {
  const session = await getStaffSession();
  if (session.status !== "staff" || !["owner", "admin"].includes(session.membership.role)) {
    return { ok: false, message: "Solo el propietario o administrador puede cambiar la tarjeta." };
  }
  const background = String(formData.get("background") ?? "");
  const secondary = String(formData.get("secondary") ?? "");
  const text = String(formData.get("text") ?? "");
  if (![background, secondary, text].every(isHexColor)) return { ok: false, message: "Elige colores válidos." };
  if (contrastRatio(background, text) < 4.5) return { ok: false, message: "El texto necesita más contraste con el fondo. Elige un color más claro u oscuro." };
  if (contrastRatio(background, secondary) < 3) return { ok: false, message: "El acento debe destacar más sobre el fondo de la tarjeta." };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "No hay conexión con la base de datos." };
  const businessId = session.membership.business_id;
  const { data: business, error: readError } = await supabase.from("businesses").select("card_logo_path").eq("id", businessId).single();
  if (readError || !business) return { ok: false, message: "No se pudo leer el diseño. Verifica que la migración de tarjetas esté aplicada." };

  let logoPath: string | null = formData.get("intent") === "remove-logo" ? null : business.card_logo_path;
  let uploaded: string | null = null;
  const file = formData.get("logo");
  if (file instanceof File && file.size > 0 && formData.get("intent") !== "remove-logo") {
    if (file.size > 2 * 1024 * 1024) return { ok: false, message: "El logo debe pesar menos de 2 MB." };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = imageType(bytes);
    if (!type || file.type !== type.mime) return { ok: false, message: "Usa un logo JPG, PNG o WebP válido." };
    uploaded = `${businessId}/${randomUUID()}.${type.extension}`;
    const { error: uploadError } = await supabase.storage.from(bucket).upload(uploaded, bytes, { contentType: type.mime, upsert: false });
    if (uploadError) return { ok: false, message: "No se pudo subir el logo. Verifica que el bucket de logos esté configurado." };
    logoPath = uploaded;
  }

  const { data, error } = await supabase.rpc("set_business_card_theme", {
    p_business_id: businessId, p_background: background, p_secondary: secondary, p_text: text, p_logo_path: logoPath,
  });
  if (error || !data?.ok) {
    if (uploaded) await supabase.storage.from(bucket).remove([uploaded]);
    return { ok: false, message: "No se pudo guardar el diseño. Verifica la migración y tu verificación en dos pasos." };
  }
  if (data.previous_logo && data.previous_logo !== logoPath) await supabase.storage.from(bucket).remove([data.previous_logo]);
  revalidatePath("/negocio/programa");
  revalidatePath("/tarjeta");
  return { ok: true, message: "Diseño guardado. También se verá en las tarjetas existentes." };
}
