"use client";

import { useActionState, useState } from "react";
import { type ActionState, publishCampaignAction } from "@/actions/management";
import { FormMessage } from "@/components/ui/FormMessage";
import { errorTextClass, hintClass, inputClass, labelClass } from "@/components/ui/form";

export type CampaignValues = {
  campaignId: string;
  name: string;
  rewardDescription: string;
  stampsRequired: number;
  stampsPerPurchase: number;
  capKind: "min_eligible_item_in_completing_ticket" | "fixed";
  capMaxCents: number | null;
  minSecondsBetweenEarns: number;
  maxEarnsPerDay: number;
};

/** Publica una nueva versión inmutable; la anterior queda en el historial. */
export function CampaignForm({ current }: { current: CampaignValues }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(publishCampaignAction, { ok: false, message: null });
  const [capKind, setCapKind] = useState(current.capKind);
  const err = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="campaignId" value={current.campaignId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="c-name" className={labelClass}>
            Nombre del programa
          </label>
          <input id="c-name" name="name" defaultValue={current.name} required maxLength={80} className={inputClass} />
          {err.name ? <p className={errorTextClass}>{err.name}</p> : null}
        </div>
        <div>
          <label htmlFor="c-reward" className={labelClass}>
            Recompensa
          </label>
          <input id="c-reward" name="rewardDescription" defaultValue={current.rewardDescription} required maxLength={160} className={inputClass} />
          {err.rewardDescription ? <p className={errorTextClass}>{err.rewardDescription}</p> : null}
        </div>
        <div>
          <label htmlFor="c-stamps" className={labelClass}>
            Compras para la recompensa
          </label>
          <input id="c-stamps" name="stampsRequired" type="number" min={1} max={50} defaultValue={current.stampsRequired} required className={inputClass} />
          {err.stampsRequired ? <p className={errorTextClass}>{err.stampsRequired}</p> : null}
        </div>
        <div>
          <label htmlFor="c-per" className={labelClass}>
            Sellos por compra
          </label>
          <input id="c-per" name="stampsPerPurchase" type="number" min={1} max={5} defaultValue={current.stampsPerPurchase} required className={inputClass} />
          <p className={hintClass}>Recomendado: 1. Una compra con varias bebidas sigue sumando este número como máximo.</p>
        </div>
        <div>
          <label htmlFor="c-wait" className={labelClass}>
            Espera mínima entre sellos (minutos)
          </label>
          <input
            id="c-wait"
            name="minMinutesBetweenEarns"
            type="number"
            min={0}
            max={1440}
            defaultValue={Math.round(current.minSecondsBetweenEarns / 60)}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="c-daily" className={labelClass}>
            Máximo de sellos por día
          </label>
          <input id="c-daily" name="maxEarnsPerDay" type="number" min={1} max={20} defaultValue={current.maxEarnsPerDay} required className={inputClass} />
        </div>
      </div>

      <fieldset className="rounded-2xl border border-tabaco/15 p-4">
        <legend className={`${labelClass} px-1`}>Valor máximo de la recompensa</legend>
        <div className="mt-1 space-y-2 text-sm text-tabaco">
          <label className="flex items-start gap-2">
            <input
              type="radio"
              name="capKind"
              value="min_eligible_item_in_completing_ticket"
              checked={capKind === "min_eligible_item_in_completing_ticket"}
              onChange={() => setCapKind("min_eligible_item_in_completing_ticket")}
              className="mt-0.5 h-4 w-4 accent-[#3d2c24]"
            />
            La bebida elegible más barata del ticket que completó la tarjeta (regla del piloto)
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" name="capKind" value="fixed" checked={capKind === "fixed"} onChange={() => setCapKind("fixed")} className="mt-0.5 h-4 w-4 accent-[#3d2c24]" />
            Un monto fijo
          </label>
        </div>
        <div className="mt-3 max-w-xs">
          <label htmlFor="c-cap" className={labelClass}>
            {capKind === "fixed" ? "Monto (MXN)" : "Tope adicional opcional (MXN)"}
          </label>
          <input
            id="c-cap"
            name="capMax"
            inputMode="decimal"
            defaultValue={current.capMaxCents ? (current.capMaxCents / 100).toFixed(2) : ""}
            required={capKind === "fixed"}
            className={inputClass}
          />
          {err.capMax || err.rewardCap ? <p className={errorTextClass}>{err.capMax ?? "Indica un monto válido."}</p> : null}
        </div>
      </fieldset>

      <div>
        <label htmlFor="c-reason" className={labelClass}>
          Motivo del cambio
        </label>
        <textarea id="c-reason" name="reason" required minLength={5} maxLength={300} rows={2} className={`${inputClass} py-2`} />
        {err.reason ? <p className={errorTextClass}>{err.reason}</p> : null}
        <p className={hintClass}>Queda en el historial y en la bitácora de auditoría.</p>
      </div>

      <FormMessage state={state} />
      <button type="submit" disabled={pending} className="btn btn-oscuro disabled:opacity-70">
        {pending ? "Publicando…" : "Publicar nueva versión"}
      </button>
    </form>
  );
}
