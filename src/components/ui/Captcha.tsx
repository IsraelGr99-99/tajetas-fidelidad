"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Cloudflare Turnstile (gratuito) para frenar el abuso del envío de códigos.
 * Solo se muestra si `NEXT_PUBLIC_TURNSTILE_SITE_KEY` está configurada; el secreto
 * se configura en Supabase Auth (Attack Protection → CAPTCHA), que valida el token.
 */
export const CAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let loader: Promise<void> | null = null;
function loadScript() {
  loader ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile"));
    document.head.appendChild(s);
  });
  return loader;
}

/** Mensaje claro para los errores más comunes de Turnstile (códigos de Cloudflare). */
function captchaErrorMessage(code: string): string {
  if (code.startsWith("1102")) return "La verificación de seguridad no está autorizada para este sitio. Administración debe agregar este dominio en Cloudflare Turnstile.";
  if (code.startsWith("1101")) return "La llave de la verificación de seguridad no es válida. Avisa a administración.";
  if (code.startsWith("300") || code.startsWith("600")) return "No pudimos verificar que eres una persona. Recarga la página e inténtalo de nuevo.";
  return "La verificación de seguridad falló. Recarga la página e inténtalo de nuevo.";
}

/** Widget de verificación. `resetKey` cambia para pedir un token nuevo (cada token es de un solo uso). */
export function Captcha({ onToken, resetKey = 0 }: { onToken: (token: string | null) => void; resetKey?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const widget = useRef<string | null>(null);
  const callback = useRef(onToken);

  useEffect(() => {
    callback.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!CAPTCHA_SITE_KEY || !box.current) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile) return;
        widget.current = window.turnstile.render(box.current, {
          sitekey: CAPTCHA_SITE_KEY,
          language: "es",
          theme: "light",
          callback: (t: string) => {
            setError(null);
            callback.current(t);
          },
          "expired-callback": () => callback.current(null),
          "error-callback": (code: string) => {
            callback.current(null);
            setError(`${captchaErrorMessage(String(code))} (código ${code})`);
            return true;
          },
        });
      })
      .catch(() => {
        callback.current(null);
        setError("No se pudo cargar la verificación de seguridad. Revisa tu conexión.");
      });
    return () => {
      cancelled = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, []);

  useEffect(() => {
    if (resetKey && widget.current) {
      window.turnstile?.reset(widget.current);
      callback.current(null);
    }
  }, [resetKey]);

  if (!CAPTCHA_SITE_KEY) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 text-sm font-semibold text-slate-700">Verificación de seguridad</p>
      <div ref={box} className="min-h-16" aria-label="Verificación de seguridad" />
      {error ? (
        <p role="alert" className="mt-2 text-sm text-alerta">
          {error}
        </p>
      ) : null}
    </div>
  );
}
