import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand/Logo";
import { CardQr } from "@/components/customer/CardQr";
import { DeleteAccount } from "@/components/customer/DeleteAccount";
import { StampCard } from "@/components/loyalty/StampCard";
import { describeHistoryEntry } from "@/domain/customer/card";
import { describeRewardCap } from "@/domain/loyalty/campaign";
import { formatDateTime, formatMxn } from "@/lib/format";
import { getCustomerSession } from "@/lib/customer/session";
import { customerSignOutAction } from "./actions";

export const metadata: Metadata = { title: "Mi tarjeta" };

export default async function MyCardPage({ searchParams }: { searchParams: Promise<{ bienvenida?: string }> }) {
  const { bienvenida } = await searchParams;
  const session = await getCustomerSession();
  if (session.status !== "enrolled") redirect("/tarjeta/acceso");

  const { card, customer, campaign, history } = session.card;
  const greeting = customer.display_name ? `Hola, ${customer.display_name}` : "Hola, viajero";

  return (
    <div className="min-h-dvh bg-crema">
      <header className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-5 py-5 text-tabaco">
        <Link href="/" aria-label="Café Nómada, ir al inicio" className="rounded-full">
          <Wordmark />
        </Link>
        <form action={customerSignOutAction}>
          <button type="submit" className="min-h-11 rounded-full px-3 text-sm font-semibold underline underline-offset-4">
            Salir
          </button>
        </form>
      </header>

      <main id="contenido" className="mx-auto max-w-2xl space-y-6 px-5 pb-12">
        {bienvenida ? (
          <p role="status" className="rounded-2xl border border-exito/30 bg-exito/5 px-5 py-4 text-exito">
            ¡Bienvenido a la bitácora! Tu tarjeta está lista. Muestra tu código en tu próxima visita.
          </p>
        ) : null}

        <section aria-labelledby="saludo">
          <p className="bitacora text-arcilla-texto">{customer.contact_masked ?? "Tu tarjeta"}</p>
          <h1 id="saludo" className="mt-1 text-4xl text-tabaco">
            {greeting}
          </h1>
        </section>

        <CardQr cardId={card.id} rewardsAvailable={card.rewards_balance} />

        {campaign ? (
          <StampCard
            stampsBalance={card.stamps_balance}
            stampsRequired={campaign.stamps_required}
            rewardsAvailable={card.rewards_balance}
            rewardDescription={campaign.reward_description}
          />
        ) : (
          <p className="rounded-2xl bg-papel p-5 text-tabaco">El programa de fidelidad está en pausa. Tus sellos siguen guardados.</p>
        )}

        <section aria-labelledby="wallet-titulo" className="rounded-[2rem] border border-tabaco/10 bg-papel p-6">
          <h2 id="wallet-titulo" className="text-2xl text-tabaco">
            Guárdala en tu teléfono
          </h2>
          <p className="mt-2 leading-7 text-tabaco/75">
            Pronto podrás agregarla a Apple Wallet o Google Wallet. Esta integración todavía no está habilitada; mientras tanto, guarda esta
            página en tu pantalla de inicio.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="bitacora rounded-full border border-tabaco/25 px-3 py-1.5 text-[0.65rem] text-tabaco/75">Apple Wallet · no configurado</span>
            <span className="bitacora rounded-full border border-tabaco/25 px-3 py-1.5 text-[0.65rem] text-tabaco/75">Google Wallet · no configurado</span>
          </div>
        </section>

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

        <DeleteAccount />
      </main>
    </div>
  );
}
