"use client";

import { useActionState } from "react";
import { updateProductImage, type ImageState } from "@/actions/product-image";
import { ProductThumbnail } from "@/components/staff/ProductThumbnail";

export function ProductImageManager({ productId, initialUrl }: { productId: string; initialUrl: string | null }) {
  const [state, action, pending] = useActionState<ImageState, FormData>(updateProductImage, { ok: false, message: "" });
  const imageUrl = state.ok ? (state.imageUrl ?? null) : initialUrl;
  return <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
    <div className="flex flex-wrap items-center gap-4">
      <ProductThumbnail src={imageUrl} size={88} />
      <div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">Foto del producto</p><p className="mt-1 text-sm text-slate-600">Aparecerá en miniatura en caja. Usa JPG, PNG o WebP, máximo 2 MB.</p></div>
    </div>
    <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
      <input type="hidden" name="productId" value={productId} />
      <label className="min-w-[13rem] flex-1 text-sm font-semibold text-slate-800">Elegir foto
        <input type="file" name="image" accept="image/jpeg,image/png,image/webp" required className="mt-2 block w-full cursor-pointer rounded-xl border border-slate-300 bg-white p-2 text-sm text-slate-700 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-800" />
      </label>
      <button disabled={pending} className="workspace-action">{pending ? "Guardando…" : imageUrl ? "Cambiar foto" : "Subir foto"}</button>
    </form>
    {imageUrl && <form action={action} className="mt-2"><input type="hidden" name="productId" value={productId} /><input type="hidden" name="intent" value="remove" /><button disabled={pending} className="min-h-10 cursor-pointer text-sm font-semibold text-slate-600 underline underline-offset-2 hover:text-red-700">Quitar foto</button></form>}
    {state.message && <p role="status" className={`mt-3 text-sm ${state.ok ? "text-emerald-800" : "text-red-700"}`}>{state.message}</p>}
  </div>;
}
