"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { type CardStatus, type QrResult, cardStatusAction, issueQrAction } from "@/app/tarjeta/actions";
import { PassportCard } from "@/components/loyalty/PassportCard";

type Purpose = "identify" | "redeem";
type View =
  | { state: "loading"; purpose: Purpose }
  | { state: "ready"; purpose: Purpose; svg: string; expiresAt: number; ref: string }
  | { state: "scanned"; purpose: Purpose }
  | { state: "celebrate"; message: string; detail: string; before: number; after: number; rewards: number; reward: boolean }
  | { state: "paused"; purpose: Purpose }
  | { state: "confirm_redeem" }
  | { state: "error"; message: string };

/** Renovaciones automáticas seguidas (~10 min) antes de pausar, para no agotar el límite de códigos. */
const MAX_AUTO_REFRESH = 4;
const POLL_MS = 3000;

/**
 * QR de la tarjeta: aparece solo al abrir la página, se renueva mientras la
 * pantalla está visible y detecta cuando el barista lo escanea y registra el
 * sello o el canje, para mostrar el resultado sin recargar.
 */
export function CardQr({
  cardId,
  rewardsAvailable,
  stampsBalance,
  stampsRequired,
  rewardDescription,
}: {
  cardId: string;
  rewardsAvailable: number;
  stampsBalance: number;
  stampsRequired: number;
  rewardDescription: string;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>({ state: "loading", purpose: "identify" });
  const refreshes = useRef(0);
  // Versión de la tarjeta vista por primera vez; un cambio posterior significa un movimiento nuevo.
  const version = useRef<number | null>(null);
  const lastStamps = useRef(stampsBalance);
  const lastRewards = useRef(rewardsAvailable);
  const [seconds, setSeconds] = useState(0);

  const request = useCallback(
    async (purpose: Purpose, automatic = false) => {
      if (!automatic) refreshes.current = 0;
      setView({ state: "loading", purpose });
      let r: QrResult;
      try {
        r = await issueQrAction({ cardId, purpose });
      } catch {
        return setView({ state: "error", message: "No hay conexión. Revisa tu internet." });
      }
      if (!r.ok) return setView({ state: "error", message: r.error });
      setView({ state: "ready", purpose: r.purpose, svg: r.svg, expiresAt: Date.parse(r.expiresAt), ref: r.ref });
    },
    [cardId],
  );

  // Al abrir: QR listo sin tocar nada (el estado inicial ya es "cargando").
  useEffect(() => {
    let cancelled = false;
    issueQrAction({ cardId, purpose: "identify" })
      .then((r) => {
        if (cancelled) return;
        if (r.ok) setView({ state: "ready", purpose: r.purpose, svg: r.svg, expiresAt: Date.parse(r.expiresAt), ref: r.ref });
        else setView({ state: "error", message: r.error });
      })
      .catch(() => !cancelled && setView({ state: "error", message: "No hay conexión. Revisa tu internet." }));
    return () => {
      cancelled = true;
    };
  }, [cardId]);

  // Cuenta regresiva + renovación + sondeo del estado.
  useEffect(() => {
    if (view.state !== "ready" && view.state !== "scanned") return;
    const current = view;
    let busy = false;

    const tick = async () => {
      if (current.state === "ready") {
        const left = Math.max(0, Math.ceil((current.expiresAt - Date.now()) / 1000));
        setSeconds(left);
        if (left <= 5) {
          clearInterval(id);
          if (document.visibilityState === "visible" && refreshes.current < MAX_AUTO_REFRESH) {
            refreshes.current += 1;
            void request(current.purpose, true);
          } else setView({ state: "paused", purpose: current.purpose });
          return;
        }
      }
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      let s: CardStatus;
      try {
        s = await cardStatusAction({ cardId, ref: current.state === "ready" ? current.ref : null });
      } catch {
        busy = false;
        return;
      }
      busy = false;
      if (!s.ok) return;
      if (version.current === null) {
        version.current = s.version;
        lastStamps.current = s.stampsBalance;
        lastRewards.current = s.rewardsBalance;
      } else if (s.version !== version.current) {
        version.current = s.version;
        clearInterval(id);
        const e = s.lastEvent;
        const message =
          e?.eventType === "reward_issued" ? "¡Completaste tu tarjeta!" : e?.eventType === "redeem" ? "¡Disfruta tu recompensa!" : "¡Sello registrado!";
        const detail =
          e?.eventType === "redeem"
            ? s.rewardsBalance === 0
              ? "Ya no tienes recompensas pendientes."
              : `Te quedan ${plural(s.rewardsBalance, "recompensa", "recompensas")}.`
            : s.rewardsBalance > 0
              ? `Tienes ${plural(s.rewardsBalance, "recompensa lista", "recompensas listas")} para canjear.`
              : `Llevas ${plural(s.stampsBalance, "sello", "sellos")} de ${stampsRequired}.`;
        const reward = s.rewardsBalance > lastRewards.current;
        // Si completó la tarjeta, el sello que la cerró se dibuja antes de pasar a la recompensa.
        const before = reward ? Math.min(lastStamps.current, stampsRequired) : lastStamps.current;
        const after = reward ? stampsRequired : s.stampsBalance;
        setView({ state: "celebrate", message, detail, before, after, rewards: s.rewardsBalance, reward });
        lastStamps.current = s.stampsBalance;
        lastRewards.current = s.rewardsBalance;
        router.refresh();
        return;
      }
      if (current.state === "ready" && s.tokenState === "scanned") setView({ state: "scanned", purpose: current.purpose });
    };

    const id = setInterval(() => void tick(), current.state === "ready" ? 1000 : POLL_MS);
    void tick();
    return () => clearInterval(id);
  }, [view, cardId, request, router, stampsRequired]);

  const isRedeem = (view.state === "ready" || view.state === "loading" || view.state === "scanned") && view.purpose === "redeem";

  return (
    <section
      aria-labelledby="qr-titulo"
      className={`relative rounded-[2rem] p-6 text-crema transition-colors duration-500 sm:p-8 ${isRedeem ? "bg-arcilla-texto" : "bg-tabaco"}`}
    >
      {/* Muescas de pase de abordar */}
      <span aria-hidden="true" className="absolute -left-3 top-24 h-6 w-6 rounded-full bg-crema" />
      <span aria-hidden="true" className="absolute -right-3 top-24 h-6 w-6 rounded-full bg-crema" />
      <div className="flex items-center justify-between gap-3">
        <h2 id="qr-titulo" className="text-2xl">
          {isRedeem ? "Código para canjear" : "Muestra este código al pagar"}
        </h2>
        {view.state === "ready" ? (
          <span className="shrink-0 rounded-full bg-crema/10 px-3 py-1 text-xs font-semibold tabular-nums" aria-live="off">
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
          </span>
        ) : null}
      </div>

      {view.state === "loading" || view.state === "ready" ? (
        <div className="mt-5">
          <div className="mx-auto grid aspect-square w-full max-w-64 place-items-center overflow-hidden rounded-3xl bg-papel p-3 [&_svg]:h-auto [&_svg]:w-full">
            {view.state === "ready" ? (
              <div
                className="w-full"
                role="img"
                aria-label={isRedeem ? "Código QR de canje" : "Código QR de tu tarjeta"}
                // SVG generado en el servidor por la librería `qrcode` a partir de un token aleatorio.
                dangerouslySetInnerHTML={{ __html: view.svg }}
              />
            ) : (
              <span role="status" className="text-sm text-tabaco/75">
                Generando…
              </span>
            )}
          </div>
          <p className="mt-4 text-center text-sm text-crema/80">
            {isRedeem ? "Muéstralo cuando vayas a recibir tu bebida." : "Cambia cada 2 minutos y solo sirve una vez."}
          </p>
          {isRedeem ? (
            <button type="button" onClick={() => request("identify")} className="mx-auto mt-3 block text-sm text-crema/85 underline underline-offset-4">
              Volver al código normal
            </button>
          ) : rewardsAvailable > 0 ? (
            <button type="button" onClick={() => setView({ state: "confirm_redeem" })} className="btn btn-primario mt-5 w-full">
              Canjear mi recompensa
            </button>
          ) : null}
        </div>
      ) : null}

      {view.state === "scanned" ? (
        <div role="status" className="mt-5 rounded-3xl bg-crema/10 p-6 text-center">
          <p className="font-display text-2xl">Código escaneado</p>
          <p className="mt-2 text-crema/80">{view.purpose === "redeem" ? "El barista está preparando tu recompensa…" : "El barista está registrando tu compra…"}</p>
        </div>
      ) : null}

      {view.state === "celebrate" ? (
        <div role="status" className="mt-5 space-y-4">
          <div className="text-center">
            <p className="font-display text-3xl text-mostaza">{view.message}</p>
            <p className="mt-1 text-crema/85">{view.detail}</p>
          </div>
          <PassportCard
            stampsBalance={view.after}
            stampsRequired={stampsRequired}
            rewardsAvailable={view.rewards}
            rewardDescription={rewardDescription}
            highlightFrom={view.after > view.before ? view.before : view.after}
            highlightReward={view.reward}
          />
          <button type="button" onClick={() => request("identify")} className="btn btn-primario w-full">
            Listo
          </button>
        </div>
      ) : null}

      {view.state === "confirm_redeem" ? (
        <div role="group" aria-labelledby="confirmar-canje" className="mt-5 rounded-2xl bg-crema/10 p-5">
          <p id="confirmar-canje" className="font-semibold">
            ¿Canjear 1 recompensa ahora?
          </p>
          <p className="mt-2 text-sm leading-6 text-crema/80">Se genera un código de canje. Muéstralo al barista al recibir tu bebida.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => request("redeem")} className="btn btn-primario">
              Sí, canjear
            </button>
            <button type="button" onClick={() => request("identify")} className="btn btn-contorno">
              Ahora no
            </button>
          </div>
        </div>
      ) : null}

      {view.state === "paused" ? (
        <div className="mt-5 text-center">
          <p className="leading-7 text-crema/80">Pausamos el código para cuidar tu tarjeta.</p>
          <button type="button" onClick={() => request(view.purpose)} className="btn btn-primario mt-4 w-full">
            Mostrar código
          </button>
        </div>
      ) : null}

      {view.state === "error" ? (
        <div className="mt-5">
          <p role="alert" className="rounded-xl bg-crema px-4 py-3 text-sm text-alerta">
            {view.message}
          </p>
          <button type="button" onClick={() => request("identify")} className="btn btn-contorno mt-4 w-full">
            Reintentar
          </button>
        </div>
      ) : null}
    </section>
  );
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}
