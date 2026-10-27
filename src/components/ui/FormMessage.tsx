import type { ActionState } from "@/actions/management";

/** Mensaje de resultado de un formulario, anunciado a lectores de pantalla. */
export function FormMessage({ state }: { state: ActionState }) {
  return (
    <div aria-live="polite">
      {state.message ? (
        <p
          role={state.ok && !state.partial ? "status" : "alert"}
          className={`rounded-xl border px-4 py-3 text-sm ${state.partial ? "border-amber-300 bg-amber-50 text-amber-950" : state.ok ? "border-exito/30 bg-exito/5 text-exito" : "border-alerta/30 bg-alerta/5 text-alerta"}`}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
