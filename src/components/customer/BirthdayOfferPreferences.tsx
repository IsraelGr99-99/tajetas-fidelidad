"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { type BirthdayPreferenceState, updateBirthdayOfferAction } from "@/app/tarjeta/actions";

export function BirthdayOfferPreferences({ optedIn, month, day }: { optedIn: boolean; month: number | null; day: number | null }) {
  const [state, action, pending] = useActionState<BirthdayPreferenceState, FormData>(updateBirthdayOfferAction, { error: null, success: null });
  const [enabled, setEnabled] = useState(optedIn);
  return <section aria-labelledby="cumpleanos-title" className="rounded-[2rem] bg-papel p-6 text-tabaco">
    <h2 id="cumpleanos-title" className="text-2xl">Preferencia de cumpleaños</h2>
    <p className="mt-2 text-sm leading-6 text-tabaco/75">Opcional. Solo guardamos día y mes si aceptas una futura promoción. Todavía no se envían mensajes ni se aplican descuentos automáticos.</p>
    <form action={action} className="mt-4 space-y-4">
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="birthdayOffer" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} disabled={pending} className="mt-1 h-5 w-5 shrink-0 accent-[#3d2c24]" />
        <span>Acepto esta finalidad opcional. Puedo retirar mi consentimiento en cualquier momento. <Link href="/privacidad" className="font-semibold underline underline-offset-4">Leer el aviso de privacidad</Link>.</span></label>
      {enabled && <div className="flex flex-wrap gap-3 text-sm">
        <label className="grid gap-1">Mes<input type="number" name="birthMonth" min={1} max={12} defaultValue={month ?? ""} required disabled={pending} className="min-h-11 w-24 rounded-xl border border-tabaco/25 px-3" /></label>
        <label className="grid gap-1">Día<input type="number" name="birthDay" min={1} max={31} defaultValue={day ?? ""} required disabled={pending} className="min-h-11 w-24 rounded-xl border border-tabaco/25 px-3" /></label>
      </div>}
      <p aria-live="polite" className={`text-sm ${state.error ? "text-alerta" : "text-exito"}`}>{state.error ?? state.success}</p>
      <button type="submit" disabled={pending} className="btn btn-oscuro disabled:opacity-70">{pending ? "Guardando…" : enabled ? "Guardar preferencia" : optedIn ? "Retirar consentimiento y borrar fecha" : "Guardar preferencia"}</button>
    </form>
  </section>;
}
