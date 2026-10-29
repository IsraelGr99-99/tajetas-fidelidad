"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { OTP_MAX_LENGTH, emailSchema, otpSchema } from "@/domain/customer/contact";
import { checkStaffCodeAction } from "@/actions/staff-login";
import { MfaChallenge, needsSecondFactor } from "@/components/staff/Mfa";
import { Captcha, CAPTCHA_SITE_KEY } from "@/components/ui/Captcha";
import { captchaFailedMessage } from "@/lib/auth-errors";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Mode = "password" | "code";
type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "code_sent"; email: string }
  | { kind: "error"; message: string; email?: string }
  | { kind: "mfa" }
  | { kind: "success" };

const inputClass =
  "block min-h-12 w-full rounded-2xl border border-slate-200 bg-white/90 px-4 text-base text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/15 disabled:bg-slate-50 disabled:opacity-60";
const fieldClass = `mt-2 ${inputClass}`;
const labelClass = "block text-sm font-semibold text-slate-800";
const submitClass =
  "inline-flex min-h-13 w-full items-center justify-center gap-2.5 rounded-full bg-[#2949da] px-6 text-base font-bold text-white shadow-[0_10px_24px_-10px_rgb(41_73_218/.7)] transition hover:-translate-y-px hover:bg-[#1f3bc0] hover:shadow-[0_14px_30px_-10px_rgb(41_73_218/.8)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-orange-400 disabled:cursor-wait disabled:opacity-80";

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
  const hintId = useId();
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [showPassword, setShowPassword] = useState(false);
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
      if (error) return setStatus({ kind: "error", message: error.code === "captcha_failed" ? captchaFailedMessage(error.message) : messageFor(error.code, error.status) });
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
      // 1) El servidor revisa si el correo es de personal activo o invitado.
      const check = await checkStaffCodeAction(parsed.data);
      if (!check.ok) return setStatus({ kind: "error", message: check.message });
      // 2) Solo entonces el navegador pide el código, con su propio token de CAPTCHA
      //    (Supabase valida el token del visitante en su propia petición).
      if (check.eligible) {
        const supabase = createSupabaseBrowserClient();
        if (!supabase) return setStatus({ kind: "error", message: "El acceso no está configurado en este entorno." });
        const { error } = await supabase.auth.signInWithOtp({
          email: parsed.data,
          options: { shouldCreateUser: true, captchaToken: captcha ?? undefined },
        });
        setCaptchaReset((n) => n + 1);
        if (error) return setStatus({ kind: "error", message: sendErrorMessage(error.code, error.status, error.message) });
      } else {
        setCaptchaReset((n) => n + 1);
      }
      // Mismo mensaje en ambos casos.
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

  // Al fallar, el foco va al mensaje para que se lea y se corrija sin buscarlo.
  useEffect(() => {
    if (status.kind === "error") errorRef.current?.focus();
  }, [status]);

  function chooseMode(value: Mode) {
    setMode(value);
    setStatus({ kind: "idle" });
  }

  const feedback = (
    <div aria-live="polite">
      {status.kind === "error" ? (
        <div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <span aria-hidden="true" className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-red-600 text-xs font-bold text-white">!</span>
          <p id={errorId} ref={errorRef} tabIndex={-1} role="alert" className="text-sm leading-6 text-red-800 outline-none">
            {status.message}
          </p>
        </div>
      ) : null}
      {status.kind === "success" ? (
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <Spinner /> Sesión iniciada. Abriendo la consola…
        </p>
      ) : null}
    </div>
  );

  if (status.kind === "mfa") {
    return (
      <div className="space-y-4">
        <Steps current={2} labels={["Primer acceso", "Verificación en dos pasos"]} />
        <MfaChallenge onDone={finish} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div role="group" aria-label="Forma de entrar" aria-describedby={hintId} className="grid grid-cols-2 gap-1 rounded-full bg-slate-100 p-1">
          {modes.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              disabled={busy}
              onClick={() => chooseMode(value)}
              className={`min-h-11 rounded-full px-3 text-sm font-bold transition disabled:opacity-60 ${mode === value ? "bg-white text-slate-950 shadow-[0_4px_14px_-6px_rgb(11_18_32/.35)]" : "text-slate-500 hover:text-slate-900"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <p id={hintId} className="mt-2 text-center text-xs text-slate-500">{modes.find((m) => m.value === mode)?.hint}</p>
      </div>

      {mode === "password" ? (
        <form onSubmit={onPassword} noValidate className="space-y-5" aria-describedby={status.kind === "error" ? errorId : undefined}>
          <div>
            <label htmlFor="email" className={labelClass}>
              Correo
            </label>
            <input id="email" name="email" type="email" inputMode="email" autoComplete="username" placeholder="nombre@tunegocio.com" required disabled={busy} className={fieldClass} />
          </div>
          <div>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="password" className={labelClass}>
                Contraseña
              </label>
              <button type="button" onClick={() => chooseMode("code")} disabled={busy} className="-my-2 inline-flex min-h-10 items-center text-sm font-semibold text-blue-700 underline-offset-4 hover:underline">
                ¿No la recuerdas?
              </button>
            </div>
            <div className="relative mt-2">
              <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required disabled={busy} className={`${inputClass} pr-24`} />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-pressed={showPassword}
                aria-controls="password"
                className="absolute right-1.5 top-1/2 min-h-9 -translate-y-1/2 rounded-full px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>
          <Captcha onToken={setCaptcha} resetKey={captchaReset} />
          {feedback}
          <button type="submit" disabled={busy} className={submitClass}>
            {busy ? <Spinner /> : null}
            {status.kind === "submitting" ? "Verificando…" : status.kind === "success" ? "Entrando…" : "Iniciar sesión"}
          </button>
        </form>
      ) : pendingEmail ? (
        <form onSubmit={(e) => onVerifyCode(e, pendingEmail)} noValidate className="space-y-5">
          <Steps current={2} labels={["Tu correo", "Código"]} />
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="min-w-0 text-sm text-slate-600">
              Enviado a <strong className="block truncate text-slate-900">{pendingEmail}</strong>
            </p>
            <button type="button" onClick={() => setStatus({ kind: "idle" })} disabled={busy} className="min-h-9 flex-none rounded-full px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50">
              Usar otro correo
            </button>
          </div>
          <p className="text-sm leading-6 text-slate-600">
            Si el correo está autorizado para el personal, te llegará un código en unos segundos. Revisa también la carpeta de spam.
          </p>
          <div>
            <label htmlFor="code" className={labelClass}>
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
              className={`${fieldClass} min-h-14 text-center font-mono text-2xl tracking-[0.3em]`}
            />
          </div>
          {feedback}
          <button type="submit" disabled={busy} className={submitClass}>
            {busy ? <Spinner /> : null}
            {busy ? "Verificando…" : "Entrar"}
          </button>
        </form>
      ) : (
        <form onSubmit={onRequestCode} noValidate className="space-y-5">
          <Steps current={1} labels={["Tu correo", "Código"]} />
          <div>
            <label htmlFor="code-email" className={labelClass}>
              Correo con el que te invitaron
            </label>
            <input id="code-email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="nombre@tunegocio.com" required disabled={busy} className={fieldClass} />
            <p className="mt-2 text-xs text-slate-500">Te enviaremos un código de un solo uso. No necesitas contraseña.</p>
          </div>
          <Captcha onToken={setCaptcha} resetKey={captchaReset} />
          {feedback}
          <button type="submit" disabled={busy} className={submitClass}>
            {busy ? <Spinner /> : null}
            {busy ? "Enviando…" : "Enviarme el código"}
          </button>
        </form>
      )}
    </div>
  );
}

const modes = [
  { value: "password", label: "Contraseña", hint: "Si ya tienes cuenta con contraseña." },
  { value: "code", label: "Código por correo", hint: "Si te invitaron o no recuerdas tu contraseña." },
] as const;

function Spinner() {
  return <span aria-hidden="true" className="h-4 w-4 flex-none animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" />;
}

/** Indicador de pasos; solo orienta, no cambia el flujo. */
function Steps({ current, labels }: { current: 1 | 2; labels: [string, string] }) {
  return (
    <ol aria-label="Pasos para entrar" className="flex items-center gap-3 text-xs font-semibold">
      {labels.map((label, index) => {
        const step = index + 1;
        const state = step < current ? "done" : step === current ? "current" : "next";
        return (
          <li key={label} aria-current={state === "current" ? "step" : undefined} className={`flex items-center gap-2 ${state === "next" ? "text-slate-400" : "text-slate-800"}`}>
            {index > 0 ? <span aria-hidden="true" className="h-px w-6 bg-slate-300" /> : null}
            <span aria-hidden="true" className={`grid h-6 w-6 place-items-center rounded-full text-[11px] ${state === "current" ? "bg-blue-600 text-white" : state === "done" ? "bg-emerald-600 text-white" : "border border-slate-300"}`}>
              {state === "done" ? "✓" : step}
            </span>
            {label}
          </li>
        );
      })}
    </ol>
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

function sendErrorMessage(code: string | undefined, httpStatus: number | undefined, message?: string): string {
  if (code === "captcha_failed") return captchaFailedMessage(message);
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || httpStatus === 429) {
    return "Se alcanzó el límite de envíos. Espera unos minutos antes de pedir otro código.";
  }
  return "No pudimos enviar el código. Inténtalo de nuevo en un momento.";
}
