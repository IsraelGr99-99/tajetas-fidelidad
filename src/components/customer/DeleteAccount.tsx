"use client";

import { useActionState } from "react";
import { type FormState, deleteMyDataAction, disableMyAccountAction } from "@/app/tarjeta/actions";

const categories = [
  ["no_uso", "Ya no uso la tarjeta"],
  ["privacidad", "Prefiero no compartir mis datos"],
  ["experiencia", "Tuve una mala experiencia"],
  ["otro", "Otro motivo"],
] as const;

export function AccountControls({ businessSlug }: { businessSlug: string }) {
  const [disableState, disableAction, disabling] = useActionState<FormState, FormData>(disableMyAccountAction.bind(null, businessSlug), { error: null });
  const [deleteState, deleteAction, deleting] = useActionState<FormState, FormData>(deleteMyDataAction.bind(null, businessSlug), { error: null });
  return <section aria-labelledby="account-controls" className="rounded-[2rem] border border-tabaco/10 bg-papel p-6">
    <h2 id="account-controls" className="text-xl font-semibold text-tabaco">Control de tu cuenta</h2>
    <p className="mt-2 text-sm leading-6 text-tabaco/75">Puedes hacer una pausa y regresar con tus sellos, o eliminar tus datos personales definitivamente.</p>
    <details className="mt-5 rounded-2xl border border-amber-300 p-4">
      <summary className="cursor-pointer font-semibold text-tabaco">Desactivar temporalmente mi tarjeta</summary>
      <form action={disableAction} className="mt-4 space-y-4">
        <p className="text-sm leading-6 text-tabaco/80">Mientras esté desactivada no podrás usar el QR ni recibir sellos. Conservaremos tu tarjeta y podrás reactivarla al entrar de nuevo. El propietario verá el motivo que escribas; evita incluir datos sensibles.</p>
        <label className="grid gap-2 text-sm font-semibold text-tabaco">Motivo
          <select name="category" required defaultValue="" className="min-h-12 rounded-xl border border-tabaco/25 bg-white px-3"><option value="" disabled>Selecciona un motivo</option>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-tabaco">Cuéntanos brevemente por qué
          <textarea name="reason" required minLength={3} maxLength={200} rows={3} className="rounded-xl border border-tabaco/25 bg-white p-3" placeholder="Tu comentario para el propietario" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-tabaco">Escribe DESACTIVAR para confirmar
          <input name="confirm" required autoComplete="off" className="min-h-12 rounded-xl border border-tabaco/25 bg-white px-3" />
        </label>
        {disableState.error ? <p role="alert" className="text-sm text-alerta">{disableState.error}</p> : null}
        <button disabled={disabling} className="btn w-full border border-amber-500 text-tabaco hover:bg-amber-50 disabled:opacity-50">{disabling ? "Desactivando…" : "Desactivar mi tarjeta"}</button>
      </form>
    </details>
    <details className="mt-3 rounded-2xl border border-alerta/30 p-4">
      <summary className="cursor-pointer font-semibold text-alerta">Eliminar mi tarjeta y mis datos</summary>
      <form action={deleteAction} className="mt-4 space-y-4">
        <p className="text-sm leading-6 text-tabaco/80">Es definitivo: quitaremos tu contacto y nombre, y perderás tus sellos y recompensas. El historial contable queda sin datos personales. Una tarjeta eliminada no se puede reactivar.</p>
        <label className="grid gap-2 text-sm font-semibold text-tabaco">Motivo
          <select name="category" required defaultValue="" className="min-h-12 rounded-xl border border-tabaco/25 bg-white px-3"><option value="" disabled>Selecciona un motivo</option>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-tabaco">Escribe ELIMINAR para confirmar
          <input name="confirm" required autoComplete="off" className="min-h-12 rounded-xl border border-tabaco/25 bg-white px-3" />
        </label>
        {deleteState.error ? <p role="alert" className="text-sm text-alerta">{deleteState.error}</p> : null}
        <button disabled={deleting} className="btn w-full border border-alerta/50 text-alerta hover:bg-alerta/5 disabled:opacity-50">{deleting ? "Eliminando…" : "Eliminar definitivamente"}</button>
      </form>
    </details>
  </section>;
}
