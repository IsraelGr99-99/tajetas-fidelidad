"use client";

import Link from "next/link";
import { useActionState } from "react";
import { type FormState, enrollAction } from "../actions";

export function ProfileForm({ contactLabel }: { contactLabel: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(enrollAction, { error: null });

  return (
    <form action={action} className="space-y-5">
      {contactLabel ? (
        <p className="rounded-xl border border-exito/30 bg-exito/5 px-4 py-3 text-sm text-exito">Verificado: {contactLabel}</p>
      ) : null}
      <div>
        <label htmlFor="displayName" className="block text-sm font-semibold text-tabaco">
          ¿Cómo te llamamos en la barra? <span className="font-normal text-tabaco/75">(opcional)</span>
        </label>
        <input
          id="displayName"
          name="displayName"
          autoComplete="given-name"
          maxLength={40}
          disabled={pending}
          className="mt-2 block min-h-12 w-full rounded-xl border border-tabaco/25 bg-papel px-4 text-base text-tinta outline-none focus:border-tabaco focus-visible:outline-3 focus-visible:outline-mostaza"
        />
        <p className="mt-2 text-sm text-tabaco/75">Solo tu nombre de pila o apodo. El barista lo verá al escanear tu código.</p>
      </div>

      <label className="flex gap-3 rounded-2xl border border-tabaco/15 bg-papel p-4 text-sm leading-6 text-tabaco">
        <input type="checkbox" name="privacy" required disabled={pending} className="mt-1 h-5 w-5 shrink-0 accent-[#3d2c24]" />
        <span>
          Leí y acepto el{" "}
          <Link href="/privacidad" target="_blank" className="font-semibold underline underline-offset-4">
            aviso de privacidad
          </Link>
          . Mis datos se usan solo para la tarjeta de fidelidad.
        </span>
      </label>

      <div aria-live="polite" className="min-h-6">
        {state.error ? (
          <p role="alert" className="rounded-xl border border-alerta/30 bg-alerta/5 px-4 py-3 text-sm text-alerta">
            {state.error}
          </p>
        ) : null}
      </div>

      <button type="submit" disabled={pending} className="btn btn-oscuro w-full disabled:cursor-wait disabled:opacity-70">
        {pending ? "Creando tu tarjeta…" : "Crear mi tarjeta"}
      </button>
    </form>
  );
}
