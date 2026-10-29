"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const fieldClass =
  "mt-2 block min-h-12 w-full max-w-xs rounded-xl border border-tabaco/25 bg-papel px-4 text-center font-mono text-2xl tracking-[0.3em] text-tinta outline-none focus:border-tabaco focus-visible:outline-3 focus-visible:outline-mostaza";

const challengeFieldClass =
  "mt-2 block min-h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-center font-mono text-2xl tracking-[0.3em] text-slate-950 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-600/15";

/** ¿La sesión necesita completar el segundo paso (aal1 → aal2)? */
export async function needsSecondFactor(): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.currentLevel === "aal1" && data?.nextLevel === "aal2";
}

/** Paso de código de la app autenticadora (después de la contraseña o el código por correo). */
export function MfaChallenge({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("totp") ?? "").replace(/\D/g, "");
    if (code.length !== 6) return setError("Escribe los 6 dígitos de tu app de autenticación.");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp?.[0];
    if (!factor) {
      setBusy(false);
      return setError("No encontramos tu factor de verificación. Pide ayuda a otro administrador.");
    }
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    setBusy(false);
    if (verifyError) return setError("El código no es correcto o ya cambió. Intenta con el siguiente.");
    onDone();
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <p className="text-sm leading-6 text-slate-600">Abre tu app de autenticación (Google Authenticator, 1Password, etc.) y escribe el código de Loyalty.</p>
      <div>
        <label htmlFor="totp" className="block text-sm font-semibold text-slate-800">
          Código de 6 dígitos
        </label>
        <input id="totp" name="totp" inputMode="numeric" autoComplete="one-time-code" maxLength={8} autoFocus required className={challengeFieldClass} />
      </div>
      <div aria-live="polite">
        {error ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
            {error}
          </p>
        ) : null}
      </div>
      <button type="submit" disabled={busy} className="inline-flex min-h-13 w-full items-center justify-center rounded-full bg-[#2949da] px-6 text-base font-bold text-white shadow-[0_10px_24px_-10px_rgb(41_73_218/.7)] transition hover:bg-[#1f3bc0] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-orange-400 disabled:cursor-wait disabled:opacity-80">
        {busy ? "Verificando…" : "Verificar"}
      </button>
    </form>
  );
}

type Setup = { state: "loading" } | { state: "off" } | { state: "on" } | { state: "enrolling"; factorId: string; qr: string; secret: string };

/** Activar o desactivar la verificación en dos pasos (TOTP) desde Cuenta. */
export function MfaSetup() {
  const router = useRouter();
  const [setup, setSetup] = useState<Setup>({ state: "loading" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    void supabase.auth.mfa.listFactors().then(({ data }) => setSetup({ state: data?.totp?.length ? "on" : "off" }));
  }, []);

  async function start() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    // Limpia intentos anteriores sin terminar.
    const { data: list } = await supabase.auth.mfa.listFactors();
    for (const f of list?.all ?? []) if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Loyalty ${new Date().toISOString().slice(0, 10)}` });
    setBusy(false);
    if (enrollError || !data) return setError("No se pudo iniciar la activación. Verifica que la autenticación en dos pasos esté habilitada en el proyecto.");
    setSetup({ state: "enrolling", factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (setup.state !== "enrolling") return;
    const code = String(new FormData(event.currentTarget).get("totp") ?? "").replace(/\D/g, "");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: setup.factorId, code });
    setBusy(false);
    if (verifyError) return setError("El código no coincide. Revisa la hora de tu teléfono e intenta con el siguiente.");
    setSetup({ state: "on" });
    router.refresh();
  }

  return (
    <section aria-labelledby="mfa-titulo" className="rounded-3xl bg-papel p-6">
      <h2 id="mfa-titulo" className="text-2xl text-tabaco">
        Verificación en dos pasos
      </h2>
      {setup.state === "loading" ? <p className="mt-2 text-tabaco/75">Revisando…</p> : null}
      {setup.state === "on" ? (
        <p className="mt-2 leading-7 text-tabaco/80">
          Activada. Para administrar el negocio te pediremos el código de tu app además de la contraseña o el correo.
        </p>
      ) : null}
      {setup.state === "off" ? (
        <>
          <p className="mt-2 leading-7 text-tabaco/80">
            Protege el acceso a clientes, finanzas y personal: aunque alguien obtenga tu contraseña, no podrá entrar sin tu teléfono.
          </p>
          <button type="button" onClick={start} disabled={busy} className="btn btn-oscuro mt-4 disabled:opacity-70">
            {busy ? "Preparando…" : "Activar verificación en dos pasos"}
          </button>
        </>
      ) : null}
      {setup.state === "enrolling" ? (
        <form onSubmit={confirm} className="mt-4 grid gap-6 sm:grid-cols-[12rem_1fr]">
          {/* El QR lo genera Supabase Auth como SVG en data URL. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qr} alt="Código QR para tu app de autenticación" className="h-48 w-48 rounded-2xl bg-white p-2" />
          <div className="space-y-3">
            <p className="leading-7 text-tabaco/80">1. Escanéalo con tu app de autenticación. Si no puedes, escribe esta clave:</p>
            <p className="dato break-all rounded-xl bg-crema px-3 py-2 text-sm text-tabaco">{setup.secret}</p>
            <label htmlFor="totp-setup" className="block text-sm font-semibold text-tabaco">
              2. Escribe el código que muestra la app
            </label>
            <input id="totp-setup" name="totp" inputMode="numeric" autoComplete="one-time-code" maxLength={8} required className={fieldClass} />
            <button type="submit" disabled={busy} className="btn btn-oscuro disabled:opacity-70">
              {busy ? "Verificando…" : "Confirmar y activar"}
            </button>
          </div>
        </form>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 rounded-xl border border-alerta/30 bg-alerta/5 px-4 py-3 text-sm text-alerta">
          {error}
        </p>
      ) : null}
    </section>
  );
}
