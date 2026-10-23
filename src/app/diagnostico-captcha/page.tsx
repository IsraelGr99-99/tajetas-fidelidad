import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Diagnostic } from "./Diagnostic";

export const metadata: Metadata = { title: "Diagnóstico de CAPTCHA" };

/** SOLO DESARROLLO: no existe en producción. */
export default function CaptchaDiagnosticPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main id="contenido" className="mx-auto max-w-lg space-y-4 px-5 py-12 text-tabaco">
      <h1 className="text-3xl">Diagnóstico de CAPTCHA</h1>
      <p className="leading-7 text-tabaco/80">
        Completa la verificación. La página valida el token directamente con Cloudflare usando <span className="dato">TURNSTILE_SECRET_KEY</span> de tu
        .env.local y te dice si coincide con la Site Key de la app.
      </p>
      <Diagnostic />
    </main>
  );
}
