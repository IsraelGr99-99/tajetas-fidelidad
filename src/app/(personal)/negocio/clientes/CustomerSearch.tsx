"use client";

import { useActionState, useState, type FormEvent } from "react";
import { type ActionState, type CustomerRow, adjustStampsAction, findCustomersAction } from "@/actions/management";
import { FormMessage } from "@/components/ui/FormMessage";
import { errorTextClass, hintClass, inputClass, labelClass } from "@/components/ui/form";
import { formatDateTime } from "@/lib/format";

/**
 * Búsqueda exacta de clientes. Va por Server Action (POST) para que el correo o
 * teléfono buscado no quede en la URL, el historial del navegador ni los logs.
 */
export function CustomerSearch() {
  const [results, setResults] = useState<CustomerRow[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get("q") ?? "");
    setBusy(true);
    setMessage(null);
    try {
      const r = await findCustomersAction(q);
      if (r.ok) {
        setResults(r.customers);
        if (r.customers.length === 0) setMessage("No hay clientes con ese dato exacto.");
      } else {
        setResults(null);
        setMessage(r.message);
      }
    } catch {
      setMessage("No se pudo contactar al servidor.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row" role="search">
        <label htmlFor="q" className="sr-only">
          Correo, teléfono o serial de tarjeta
        </label>
        <input
          id="q"
          name="q"
          autoComplete="off"
          placeholder="Correo completo, teléfono a 10 dígitos o serial"
          className={`${inputClass} mt-0`}
        />
        <button type="submit" disabled={busy} className="btn btn-oscuro shrink-0 disabled:opacity-70">
          {busy ? "Buscando…" : "Buscar"}
        </button>
      </form>
      <div aria-live="polite">{message ? <p className="text-sm text-tabaco/80">{message}</p> : null}</div>

      {results && results.length > 0 ? (
        <ul className="space-y-3">
          {results.map((c) => (
            <li key={c.card_id} className="rounded-2xl border border-tabaco/10 bg-papel p-5">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="font-display text-2xl text-tabaco">{c.display_name ?? "Cliente sin nombre"}</p>
                  <p className="text-sm text-tabaco/75">
                    {c.contact_masked} · serial {c.card_serial.slice(0, 8)}…
                  </p>
                  <p className="text-sm text-tabaco/75">
                    Desde {formatDateTime(c.enrolled_at)}
                    {c.last_earn_at ? ` · último sello ${formatDateTime(c.last_earn_at)}` : ""}
                  </p>
                </div>
                <p className="text-right font-semibold text-tabaco">
                  {c.stamps_balance} sellos
                  <span className="block text-sm font-normal text-tabaco/75">{c.rewards_balance} recompensa(s)</span>
                </p>
              </div>
              <details className="mt-4 border-t border-tabaco/10 pt-4">
                <summary className="cursor-pointer text-sm font-semibold text-arcilla-texto underline underline-offset-4">Ajustar sellos</summary>
                <AdjustForm cardId={c.card_id} />
              </details>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function AdjustForm({ cardId }: { cardId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(adjustStampsAction, { ok: false, message: null });
  // Una llave por formulario: reintentos tras un corte de red no duplican el ajuste.
  const [key] = useState(() => `adj-${crypto.randomUUID()}`);
  const err = state.fieldErrors ?? {};
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="cardId" value={cardId} />
      <input type="hidden" name="idempotencyKey" value={key} />
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <div>
          <label htmlFor={`${cardId}-delta`} className={labelClass}>
            Sellos (+/−)
          </label>
          <input id={`${cardId}-delta`} name="delta" type="number" min={-50} max={50} required className={inputClass} />
          {err.delta ? <p className={errorTextClass}>{err.delta}</p> : null}
        </div>
        <div>
          <label htmlFor={`${cardId}-reason`} className={labelClass}>
            Motivo
          </label>
          <input id={`${cardId}-reason`} name="reason" required minLength={5} maxLength={300} className={inputClass} />
          {err.reason ? <p className={errorTextClass}>{err.reason}</p> : null}
        </div>
      </div>
      <p className={hintClass}>Ejemplo: “Migración de tarjeta física con 4 sellos”. Queda en la bitácora con tu nombre.</p>
      <FormMessage state={state} />
      <button type="submit" disabled={pending || state.ok} className="btn btn-oscuro disabled:opacity-70">
        {pending ? "Aplicando…" : state.ok ? "Ajuste aplicado" : "Aplicar ajuste"}
      </button>
    </form>
  );
}
