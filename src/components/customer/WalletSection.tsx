"use client";

import { useState } from "react";
import { addToGoogleWalletAction } from "@/app/tarjeta/actions";

/**
 * Guardar la tarjeta en Google Wallet. No afirma que se guardó: Google confirma en
 * su propia pantalla. Apple Wallet queda como “no configurado” hasta producción.
 */
export function WalletSection({ googleConfigured, googleMode, hasGooglePass, businessSlug }: { googleConfigured: boolean; googleMode: "demo" | "public"; hasGooglePass: boolean; businessSlug: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addToGoogle() {
    setBusy(true);
    setError(null);
    try {
      const r = await addToGoogleWalletAction(businessSlug);
      if (r.ok) window.location.assign(r.url);
      else {
        setError(r.error);
        setBusy(false);
      }
    } catch {
      setError("No hay conexión. Inténtalo de nuevo.");
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="wallet-titulo" className="rounded-[2rem] border border-tabaco/10 bg-papel p-6">
      <h2 id="wallet-titulo" className="text-2xl text-tabaco">
        Guárdala en tu teléfono
      </h2>

      {googleConfigured ? (
        <>
          <p className="mt-2 leading-7 text-tabaco/75">
            {hasGooglePass
              ? "Tu tarjeta ya está vinculada con Google Wallet y se actualiza sola con cada sello. Si la borraste de la app, puedes agregarla otra vez."
              : "Agrégala a Google Wallet para ver tus sellos sin abrir el navegador. Se actualiza sola con cada visita."}
          </p>
          <button
            type="button"
            onClick={addToGoogle}
            disabled={busy}
            className="mt-4 inline-flex min-h-12 items-center gap-3 rounded-full bg-[#1f1f1f] px-5 font-semibold text-white transition hover:bg-black disabled:opacity-70"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="3" fill="#fff" />
              <path d="M3 9h18" stroke="#1f1f1f" strokeWidth="2" />
            </svg>
            {busy ? "Abriendo Google Wallet…" : hasGooglePass ? "Abrir en Google Wallet" : "Agregar a Google Wallet"}
          </button>
          {googleMode === "demo" ? (
            <p className="mt-3 text-sm text-tabaco/75">
              Modo de prueba: solo funciona con cuentas de Google registradas como usuarios de prueba del emisor.
            </p>
          ) : null}
          <p className="mt-2 text-sm text-tabaco/75">Para sumar sellos sigue mostrando el código QR de esta página: el pase no lleva un código fijo por seguridad.</p>
          {error ? (
            <p role="alert" className="mt-3 rounded-xl border border-alerta/30 bg-alerta/5 px-4 py-3 text-sm text-alerta">
              {error}
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-2 leading-7 text-tabaco/75">Google Wallet todavía no está habilitado para este negocio.</p>
      )}

      <p className="mt-4 flex flex-wrap gap-2">
        <span className="bitacora rounded-full border border-tabaco/25 px-3 py-1.5 text-[0.65rem] text-tabaco/75">Apple Wallet · próximamente</span>
      </p>
    </section>
  );
}
