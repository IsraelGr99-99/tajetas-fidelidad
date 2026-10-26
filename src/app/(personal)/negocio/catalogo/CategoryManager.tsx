"use client";

import { useActionState } from "react";
import { type ActionState, upsertProductCategoryAction } from "@/actions/management";
import { FormMessage } from "@/components/ui/FormMessage";
import { inputClass, labelClass } from "@/components/ui/form";

export function CategoryManager({ categories }: { categories: string[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(upsertProductCategoryAction, { ok: false, message: null });
  return <section className="workspace-card p-5">
    <h2 className="text-lg font-semibold text-tabaco">Categorías ({categories.length})</h2>
    <p className="mt-3 text-sm text-tabaco/75">Crea una categoría sin añadir aún un producto. Mayúsculas y espacios no crean duplicados: “bebidas” y “Bebidas” son la misma.</p>
    <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
      <label className={labelClass}>Nombre de la categoría
        <input name="name" required minLength={2} maxLength={40} className={inputClass} placeholder="Bebidas frías" />
      </label>
      <button disabled={pending} className="btn btn-oscuro">{pending ? "Guardando…" : "Guardar categoría"}</button>
    </form>
    <FormMessage state={state} />
    {categories.length > 0 && <ul className="mt-4 flex flex-wrap gap-2">{categories.map((name) => <li key={name} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">{name}</li>)}</ul>}
  </section>;
}
