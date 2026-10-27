"use client";

import Link from "next/link";
import { useActionState } from "react";
import { type FormState, reactivateMyAccountAction } from "../actions";

export function ReactivateAccount() {
  const [state, action, pending] = useActionState<FormState, FormData>(reactivateMyAccountAction, { error: null });
  return <form action={action} className="space-y-4">
    <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-tabaco">La reactivación vuelve a habilitar tu QR y el programa de fidelidad. No crea una tarjeta nueva.</p>
    <label className="flex gap-3 rounded-xl border border-tabaco/15 p-4 text-sm leading-6 text-tabaco">
      <input type="checkbox" name="privacy" required disabled={pending} className="mt-1 h-5 w-5 shrink-0" />
      <span>Leí y acepto el <Link href="/privacidad" target="_blank" className="font-semibold underline">aviso de privacidad</Link> para reactivar mi tarjeta.</span>
    </label>
    {state.error ? <p role="alert" className="text-sm text-alerta">{state.error}</p> : null}
    <button disabled={pending} className="btn btn-oscuro w-full disabled:opacity-50">{pending ? "Reactivando…" : "Reactivar mi tarjeta"}</button>
  </form>;
}
