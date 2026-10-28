"use client";

import { useActionState } from "react";
import { createDemoBusinessAction, type CreateBusinessState } from "./actions";

export function CreateBusinessForm() {
  const [state, action, pending] = useActionState<CreateBusinessState, FormData>(createDemoBusinessAction, { error: null });
  return <form action={action} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
    <label className="grid gap-2 text-sm font-semibold text-slate-800">Nombre del negocio
      <input name="name" required minLength={2} maxLength={120} disabled={pending} placeholder="Heladería Sol" className="min-h-12 rounded-xl border border-slate-300 px-4 text-base font-normal outline-blue-500" />
    </label>
    <label className="grid gap-2 text-sm font-semibold text-slate-800">Nombre de la primera sucursal
      <input name="branchName" required minLength={2} maxLength={120} defaultValue="Principal" disabled={pending} className="min-h-12 rounded-xl border border-slate-300 px-4 text-base font-normal outline-blue-500" />
    </label>
    <label className="grid gap-2 text-sm font-semibold text-slate-800">URL del negocio <span className="font-normal text-slate-500">(opcional; se genera a partir del nombre)</span>
      <input name="slug" maxLength={60} disabled={pending} placeholder="heladeria-sol" pattern="[a-z0-9]+(-[a-z0-9]+)*" className="min-h-12 rounded-xl border border-slate-300 px-4 text-base font-normal outline-blue-500" />
    </label>
    <p className="text-sm leading-6 text-slate-600">Se crea una sucursal, una campaña y un producto de ejemplo. Todo queda marcado como DEMO; cambia la regla y el catálogo antes de invitar a clientes.</p>
    {state.error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{state.error}</p> : null}
    <button disabled={pending} className="min-h-12 w-full cursor-pointer rounded-xl bg-blue-700 px-6 font-bold text-white hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60">{pending ? "Creando negocio…" : "Crear negocio de prueba"}</button>
  </form>;
}
