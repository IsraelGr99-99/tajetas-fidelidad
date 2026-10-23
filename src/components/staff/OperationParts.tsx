import type { ReactNode } from "react";

/** Indicador de pasos accesible para los flujos de barra. */
export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="mt-6 flex gap-2" aria-label="Pasos">
      {steps.map((label, i) => {
        const state = i < current ? "hecho" : i === current ? "actual" : "pendiente";
        return (
          <li key={label} aria-current={i === current ? "step" : undefined} className="flex-1">
            <span
              className={`block h-1.5 rounded-full ${state === "pendiente" ? "bg-tabaco/15" : state === "actual" ? "bg-mostaza" : "bg-tabaco"}`}
            />
            <span className={`mt-2 block text-xs ${i === current ? "font-semibold text-tabaco" : "text-tabaco/75"}`}>
              {i + 1}. {label}
              <span className="sr-only"> ({state})</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function CustomerBadge({
  displayName,
  contactMasked,
  stampsBalance,
  stampsRequired,
  rewardsBalance,
}: {
  displayName: string | null;
  contactMasked: string | null;
  stampsBalance: number;
  stampsRequired: number;
  rewardsBalance: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-papel p-5">
      <div>
        <p className="font-display text-2xl text-tabaco">{displayName ?? "Cliente sin nombre"}</p>
        {contactMasked ? <p className="text-sm text-tabaco/75">{contactMasked}</p> : null}
      </div>
      <div className="text-right">
        <p className="font-semibold text-tabaco">
          {stampsBalance} de {stampsRequired}
        </p>
        <p className="text-sm text-tabaco/75">
          {rewardsBalance > 0 ? `${rewardsBalance} recompensa${rewardsBalance === 1 ? "" : "s"} lista${rewardsBalance === 1 ? "" : "s"}` : "sellos"}
        </p>
      </div>
    </div>
  );
}

export function Notice({ tone, title, children }: { tone: "error" | "success" | "info"; title: string; children?: ReactNode }) {
  const styles = {
    error: "border-alerta/30 bg-alerta/5 text-alerta",
    success: "border-exito/30 bg-exito/5 text-exito",
    info: "border-tabaco/20 bg-papel text-tabaco",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-2xl border px-5 py-4 ${styles}`}>
      <p className="font-semibold">{title}</p>
      {children ? <div className="mt-1 text-sm leading-6">{children}</div> : null}
    </div>
  );
}

/** Llave de idempotencia por operación: se crea al confirmar y se reutiliza en reintentos. */
export function newIdempotencyKey(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}
