import "server-only";
import { cache } from "react";
import { type MyCard, myCardSchema } from "@/domain/customer/card";
import { isValidBusinessSlug } from "@/domain/customer/business-route";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CustomerSession =
  | { status: "not_configured" }
  | { status: "anonymous" }
  | { status: "not_enrolled"; contact: string | null }
  | { status: "disabled"; contact: string | null }
  | { status: "enrolled"; card: MyCard };

/** Sesión del cliente (JWT verificado) y su tarjeta desde `get_my_card()`, una vez por petición. */
export const getCustomerSession = cache(async (businessSlug: string): Promise<CustomerSession> => {
  if (!isValidBusinessSlug(businessSlug)) return { status: "not_enrolled", contact: null };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "not_configured" };

  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) return { status: "anonymous" };

  const { data, error } = await supabase.rpc("get_my_card", { p_business_slug: businessSlug });
  if (error) throw new Error(`get_my_card falló (${error.code ?? "sin código"})`);
  const parsed = myCardSchema.parse(data);
  if (parsed.ok) return { status: "enrolled", card: parsed };
  if (parsed.code === "not_authenticated") return { status: "anonymous" };

  const contact =
    typeof claims.email === "string" && claims.email
      ? claims.email
      : typeof claims.phone === "string" && claims.phone
        ? `+${claims.phone.replace(/^\+/, "")}`
        : null;
  if (parsed.code === "not_enrolled") {
    const account = await supabase.rpc("get_my_account_status", { p_business_slug: businessSlug });
    if (!account.error && account.data?.status === "disabled") return { status: "disabled", contact };
  }
  return { status: "not_enrolled", contact };
});
