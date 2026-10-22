"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { type QrResult, issueQrAction } from "@/app/tarjeta/actions";

type Purpose = "identify" | "redeem";
type View =
  | { state: "idle" }
  | { state: "confirm_redeem" }
  | { state: "loading"; purpose: Purpose }
  | { state: "ready"; purpose: Purpose; svg: string; expiresAt: number }
  | { state: "expired"; purpose: Purpose }
  | { state: "error"; message: string };

/** Renovaciones automáticas máximas (~10 min con QR de 2 min) para no agotar el límite de frecuencia. */
const MAX_AUTO_REFRESH = 4;

/**
 * Muestra el QR temporal de la tarjeta. Se genera bajo demanda, se renueva solo
 * mientras la pantalla está visible y deja de renovarse tras unos minutos.
 * El QR de canje es la confirmación explícita del cliente.
 */
export function CardQr({ cardId, rewardsAvailable }: { cardId: string; rewardsAvailable: number }) {
  const router = useRouter();
  const [view, setView] = useState<View>({ state: "idle" });
  const [now, setNow] = useState(() => Date.now());
  const refreshes = useRef(0);

  const request = useCallback(
    async (purpose: Purpose, automatic = false) => {
      if (!automatic) refreshes.current = 0;
      setView({ state: "loading", purpose });
      let result: QrResult;
      try {
        result = await issueQrAction({ cardId, purpose });
      } catch {
        setView({ state: "error", message: "No hay conexión. Revisa tu internet e inténtalo de nuevo." });
        return;
      }
      if (!result.ok) {
        setView({ state: "error", message: result.error });
        if (result.code === "no_reward_available") router.refresh();
        return;
      }
      setView({ state: "ready", purpose: result.purpose, svg: result.svg, expiresAt: Date.parse(result.expiresAt) });
    },
    [cardId, router],
  );

  // Reloj de cuenta regresiva y renovación automática (5 s antes de caducar).
  useEffect(() => {
    if (view.state !== "ready") return;
    const { expiresAt, purpose } = view;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      const remaining = expiresAt - t;
      if (remaining > 5_000) return;
      clearInterval(id);
      if (document.visibilityState === "visible" && refreshes.current < MAX_AUTO_REFRESH) {
        refreshes.current += 1;
        void request(purpose, true);
      } else {
        setView({ state: "expired", purpose });
      }
    }, 1000);
    return () => clearInterval(id);
  }, [view, request]);

  const seconds = view.state === "ready" ? Math.max(0, Math.ceil((view.expiresAt - now) / 1000)) : 0;

  return (
    <section aria-labelledby="qr-titulo" className="rounded-[2rem] bg-tabaco p-6 text-crema sm:p-8">
      <h2 id="qr-titulo" className="text-2xl">
        {view.state === "ready" && view.purpose === "redeem" ? "Código para canjear" : "Tu código para la barra"}
      </h2>

      {view.state === "idle" ? (
        <>
          <p className="mt-2 leading-7 text-crema/80">Muéstralo al pagar para sumar tu sello. Cambia cada 2 minutos y solo sirve una vez.</p>
          <div className="mt-6 flex flex-col gap-3">
            <button type="button" onClick={() => request("identify")} className="btn btn-primario">
              Mostrar mi código
            </button>
            {rewardsAvailable > 0 ? (
              <button type="button" onClick={() => setView({ state: "confirm_redeem" })} className="btn btn-contorno">
                Canjear mi recompensa
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {view.state === "confirm_redeem" ? (
        <div role="group" aria-labelledby="confirmar-canje" className="mt-4 rounded-2xl bg-crema/10 p-5">
          <p id="confirmar-canje" className="font-semibold">¿Quieres canjear 1 recompensa ahora?</p>
          <p className="mt-2 text-sm leading-6 text-crema/80">
            Al confirmar se genera un código de canje. Muéstralo al barista solo cuando vayas a recibir tu bebida.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={() => request("redeem")} className="btn btn-primario">
              Sí, quiero canjear
            </button>
            <button type="button" onClick={() => setView({ state: "idle" })} className="btn btn-contorno">
              Ahora no
            </button>
          </div>
        </div>
      ) : null}

      {view.state === "loading" ? (
        <div role="status" className="mt-6 grid aspect-square w-full max-w-64 place-items-center rounded-3xl bg-crema/10 mx-auto">
          <span className="text-sm text-crema/80">Generando código…</span>
        </div>
      ) : null}

      {view.state === "ready" ? (
        <div className="mt-6">
          <div
            className="mx-auto w-full max-w-64 overflow-hidden rounded-3xl bg-papel p-3 [&_svg]:h-auto [&_svg]:w-full"
            role="img"
            aria-label={view.purpose === "redeem" ? "Código QR de canje" : "Código QR de tu tarjeta"}
            // SVG generado en el servidor por la librería `qrcode` a partir de un token aleatorio.
            dangerouslySetInnerHTML={{ __html: view.svg }}
          />
          <p className="mt-4 text-center text-sm text-crema/80" aria-live="polite">
            {seconds > 5 ? `Válido por ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : "Renovando…"}
          </p>
          <div className="mt-4 flex justify-center gap-4 text-sm">
            <button type="button" onClick={() => router.refresh()} className="font-semibold text-mostaza underline underline-offset-4">
              Ya me lo escanearon
            </button>
            <button type="button" onClick={() => setView({ state: "idle" })} className="text-crema/80 underline underline-offset-4">
              Ocultar
            </button>
          </div>
        </div>
      ) : null}

      {view.state === "expired" ? (
        <div className="mt-4">
          <p className="leading-7 text-crema/80">El código caducó para cuidar tu tarjeta.</p>
          <button type="button" onClick={() => request(view.purpose)} className="btn btn-primario mt-4 w-full">
            Generar uno nuevo
          </button>
        </div>
      ) : null}

      {view.state === "error" ? (
        <div className="mt-4">
          <p role="alert" className="rounded-xl bg-crema px-4 py-3 text-sm text-alerta">
            {view.message}
          </p>
          <button type="button" onClick={() => setView({ state: "idle" })} className="btn btn-contorno mt-4 w-full">
            Volver
          </button>
        </div>
      ) : null}
    </section>
  );
}
