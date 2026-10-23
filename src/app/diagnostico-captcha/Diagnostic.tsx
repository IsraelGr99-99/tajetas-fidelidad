"use client";

import { useState } from "react";
import { Captcha, CAPTCHA_SITE_KEY } from "@/components/ui/Captcha";
import { type CaptchaDiagnosis, diagnoseCaptchaAction } from "./actions";

export function Diagnostic() {
  const [result, setResult] = useState<CaptchaDiagnosis | null>(null);
  const [busy, setBusy] = useState(false);

  async function onToken(token: string | null) {
    if (!token || busy) return;
    setBusy(true);
    setResult(await diagnoseCaptchaAction(token));
    setBusy(false);
  }

  if (!CAPTCHA_SITE_KEY) return <p className="text-alerta">No hay NEXT_PUBLIC_TURNSTILE_SITE_KEY configurada.</p>;
  return (
    <div className="space-y-4">
      <p className="text-sm text-tabaco/80">
        Site Key que usa la app: <span className="dato">{CAPTCHA_SITE_KEY.slice(0, 10)}…{CAPTCHA_SITE_KEY.slice(-4)}</span>. Compárala con la del widget en
        Cloudflare.
      </p>
      <Captcha onToken={onToken} />
      {busy ? <p role="status">Consultando a Cloudflare…</p> : null}
      {result ? (
        <div role="status" className={`rounded-2xl border p-4 ${result.ok ? "border-exito/40 bg-exito/5 text-exito" : "border-alerta/40 bg-alerta/5 text-alerta"}`}>
          <p className="font-semibold">{result.ok ? "Las llaves coinciden" : "Las llaves no coinciden"}</p>
          <p className="mt-1 text-sm">{result.detail}</p>
          {result.errorCodes?.length ? <p className="mt-1 text-sm">Códigos de Cloudflare: {result.errorCodes.join(", ")}</p> : null}
          {result.hostname ? <p className="mt-1 text-sm">Dominio del token: {result.hostname}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
