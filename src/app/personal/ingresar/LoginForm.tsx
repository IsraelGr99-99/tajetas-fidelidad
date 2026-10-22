"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Status = { kind: "idle" } | { kind: "submitting" } | { kind: "error"; message: string } | { kind: "success" };

/**
 * El inicio de sesión ocurre en el navegador para que los límites por IP de
 * Supabase Auth apliquen a cada dispositivo (desde el servidor todos compartirían IP).
 * El servidor solo confía en la sesión tras verificar el JWT en cada petición.
 */
export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const errorId = useId();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    if (!email || !password) {
      setStatus({ kind: "error", message: "Escribe tu correo y tu contraseña." });
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setStatus({ kind: "error", message: "El acceso no está configurado en este entorno." });
      return;
    }

    setStatus({ kind: "submitting" });
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setStatus({ kind: "error", message: messageFor(error.code, error.status) });
        return;
      }
      setStatus({ kind: "success" });
      router.replace(next);
      router.refresh();
    } catch {
      setStatus({ kind: "error", message: "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo." });
    }
  }

  const busy = status.kind === "submitting" || status.kind === "success";

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5" aria-describedby={status.kind === "error" ? errorId : undefined}>
      <div>
        <label htmlFor="email" className="block text-sm font-semibold text-tabaco">
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          required
          disabled={busy}
          className="mt-2 block min-h-12 w-full rounded-xl border border-tabaco/25 bg-papel px-4 text-base text-tinta shadow-inner outline-none transition focus:border-tabaco focus-visible:outline-3 focus-visible:outline-mostaza disabled:opacity-60"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-semibold text-tabaco">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={busy}
          className="mt-2 block min-h-12 w-full rounded-xl border border-tabaco/25 bg-papel px-4 text-base text-tinta shadow-inner outline-none transition focus:border-tabaco focus-visible:outline-3 focus-visible:outline-mostaza disabled:opacity-60"
        />
      </div>

      <div aria-live="polite" className="min-h-6">
        {status.kind === "error" ? (
          <p id={errorId} role="alert" className="rounded-xl border border-alerta/30 bg-alerta/5 px-4 py-3 text-sm text-alerta">
            {status.message}
          </p>
        ) : null}
        {status.kind === "success" ? <p className="text-sm text-exito">Sesión iniciada. Abriendo la consola…</p> : null}
      </div>

      <button type="submit" disabled={busy} className="btn btn-oscuro w-full disabled:cursor-wait disabled:opacity-70">
        {status.kind === "submitting" ? "Verificando…" : status.kind === "success" ? "Entrando…" : "Iniciar sesión"}
      </button>
    </form>
  );
}

function messageFor(code: string | undefined, httpStatus: number | undefined): string {
  if (code === "over_request_rate_limit" || httpStatus === 429) {
    return "Demasiados intentos. Espera unos minutos antes de volver a intentar.";
  }
  if (code === "email_not_confirmed") return "Tu correo aún no está confirmado. Pide a administración que lo revise.";
  if (code === "user_banned") return "Esta cuenta está suspendida. Habla con administración.";
  // Mismo mensaje para usuario inexistente o contraseña errónea: no revela qué cuentas existen.
  return "Correo o contraseña incorrectos.";
}
