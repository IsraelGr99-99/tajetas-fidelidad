import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CardQr } from "@/components/customer/CardQr";
import { BirthdayOfferPreferences } from "@/components/customer/BirthdayOfferPreferences";
import { AccountControls } from "@/components/customer/DeleteAccount";
import { WalletSection } from "@/components/customer/WalletSection";
import { PassportCard } from "@/components/loyalty/PassportCard";
import { describeHistoryEntry } from "@/domain/customer/card";
import { describeRewardCap } from "@/domain/loyalty/campaign";
import { DEFAULT_CARD_THEME } from "@/domain/loyalty/branding";
import { formatDateTime, formatMxn } from "@/lib/format";
import { getCustomerSession } from "@/lib/customer/session";
import { walletStatusForCard } from "@/lib/wallet/sync";
import { PILOT_BUSINESS_SLUG } from "@/lib/business";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { customerSignOutAction } from "./actions";

export const metadata: Metadata = { title: "Mi tarjeta" };

export default async function MyCardPage({ searchParams }: { searchParams: Promise<{ bienvenida?: string; reactivada?: string }> }) {
  const { bienvenida, reactivada } = await searchParams;
  const session = await getCustomerSession();
  if (session.status !== "enrolled") redirect("/tarjeta/acceso");

  const { card, customer, campaign, history } = session.card;
  const wallet = await walletStatusForCard(card.id);
  const supabase = await createSupabaseServerClient();
  const birthdayResult = await supabase?.rpc("get_my_birthday_offer", { p_business_slug: PILOT_BUSINESS_SLUG });
  const birthday = birthdayResult?.data?.ok ? birthdayResult.data : null;
  const greeting = customer.display_name ? `Hola, ${customer.display_name}` : "Hola, viajero";
  const themeResult = await supabase?.from("businesses").select("name,card_background_color,card_secondary_color,card_text_color,card_logo_path").eq("slug", PILOT_BUSINESS_SLUG).single();
  const themeRow = themeResult?.data;
  const theme = themeRow ? {
    businessName: themeRow.name,
    background: themeRow.card_background_color,
    secondary: themeRow.card_secondary_color,
    text: themeRow.card_text_color,
    logoUrl: themeRow.card_logo_path && supabase ? supabase.storage.from("business-logos").getPublicUrl(themeRow.card_logo_path).data.publicUrl : null,
  } : DEFAULT_CARD_THEME;

  return (
    <div className="min-h-dvh bg-[#f3f6fb] text-slate-900">
      <header className="border-b border-slate-200 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/c/cafe-nomada" aria-label={`${theme.businessName}, ir al inicio`} className="flex items-center gap-3 rounded-xl focus-visible:outline-3 focus-visible:outline-blue-500">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-lg font-black text-white">L</span>
          <span><span className="block text-[0.65rem] font-bold uppercase tracking-widest text-blue-700">iautomexa Loyalty</span><span className="block text-sm font-bold text-slate-900">{theme.businessName}</span></span>
        </Link>
        <form action={customerSignOutAction}>
          <button type="submit" className="min-h-11 cursor-pointer rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-950">
            Salir
          </button>
        </form>
      </div>
      </header>

      <main id="contenido" className="mx-auto max-w-3xl space-y-6 px-5 py-8 pb-16">
        {bienvenida ? (
          <p role="status" className="rounded-2xl border border-exito/30 bg-exito/5 px-5 py-4 text-exito">
            ¡Bienvenido a la bitácora! Tu tarjeta está lista. Muestra tu código en tu próxima visita.
          </p>
        ) : null}
        {reactivada ? <p role="status" className="rounded-2xl border border-exito/30 bg-exito/5 px-5 py-4 text-exito">Tu tarjeta volvió a estar activa. Conservas tus sellos y recompensas.</p> : null}

        <section aria-labelledby="saludo" className="rounded-[2rem] border border-white bg-white/85 p-6 shadow-[0_16px_45px_rgba(40,66,110,.07)] sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Tu espacio de fidelidad</p>
          <h1 id="saludo" className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{greeting}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Muestra tu código al pagar para registrar tu visita. Tus sellos y recompensas se actualizan aquí.</p>
          <div className="mt-5 flex flex-wrap gap-2 text-sm"><span className="rounded-full bg-blue-50 px-3 py-1.5 font-semibold text-blue-800">{card.stamps_balance} de {campaign?.stamps_required ?? 9} sellos</span><span className="rounded-full bg-amber-50 px-3 py-1.5 font-semibold text-amber-900">{card.rewards_balance} recompensas disponibles</span></div>
        </section>

        <CardQr
          cardId={card.id}
          rewardsAvailable={card.rewards_balance}
          stampsBalance={card.stamps_balance}
          stampsRequired={campaign?.stamps_required ?? 9}
          rewardDescription={campaign?.reward_description ?? "tu recompensa"}
          theme={theme}
        />

        {campaign ? (
          <PassportCard
            stampsBalance={card.stamps_balance}
            stampsRequired={campaign.stamps_required}
            rewardsAvailable={card.rewards_balance}
            rewardDescription={campaign.reward_description}
            theme={theme}
          />
        ) : (
          <p className="rounded-2xl bg-papel p-5 text-tabaco">El programa de fidelidad está en pausa. Tus sellos siguen guardados.</p>
        )}

        <WalletSection {...wallet} />

        {birthday ? <BirthdayOfferPreferences optedIn={Boolean(birthday.opted_in)} month={birthday.month ?? null} day={birthday.day ?? null} />
          : <p className="rounded-2xl bg-papel p-5 text-sm text-tabaco/75">Las preferencias de cumpleaños no están disponibles en este momento.</p>}

        <section aria-labelledby="historial-titulo" className="rounded-[2rem] bg-papel p-6">
          <h2 id="historial-titulo" className="text-2xl text-tabaco">
            Tu bitácora
          </h2>
          {history.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-tabaco/25 p-6 text-center">
              <p className="font-display text-xl text-tabaco">Tu historia empieza con la primera taza.</p>
              <p className="mt-2 text-sm leading-6 text-tabaco/75">Aquí verás cada sello y cada recompensa.</p>
            </div>
          ) : (
            <ol className="mt-4 divide-y divide-tabaco/10">
              {history.map((entry) => {
                const d = describeHistoryEntry(entry);
                return (
                  <li key={entry.id} className="flex items-start justify-between gap-4 py-3">
                    <div>
                      <p className={`font-semibold ${d.tone === "reward" ? "text-arcilla-texto" : "text-tabaco"}`}>{d.title}</p>
                      {d.detail ? <p className="text-sm text-tabaco/75">{d.detail}</p> : null}
                    </div>
                    <time dateTime={entry.occurred_at} className="shrink-0 text-right text-sm text-tabaco/75">
                      {formatDateTime(entry.occurred_at)}
                    </time>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {campaign ? (
          <section aria-labelledby="reglas-titulo" className="px-1 text-sm leading-6 text-tabaco/75">
            <h2 id="reglas-titulo" className="font-semibold text-tabaco">
              Reglas de {campaign.name}
            </h2>
            <p className="mt-1">
              {campaign.stamps_required} compras elegibles = {campaign.reward_description.toLowerCase()}. Un sello por compra. No suman
              compras anuladas, devueltas ni cortesías.{" "}
              {describeRewardCap(
                campaign.reward_cap_kind === "fixed"
                  ? { kind: "fixed", maxCents: campaign.reward_cap_max_cents ?? 0 }
                  : { kind: "min_eligible_item_in_completing_ticket", maxCents: campaign.reward_cap_max_cents },
                formatMxn,
              )}
              .
            </p>
          </section>
        ) : null}

        <AccountControls />
      </main>
    </div>
  );
}
