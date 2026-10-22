"use client";

import { LogoMark } from "@/components/brand/Logo";

/** Error genérico: nunca muestra detalles técnicos al usuario; el `digest` sirve para buscar en logs del servidor. */
export default function GlobalSegmentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="contenido" role="alert" className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 text-center text-tabaco">
      <LogoMark className="h-16 w-16" />
      <h1 className="mt-8 text-4xl">Algo se derramó.</h1>
      <p className="mt-4 leading-7 text-tabaco/75">No pudimos completar la acción. Inténtalo de nuevo en un momento.</p>
      {error.digest ? <p className="bitacora mt-4 text-tabaco/70">Referencia: {error.digest}</p> : null}
      <button type="button" onClick={reset} className="btn btn-oscuro mt-8">
        Reintentar
      </button>
    </main>
  );
}
