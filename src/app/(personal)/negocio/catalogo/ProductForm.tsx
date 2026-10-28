"use client";

import { useActionState, useState } from "react";
import { type ActionState, upsertProductAction } from "@/actions/management";
import { FormMessage } from "@/components/ui/FormMessage";
import { errorTextClass, inputClass, labelClass } from "@/components/ui/form";
import { ProductImageManager } from "./ProductImageManager";

export type ProductValues = {
  id: string | null;
  baseName: string;
  variantLabel: string | null;
  category: string;
  priceCents: number;
  costCents: number | null;
  eligible: boolean;
  active: boolean;
  imageUrl: string | null;
};

export function ProductForm({ product, categories }: { product: ProductValues | null; categories: string[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(upsertProductAction, { ok: false, message: null });
  const p = product ?? { id: null, baseName: "", variantLabel: null, category: categories[0] ?? "", priceCents: 0, costCents: null, eligible: true, active: true, imageUrl: null };
  const [savedId, setSavedId] = useState<string | null>(p.id);
  const [savedImageUrl, setSavedImageUrl] = useState<string | null>(p.imageUrl);
  if (state.productId && savedId !== state.productId) setSavedId(state.productId);
  if (state.imageUrl !== undefined && savedImageUrl !== state.imageUrl) setSavedImageUrl(state.imageUrl);
  const [categoryChoice, setCategoryChoice] = useState(p.category || "__new__");
  const uid = p.id ?? "nuevo";
  const err = state.fieldErrors ?? {};

  return (
    <div className="space-y-5"><form action={action} className="space-y-4">
      <input type="hidden" name="productId" value={savedId ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-base-name`} className={labelClass}>
            Nombre del producto
          </label>
          <input id={`${uid}-base-name`} name="baseName" defaultValue={p.baseName} required maxLength={60} placeholder="Americano" className={inputClass} />
          {err.baseName ? <p className={errorTextClass}>{err.baseName}</p> : null}
        </div>
        <div>
          <label htmlFor={`${uid}-variant`} className={labelClass}>
            Tamaño o medida <span className="font-normal text-tabaco/70">(opcional)</span>
          </label>
          <input id={`${uid}-variant`} name="variantLabel" defaultValue={p.variantLabel ?? ""} maxLength={30} placeholder="Chico, grande, 250 g…" className={inputClass} />
          <p className="mt-1 text-xs text-tabaco/70">Cada tamaño se vende y configura con precio y receta propios.</p>
          {err.variantLabel ? <p className={errorTextClass}>{err.variantLabel}</p> : null}
        </div>
        <div>
          <label htmlFor={`${uid}-category`} className={labelClass}>Categoría</label>
          <select id={`${uid}-category`} value={categoryChoice} onChange={(e) => setCategoryChoice(e.target.value)} name={categoryChoice === "__new__" ? undefined : "category"} className={inputClass}>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value="__new__">+ Nueva categoría</option>
          </select>
          {categoryChoice === "__new__" && <input name="category" required minLength={2} maxLength={40} placeholder="Nombre de categoría" className={`${inputClass} mt-2`} />}
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
            Costo por unidad <span className="font-normal text-tabaco/75">(opcional)</span>
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
      <div>
        <label htmlFor={`${uid}-image`} className={labelClass}>Foto del producto <span className="font-normal text-slate-500">(opcional)</span></label>
        <input id={`${uid}-image`} type="file" name="image" accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full cursor-pointer rounded-xl border border-slate-300 bg-white p-2 text-sm text-slate-700 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-800" />
        <p className="mt-1 text-xs text-slate-500">Puedes subirla al crear el producto o cambiarla después. JPG, PNG o WebP; máximo 2 MB.</p>
        {err.image ? <p className={errorTextClass}>{err.image}</p> : null}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-tabaco">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="eligible" defaultChecked={p.eligible} className="h-5 w-5 accent-blue-700" /> Cuenta para el programa de fidelidad
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="active" defaultChecked={p.active} className="h-5 w-5 accent-blue-700" /> Disponible para vender
        </label>
      </div>
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className="workspace-action disabled:opacity-70">
        {pending ? "Guardando…" : savedId ? "Guardar cambios" : "Agregar producto"}
      </button>
      {state.ok && !p.id && state.productId && <p className="text-sm text-slate-700">Siguiente: <a href={`/negocio/inventario?vista=recetas&producto=${encodeURIComponent(state.productId)}#recipe-editor`} className="font-bold text-blue-700 underline underline-offset-2">configura la receta de este producto</a> para que caja descuente sus insumos al vender.</p>}
    </form>
    {savedId && <ProductImageManager key={savedId} productId={savedId} initialUrl={savedImageUrl} />}
    </div>
  );
}
