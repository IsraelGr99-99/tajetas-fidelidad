import type { Metadata } from "next";
import { Notice } from "@/components/staff/OperationParts";
import { DEFAULT_CARD_THEME } from "@/domain/loyalty/branding";
import { formatDateTime, formatMxn } from "@/lib/format";
import { requireCapability } from "@/lib/staff/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CampaignForm } from "./CampaignForm";
import { CardThemeForm } from "./CardThemeForm";

export const metadata: Metadata = { title: "Campaña" };

type Version = {
  id: string;
  campaign_id: string;
  version: number;
  name: string;
  reward_description: string;
  stamps_required: number;
  stamps_per_purchase: number;
  reward_cap_kind: "min_eligible_item_in_completing_ticket" | "fixed";
  reward_cap_max_cents: number | null;
  min_seconds_between_earns: number;
  max_earns_per_day: number;
  effective_from: string;
  change_reason: string | null;
};

export default async function CampaignPage() {
  const { membership } = await requireCapability("manage_campaigns");
  const supabase = await createSupabaseServerClient();
  const themeResult = await supabase?.from("businesses").select("name,card_background_color,card_secondary_color,card_text_color,card_logo_path").eq("id", membership.business_id).single();
  const themeRow = themeResult?.data;
  const theme = themeRow ? {
    businessName: themeRow.name,
    background: themeRow.card_background_color,
    secondary: themeRow.card_secondary_color,
    text: themeRow.card_text_color,
    logoUrl: themeRow.card_logo_path && supabase ? supabase.storage.from("business-logos").getPublicUrl(themeRow.card_logo_path).data.publicUrl : null,
  } : { ...DEFAULT_CARD_THEME, businessName: membership.business_name };
  const campaign = await supabase?.from("campaigns").select("id, name").eq("business_id", membership.business_id).eq("is_active", true).maybeSingle();
  const versions = campaign?.data
    ? await supabase
        ?.from("campaign_versions")
        .select(
          "id, campaign_id, version, name, reward_description, stamps_required, stamps_per_purchase, reward_cap_kind, reward_cap_max_cents, min_seconds_between_earns, max_earns_per_day, effective_from, change_reason",
        )
        .eq("campaign_id", campaign.data.id)
        .order("version", { ascending: false })
    : null;
  const list = (versions?.data ?? []) as Version[];
  const current = list[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl text-tabaco">Campaña</h1>
        <p className="mt-2 max-w-2xl leading-7 text-tabaco/75">
          Cada cambio crea una versión nueva; las anteriores no se modifican. Los sellos acumulados se conservan y las recompensas ya ganadas
          mantienen el tope con el que se emitieron.
        </p>
      </div>

      {themeResult?.error ? <Notice tone="error" title="El diseño de tarjeta aún no está disponible. Aplica la migración de identidad visual." /> : <CardThemeForm key={themeRow?.card_logo_path ?? "no-logo"} initial={theme} />}

      {!current ? (
        <Notice tone="error" title="No hay una campaña activa configurada." />
      ) : (
        <>
          <section aria-labelledby="vigente" className="rounded-3xl bg-tabaco p-6 text-crema">
            <p className="bitacora text-mostaza">Versión {current.version} · vigente</p>
            <h2 id="vigente" className="mt-2 text-3xl">
              {current.name}
            </h2>
            <p className="mt-2 leading-7 text-crema/85">
              {current.stamps_required} compras elegibles = {current.reward_description.toLowerCase()}. {current.stamps_per_purchase} sello(s) por
              compra, espera de {Math.round(current.min_seconds_between_earns / 60)} min, máximo {current.max_earns_per_day} al día. Tope:{" "}
              {current.reward_cap_kind === "fixed"
                ? formatMxn(current.reward_cap_max_cents ?? 0)
                : `bebida elegible más barata del ticket${current.reward_cap_max_cents ? `, máximo ${formatMxn(current.reward_cap_max_cents)}` : ""}`}
              .
            </p>
          </section>

          <section aria-labelledby="editar-campana" className="rounded-3xl bg-papel p-6">
            <h2 id="editar-campana" className="text-2xl text-tabaco">
              Cambiar la regla
            </h2>
            <div className="mt-4">
              <CampaignForm
                current={{
                  campaignId: current.campaign_id,
                  name: current.name,
                  rewardDescription: current.reward_description,
                  stampsRequired: current.stamps_required,
                  stampsPerPurchase: current.stamps_per_purchase,
                  capKind: current.reward_cap_kind,
                  capMaxCents: current.reward_cap_max_cents,
                  minSecondsBetweenEarns: current.min_seconds_between_earns,
                  maxEarnsPerDay: current.max_earns_per_day,
                }}
              />
            </div>
          </section>

          <section aria-labelledby="historial-campana">
            <h2 id="historial-campana" className="text-2xl text-tabaco">
              Historial de versiones
            </h2>
            <ol className="mt-4 divide-y divide-tabaco/10 rounded-3xl bg-papel">
              {list.map((v) => (
                <li key={v.id} className="flex flex-wrap justify-between gap-3 p-4 text-sm">
                  <span className="text-tabaco">
                    <strong>v{v.version}</strong> · {v.stamps_required} compras · espera {Math.round(v.min_seconds_between_earns / 60)} min · máx.{" "}
                    {v.max_earns_per_day}/día
                    {v.change_reason ? <span className="block text-tabaco/75">Motivo: {v.change_reason}</span> : null}
                  </span>
                  <time dateTime={v.effective_from} className="text-tabaco/75">
                    {formatDateTime(v.effective_from)}
                  </time>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}
