"use client";

import { useActionState } from "react";
import { type FormState, deleteMyDataAction } from "@/app/tarjeta/actions";

export function DeleteAccount() {
  const [state, action, pending] = useActionState<FormState, FormData>(deleteMyDataAction, { error: null });
  return (
    <details className="rounded-[2rem] border border-tabaco/10 p-6">
      <summary className="cursor-pointer font-semibold text-tabaco">Eliminar mi tarjeta y mis datos</summary>
      <form action={action} className="mt-4 space-y-4">
        <p className="text-sm leading-6 text-tabaco/80">
          Borramos tu correo o teléfono y tu nombre. Perderás tus sellos y recompensas pendientes; el historial queda sin datos que te
          identifiquen. Esta acción no se puede deshacer.
        </p>
        <div>
          <label htmlFor="confirm-delete" className="block text-sm font-semibold text-tabaco">
            Escribe ELIMINAR para confirmar
          </label>
          <input
            id="confirm-delete"
            name="confirm"
            autoComplete="off"
            required
            className="mt-2 block min-h-12 w-full rounded-xl border border-tabaco/25 bg-papel px-4 text-base text-tinta outline-none focus:border-tabaco focus-visible:outline-3 focus-visible:outline-mostaza"
          />
        </div>
        <div aria-live="polite">
          {state.error ? (
            <p role="alert" className="rounded-xl border border-alerta/30 bg-alerta/5 px-4 py-3 text-sm text-alerta">
              {state.error}
            </p>
          ) : null}
        </div>
        <button type="submit" disabled={pending} className="btn w-full border border-alerta/50 text-alerta hover:bg-alerta/5 disabled:opacity-70">
          {pending ? "Eliminando…" : "Eliminar definitivamente"}
        </button>
      </form>
    </details>
  );
}
