"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { type ContactChannel, OTP_MAX_LENGTH, emailSchema, mxPhoneSchema, otpSchema } from "@/domain/customer/contact";
import { Captcha, CAPTCHA_SITE_KEY } from "@/components/ui/Captcha";
import { captchaFailedMessage } from "@/lib/auth-errors";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Step = { name: "contact" } | { name: "code"; channel: ContactChannel; destination: string; display: string };
type Feedback = { kind: "error" | "info"; text: string } | null;

const RESEND_SECONDS = 60;

/**
 * Acceso del cliente con código de un solo uso (sin contraseña). Sirve tanto para
 * crear la tarjeta como para volver a entrar. Corre en el navegador para que los
 * límites por IP de Supabase Auth apliquen a cada dispositivo.
 */
export function AccessFlow({ phoneEnabled }: { phoneEnabled: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ name: "contact" });
  const [channel, setChannel] = useState<ContactChannel>("email");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [cooldown, setCooldown] = useState(0);
  const feedbackId = useId();
  const codeRef = useRef<HTMLInputElement>(null);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (step.name === "code") codeRef.current?.focus();
  }, [step.name]);

  async function sendCode(target: ContactChannel, destination: string) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) throw new Error("not_configured");
    // Con CAPTCHA activo en Supabase Auth, cada envío necesita un token nuevo (un solo uso).
    const captchaToken = captcha ?? undefined;
    const { error } =
      target === "email"
        ? await supabase.auth.signInWithOtp({ email: destination, options: { shouldCreateUser: true, captchaToken } })
        : await supabase.auth.signInWithOtp({ phone: destination, options: { shouldCreateUser: true, channel: "sms", captchaToken } });
    setCaptchaReset((n) => n + 1);
    return error;
  }

  async function onContactSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    const raw = String(new FormData(event.currentTarget).get("contact") ?? "");
    const parsed = channel === "email" ? emailSchema.safeParse(raw) : mxPhoneSchema.safeParse(raw);
    if (!parsed.success) {
      setFeedback({ kind: "error", text: parsed.error.issues[0]?.message ?? "Revisa el dato." });
      return;
    }
    if (CAPTCHA_SITE_KEY && !captcha) {
      setFeedback({ kind: "error", text: "Completa la verificación de seguridad." });
      return;
    }
    setBusy(true);
    try {
      const error = await sendCode(channel, parsed.data);
      if (error) {
        setFeedback({ kind: "error", text: (error.code === "captcha_failed" ? captchaFailedMessage(error.message) : sendErrorMessage(error.code, error.status)) });
        return;
      }
      setStep({ name: "code", channel, destination: parsed.data, display: channel === "email" ? parsed.data : formatPhone(parsed.data) });
      setCooldown(RESEND_SECONDS);
    } catch {
      setFeedback({ kind: "error", text: "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo." });
    } finally {
      setBusy(false);
    }
  }

  async function onCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step.name !== "code") return;
    setFeedback(null);
    const parsed = otpSchema.safeParse(String(new FormData(event.currentTarget).get("code") ?? ""));
    if (!parsed.success) {
      setFeedback({ kind: "error", text: parsed.error.issues[0]?.message ?? "Revisa el código." });
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    try {
      const { error } =
        step.channel === "email"
          ? await supabase.auth.verifyOtp({ email: step.destination, token: parsed.data, type: "email" })
          : await supabase.auth.verifyOtp({ phone: step.destination, token: parsed.data, type: "sms" });
      if (error) {
        setFeedback({ kind: "error", text: verifyErrorMessage(error.code, error.status) });
        setBusy(false);
        return;
      }
      setFeedback({ kind: "info", text: "Código correcto. Abriendo tu tarjeta…" });
      router.refresh();
    } catch {
      setFeedback({ kind: "error", text: "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo." });
      setBusy(false);
    }
  }

  async function onResend() {
    if (step.name !== "code" || cooldown > 0) return;
    if (CAPTCHA_SITE_KEY && !captcha) {
      setFeedback({ kind: "error", text: "Completa la verificación de seguridad para reenviar." });
      return;
    }
    setFeedback(null);
    setBusy(true);
    try {
      const error = await sendCode(step.channel, step.destination);
      if (error) setFeedback({ kind: "error", text: (error.code === "captcha_failed" ? captchaFailedMessage(error.message) : sendErrorMessage(error.code, error.status)) });
      else {
        setFeedback({ kind: "info", text: "Te enviamos un código nuevo." });
        setCooldown(RESEND_SECONDS);
      }
    } catch {
      setFeedback({ kind: "error", text: "No hay conexión con el servidor." });
    } finally {
      setBusy(false);
    }
  }

  const feedbackBox = (
    <div aria-live="polite" className="min-h-6">
      {feedback ? (
        <p
          id={feedbackId}
          role={feedback.kind === "error" ? "alert" : "status"}
          className={`rounded-xl border px-4 py-3 text-sm ${
            feedback.kind === "error" ? "border-alerta/30 bg-alerta/5 text-alerta" : "border-exito/30 bg-exito/5 text-exito"
          }`}
        >
          {feedback.text}
        </p>
      ) : null}
    </div>
  );

  if (step.name === "code") {
    return (
      <form onSubmit={onCodeSubmit} noValidate className="space-y-5">
        <p className="leading-7 text-tabaco/80">
          Enviamos un código de verificación a <strong className="text-tabaco">{step.display}</strong>. Caduca en 10 minutos.
        </p>
        <div>
          <label htmlFor="code" className="block text-sm font-semibold text-tabaco">
            Código de verificación
          </label>
          <input
            ref={codeRef}
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={OTP_MAX_LENGTH + 4}
            required
            disabled={busy}
            aria-describedby={feedback ? feedbackId : undefined}
            className="mt-2 block min-h-14 w-full rounded-xl border border-tabaco/25 bg-papel px-4 text-center font-mono text-2xl tracking-[0.3em] text-tinta outline-none focus:border-tabaco focus-visible:outline-3 focus-visible:outline-mostaza disabled:opacity-60"
          />
        </div>
        <Captcha onToken={setCaptcha} resetKey={captchaReset} />
        {feedbackBox}
        <button type="submit" disabled={busy} className="btn btn-oscuro w-full disabled:cursor-wait disabled:opacity-70">
          {busy ? "Verificando…" : "Verificar código"}
        </button>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <button
            type="button"
            onClick={onResend}
            disabled={busy || cooldown > 0}
            className="font-semibold text-tabaco underline underline-offset-4 disabled:no-underline disabled:opacity-60"
          >
            {cooldown > 0 ? `Reenviar código en ${cooldown} s` : "Reenviar código"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep({ name: "contact" });
              setFeedback(null);
            }}
            disabled={busy}
            className="text-tabaco/80 underline underline-offset-4"
          >
            Usar otro {step.channel === "email" ? "correo" : "teléfono"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={onContactSubmit} noValidate className="space-y-5">
      <fieldset>
        <legend className="text-sm font-semibold text-tabaco">¿Cómo quieres identificarte?</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl bg-tabaco/5 p-1">
          {(
            [
              ["email", "Correo"],
              ["phone", "Teléfono"],
            ] as const
          ).map(([value, label]) => {
            const disabled = value === "phone" && !phoneEnabled;
            return (
              <label
                key={value}
                className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl text-sm font-semibold transition has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-mostaza ${
                  channel === value ? "bg-papel text-tabaco shadow" : "text-tabaco/75"
                } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
              >
                <input
                  type="radio"
                  name="channel"
                  value={value}
                  checked={channel === value}
                  disabled={disabled || busy}
                  onChange={() => {
                    setChannel(value);
                    setFeedback(null);
                  }}
                  className="sr-only"
                />
                {label}
              </label>
            );
          })}
        </div>
        {!phoneEnabled ? (
          <p className="mt-2 text-sm text-tabaco/75">Por ahora el registro es solo con correo. El teléfono estará disponible más adelante.</p>
        ) : null}
      </fieldset>

      <div>
        <label htmlFor="contact" className="block text-sm font-semibold text-tabaco">
          {channel === "email" ? "Tu correo" : "Tu teléfono celular (10 dígitos)"}
        </label>
        <input
          key={channel}
          id="contact"
          name="contact"
          type={channel === "email" ? "email" : "tel"}
          inputMode={channel === "email" ? "email" : "tel"}
          autoComplete={channel === "email" ? "email" : "tel-national"}
          placeholder={channel === "email" ? "nombre@correo.com" : "222 123 4567"}
          required
          disabled={busy}
          aria-describedby={feedback ? feedbackId : undefined}
          className="mt-2 block min-h-12 w-full rounded-xl border border-tabaco/25 bg-papel px-4 text-base text-tinta outline-none placeholder:text-tabaco/45 focus:border-tabaco focus-visible:outline-3 focus-visible:outline-mostaza disabled:opacity-60"
        />
        <p className="mt-2 text-sm text-tabaco/75">Te enviaremos un código de verificación. Solo guardamos este dato.</p>
      </div>
      <Captcha onToken={setCaptcha} resetKey={captchaReset} />
      {feedbackBox}
      <button type="submit" disabled={busy} className="btn btn-oscuro w-full disabled:cursor-wait disabled:opacity-70">
        {busy ? "Enviando…" : "Enviarme el código"}
      </button>
    </form>
  );
}

function formatPhone(e164: string) {
  const d = e164.replace("+52", "");
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

function sendErrorMessage(code: string | undefined, status: number | undefined) {
  if (code === "over_email_send_rate_limit" || code === "over_sms_send_rate_limit" || code === "over_request_rate_limit" || status === 429) {
    return "Ya pediste varios códigos. Espera unos minutos antes de pedir otro.";
  }
  if (code === "sms_send_failed" || code === "phone_provider_disabled") return "Por ahora no podemos enviar SMS. Usa tu correo.";
  if (code === "email_address_invalid") return "Ese correo no parece válido.";
  if (code === "signup_disabled") return "El registro está cerrado por el momento.";
  return "No pudimos enviar el código. Inténtalo de nuevo en un momento.";
}

function verifyErrorMessage(code: string | undefined, status: number | undefined) {
  if (code === "otp_expired") return "El código no es correcto o ya caducó. Revísalo o pide uno nuevo.";
  if (code === "over_request_rate_limit" || status === 429) return "Demasiados intentos. Espera unos minutos.";
  return "El código no es correcto o ya caducó. Revísalo o pide uno nuevo.";
}
