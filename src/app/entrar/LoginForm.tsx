"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { OTP_MAX_LENGTH, emailSchema, otpSchema } from "@/domain/customer/contact";
import { requestStaffCodeAction } from "@/actions/staff-login";
import { MfaChallenge, needsSecondFactor } from "@/components/staff/Mfa";
import { Captcha, CAPTCHA_SITE_KEY } from "@/components/ui/Captcha";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Mode = "password" | "code";
type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "code_sent"; email: string }
  | { kind: "error"; message: string; email?: string }
  | { kind: "mfa" }
  | { kind: "success" };

const fieldClass =
  "mt-2 block min-h-12 w-full rounded-xl border border-tabaco/25 bg-papel px-4 text-base text-tinta shadow-inner outline-none transition focus:border-tabaco focus-visible:outline-3 focus-visible:outline-mostaza disabled:opacity-60";

/**
 * Inicio de sesión del personal, en el navegador para que los límites por IP de
 * Supabase Auth apliquen a cada dispositivo. Dos opciones:
 *  - Contraseña (cuentas existentes).
 *  - Código por correo (personal invitado): el servidor solo lo envía a correos autorizados.
 * El servidor solo confía en la sesión tras verificar el JWT en cada petición.
 */
export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const errorId = useId();
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const needCaptcha = Boolean(CAPTCHA_SITE_KEY);

  function finish() {
    setStatus({ kind: "success" });
    router.replace(next);
    router.refresh();
  }

  /** Tras el primer factor: si la cuenta tiene verificación en dos pasos, pedir el código. */
  async function done() {
    if (await needsSecondFactor().catch(() => false)) return setStatus({ kind: "mfa" });
    finish();
  }

  async function onPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    if (!email || !password) return setStatus({ kind: "error", message: "Escribe tu correo y tu contraseña." });
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setStatus({ kind: "error", message: "El acceso no está configurado en este entorno." });
    if (needCaptcha && !captcha) return setStatus({ kind: "error", message: "Completa la verificación de seguridad." });
    setStatus({ kind: "submitting" });
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken: captcha ?? undefined } });
      setCaptchaReset((n) => n + 1);
      if (error) return setStatus({ kind: "error", message: messageFor(error.code, error.status) });
      await done();
    } catch {
      setStatus({ kind: "error", message: "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo." });
    }
  }

  async function onRequestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = emailSchema.safeParse(String(new FormData(event.currentTarget).get("email") ?? ""));
    if (!parsed.success) return setStatus({ kind: "error", message: parsed.error.issues[0]?.message ?? "Correo inválido." });
    if (needCaptcha && !captcha) return setStatus({ kind: "error", message: "Completa la verificación de seguridad." });
    setStatus({ kind: "submitting" });
    try {
      // El servidor decide si el correo está autorizado; aquí nunca se sabe la respuesta.
      const r = await requestStaffCodeAction(parsed.data, captcha);
      setCaptchaReset((n) => n + 1);
      if (!r.ok) return setStatus({ kind: "error", message: r.message });
      setStatus({ kind: "code_sent", email: parsed.data });
    } catch {
      setStatus({ kind: "error", message: "No hay conexión con el servidor." });
    }
  }

  async function onVerifyCode(event: FormEvent<HTMLFormElement>, email: string) {
    event.preventDefault();
    const parsed = otpSchema.safeParse(String(new FormData(event.currentTarget).get("code") ?? ""));
    if (!parsed.success) return setStatus({ kind: "error", message: parsed.error.issues[0]?.message ?? "Código inválido.", email });
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    setStatus({ kind: "submitting" });
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: parsed.data, type: "email" });
      if (error) return setStatus({ kind: "error", message: "El código no es correcto o ya caducó.", email });
      await done();
    } catch {
      setStatus({ kind: "error", message: "No hay conexión con el servidor.", email });
    }
  }

  const busy = status.kind === "submitting" || status.kind === "success";
  const pendingEmail = status.kind === "code_sent" ? status.email : status.kind === "error" ? status.email : undefined;

  const feedback = (
    <div aria-live="polite" className="min-h-6">
      {status.kind === "error" ? (
        <p id={errorId} role="alert" className="rounded-xl border border-alerta/30 bg-alerta/5 px-4 py-3 text-sm text-alerta">
          {status.message}
        </p>
      ) : null}
      {status.kind === "success" ? <p className="text-sm text-exito">Sesión iniciada. Abriendo la consola…</p> : null}
    </div>
  );

  if (status.kind === "mfa") return <MfaChallenge onDone={finish} />;

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Forma de entrar" className="grid grid-cols-2 gap-2 rounded-2xl bg-tabaco/5 p-1">
        {(
          [
            ["password", "Contraseña"],
            ["code", "Código por correo"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            disabled={busy}
            onClick={() => {
              setMode(value);
              setStatus({ kind: "idle" });
            }}
            className={`min-h-11 rounded-xl text-sm font-semibold transition ${mode === value ? "bg-papel text-tabaco shadow" : "text-tabaco/75"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "password" ? (
        <form onSubmit={onPassword} noValidate className="space-y-5" aria-describedby={status.kind === "error" ? errorId : undefined}>
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-tabaco">
              Correo
            </label>
            <input id="email" name="email" type="email" inputMode="email" autoComplete="username" required disabled={busy} className={fieldClass} />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-tabaco">
              Contraseña
            </label>
            <input id="password" name="password" type="password" autoComplete="current-password" required disabled={busy} className={fieldClass} />
          </div>
          <Captcha onToken={setCaptcha} resetKey={captchaReset} />
          {feedback}
          <button type="submit" disabled={busy} className="btn btn-oscuro w-full disabled:cursor-wait disabled:opacity-70">
            {status.kind === "submitting" ? "Verificando…" : status.kind === "success" ? "Entrando…" : "Iniciar sesión"}
          </button>
        </form>
      ) : pendingEmail ? (
        <form onSubmit={(e) => onVerifyCode(e, pendingEmail)} noValidate className="space-y-5">
          <p className="leading-7 text-tabaco/80">
            Si <strong className="text-tabaco">{pendingEmail}</strong> está autorizado para el personal, te llegará un código en unos segundos.
          </p>
          <div>
            <label htmlFor="code" className="block text-sm font-semibold text-tabaco">
              Código de verificación
            </label>
            <input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={OTP_MAX_LENGTH + 4}
              required
              disabled={busy}
              className={`${fieldClass} text-center font-mono text-2xl tracking-[0.3em]`}
            />
          </div>
          {feedback}
          <button type="submit" disabled={busy} className="btn btn-oscuro w-full disabled:cursor-wait disabled:opacity-70">
            {busy ? "Verificando…" : "Entrar"}
          </button>
          <button type="button" onClick={() => setStatus({ kind: "idle" })} disabled={busy} className="w-full text-sm text-tabaco/80 underline underline-offset-4">
            Usar otro correo
          </button>
        </form>
      ) : (
        <form onSubmit={onRequestCode} noValidate className="space-y-5">
          <div>
            <label htmlFor="code-email" className="block text-sm font-semibold text-tabaco">
              Correo con el que te invitaron
            </label>
            <input id="code-email" name="email" type="email" inputMode="email" autoComplete="email" required disabled={busy} className={fieldClass} />
          </div>
          <Captcha onToken={setCaptcha} resetKey={captchaReset} />
          {feedback}
          <button type="submit" disabled={busy} className="btn btn-oscuro w-full disabled:cursor-wait disabled:opacity-70">
            {busy ? "Enviando…" : "Enviarme el código"}
          </button>
        </form>
      )}
    </div>
  );
}

function messageFor(code: string | undefined, httpStatus: number | undefined): string {
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit" || httpStatus === 429) {
    return "Demasiados intentos. Espera unos minutos antes de volver a intentar.";
  }
  if (code === "email_not_confirmed") return "Tu correo aún no está confirmado. Pide a administración que lo revise.";
  if (code === "captcha_failed") return "La verificación de seguridad no pasó. Espera a que se complete e inténtalo de nuevo.";
  if (code === "user_banned") return "Esta cuenta está suspendida. Habla con administración.";
  // Mismo mensaje para usuario inexistente o contraseña errónea: no revela qué cuentas existen.
  return "Correo o contraseña incorrectos.";
}
