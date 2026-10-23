"use client";

import { useActionState } from "react";
import { type ActionState, upsertBranchAction } from "@/app/personal/gestion";
import { FormMessage } from "@/components/ui/FormMessage";
import { errorTextClass, inputClass, labelClass } from "@/components/ui/form";

export function BranchForm({ branch }: { branch: { id: string; name: string; address: string | null; active: boolean } | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(upsertBranchAction, { ok: false, message: null });
  const uid = branch?.id ?? "nueva";
  const err = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="branchId" value={branch?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-name`} className={labelClass}>
            Nombre
          </label>
          <input id={`${uid}-name`} name="name" defaultValue={branch?.name ?? ""} required maxLength={120} className={inputClass} />
          {err.name ? <p className={errorTextClass}>{err.name}</p> : null}
        </div>
        <div>
          <label htmlFor={`${uid}-address`} className={labelClass}>
            Dirección <span className="font-normal text-tabaco/75">(opcional)</span>
          </label>
          <input id={`${uid}-address`} name="address" defaultValue={branch?.address ?? ""} maxLength={240} className={inputClass} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-tabaco">
        <input type="checkbox" name="active" defaultChecked={branch?.active ?? true} className="h-5 w-5 accent-[#3d2c24]" /> Activa
      </label>
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className="btn btn-oscuro disabled:opacity-70">
        {pending ? "Guardando…" : branch ? "Guardar cambios" : "Crear sucursal"}
      </button>
    </form>
  );
}
