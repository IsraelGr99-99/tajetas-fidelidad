"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { type ActionState, reverseEventAction } from "@/app/personal/gestion";
import { FormMessage } from "@/components/ui/FormMessage";
import { errorTextClass, inputClass, labelClass, secondaryButtonClass } from "@/components/ui/form";

/** Diálogo de reverso: motivo obligatorio y confirmación explícita. */
export function ReverseButton({ eventId, eventType }: { eventId: string; eventType: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [key, setKey] = useState("");
  const [state, action, pending] = useActionState<ActionState, FormData>(reverseEventAction, { ok: false, message: null });
  const titleId = useId();

  useEffect(() => {
    if (state.ok) dialogRef.current?.close();
  }, [state.ok]);

  function open() {
    // Una llave por intento de reverso; los reintentos del mismo formulario la reutilizan.
    setKey(`rev-${crypto.randomUUID()}`);
    dialogRef.current?.showModal();
  }

  return (
    <>
      <button type="button" onClick={open} className="text-sm font-semibold text-arcilla-texto underline underline-offset-4">
        Revertir
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-3xl bg-crema p-0 text-tabaco backdrop:bg-tinta/60"
      >
        <form action={action} className="space-y-4 p-6">
          <h2 id={titleId} className="text-2xl">
            Revertir {eventType === "earn" ? "sello" : eventType === "redeem" ? "canje" : "ajuste"}
          </h2>
          <p className="text-sm leading-6 text-tabaco/80">
            {eventType === "earn"
              ? "Se resta el sello de la tarjeta. Si ese sello ya completó una recompensa sin canjear, también se anula esa recompensa."
              : eventType === "redeem"
                ? "La recompensa vuelve a estar disponible en la tarjeta del cliente."
                : "Se deshace el ajuste manual."}
          </p>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="idempotencyKey" value={key} />
          {eventType === "earn" ? (
            <fieldset>
              <legend className={labelClass}>¿Qué pasó con la compra?</legend>
              <div className="mt-2 flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" name="purchaseStatus" value="voided" defaultChecked className="h-4 w-4 accent-[#3d2c24]" /> Se anuló
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="purchaseStatus" value="refunded" className="h-4 w-4 accent-[#3d2c24]" /> Se devolvió
                </label>
              </div>
            </fieldset>
          ) : (
            <input type="hidden" name="purchaseStatus" value="voided" />
          )}
          <div>
            <label htmlFor={`${titleId}-reason`} className={labelClass}>
              Motivo
            </label>
            <textarea id={`${titleId}-reason`} name="reason" required minLength={5} maxLength={300} rows={3} className={`${inputClass} py-2`} />
            {state.fieldErrors?.reason ? <p className={errorTextClass}>{state.fieldErrors.reason}</p> : null}
          </div>
          <FormMessage state={state.ok ? { ok: false, message: null } : state} />
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <button type="submit" disabled={pending} className="btn btn-oscuro disabled:opacity-70">
              {pending ? "Revirtiendo…" : "Confirmar reverso"}
            </button>
            <button type="button" onClick={() => dialogRef.current?.close()} className={secondaryButtonClass}>
              Cancelar
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
