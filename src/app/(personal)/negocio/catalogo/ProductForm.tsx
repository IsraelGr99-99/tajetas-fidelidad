"use client";

import { useActionState } from "react";
import { type ActionState, upsertProductAction } from "@/actions/management";
import { FormMessage } from "@/components/ui/FormMessage";
import { errorTextClass, inputClass, labelClass } from "@/components/ui/form";

export type ProductValues = {
  id: string | null;
  name: string;
  category: string;
  priceCents: number;
  costCents: number | null;
  eligible: boolean;
  active: boolean;
};

export function ProductForm({ product, categories }: { product: ProductValues | null; categories: string[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(upsertProductAction, { ok: false, message: null });
  const p = product ?? { id: null, name: "", category: categories[0] ?? "Bebidas", priceCents: 0, costCents: null, eligible: true, active: true };
  const uid = p.id ?? "nuevo";
  const err = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="productId" value={p.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-[2fr_1.2fr_1fr_1fr]">
        <div>
          <label htmlFor={`${uid}-name`} className={labelClass}>
            Nombre
          </label>
          <input id={`${uid}-name`} name="name" defaultValue={p.name} required maxLength={80} className={inputClass} />
          {err.name ? <p className={errorTextClass}>{err.name}</p> : null}
        </div>
        <div>
          <label htmlFor={`${uid}-category`} className={labelClass}>
            Categoría
          </label>
          <input id={`${uid}-category`} name="category" defaultValue={p.category} list="categorias" required maxLength={40} className={inputClass} />
          {err.category ? <p className={errorTextClass}>{err.category}</p> : null}
        </div>
        <div>
          <label htmlFor={`${uid}-price`} className={labelClass}>
            Precio (MXN)
          </label>
          <input
            id={`${uid}-price`}
            name="price"
            defaultValue={p.id ? (p.priceCents / 100).toFixed(2) : ""}
            inputMode="decimal"
            placeholder="65.00"
            required
            className={inputClass}
          />
          {err.price ? <p className={errorTextClass}>{err.price}</p> : null}
        </div>
        <div>
          <label htmlFor={`${uid}-cost`} className={labelClass}>
            Costo <span className="font-normal text-tabaco/75">(opcional)</span>
          </label>
          <input
            id={`${uid}-cost`}
            name="cost"
            defaultValue={p.costCents !== null ? (p.costCents / 100).toFixed(2) : ""}
            inputMode="decimal"
            placeholder="14.50"
            className={inputClass}
          />
          {err.cost ? <p className={errorTextClass}>{err.cost}</p> : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-tabaco">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="eligible" defaultChecked={p.eligible} className="h-5 w-5 accent-[#3d2c24]" /> Suma sello (bebida elegible)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="active" defaultChecked={p.active} className="h-5 w-5 accent-[#3d2c24]" /> Disponible en la barra
        </label>
      </div>
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className="btn btn-oscuro disabled:opacity-70">
        {pending ? "Guardando…" : p.id ? "Guardar cambios" : "Agregar producto"}
      </button>
    </form>
  );
}
