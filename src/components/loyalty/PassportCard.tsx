"use client";

import { useState } from "react";
import Image from "next/image";
import { LogoMark } from "@/components/brand/Logo";
import { describeProgress } from "@/domain/loyalty/campaign";
import type { CardTheme } from "@/domain/loyalty/branding";

/**
 * Tarjeta como página de pasaporte: cada visita estampa una parada distinta del
 * viaje y una ruta punteada las une hasta la bebida de recompensa.
 * Cuando el saldo sube (p. ej. tras actualizarse en vivo), el sello nuevo “cae”
 * con un golpe de tinta. Los números vienen siempre del servidor.
 */

type Props = {
  stampsBalance: number;
  stampsRequired: number;
  rewardsAvailable: number;
  rewardDescription: string;
  /** Marca visible de tarjeta de ejemplo (no pertenece a un cliente). */
  sample?: boolean;
  /** Secuencia de entrada: los sellos existentes caen uno tras otro al montar. */
  intro?: boolean;
  /** Al montar, anima los sellos desde este índice (p. ej. el sello recién registrado). */
  highlightFrom?: number;
  /** Al montar, anima la casilla de recompensa (tarjeta recién completada). */
  highlightReward?: boolean;
  className?: string;
  theme?: CardTheme;
};

const GLYPHS: { name: string; path: React.ReactNode }[] = [
  { name: "brújula", path: <><circle cx="12" cy="12" r="8" /><path d="m15 9-2 5-4 1 2-5 4-1Z" /></> },
  { name: "montaña", path: <path d="m3 18 6-9 3 4 2-3 5 8H3Z" /> },
  { name: "ola", path: <path d="M3 14c2-3 4-3 6 0s4 3 6 0 4-3 6 0M3 18c2-3 4-3 6 0s4 3 6 0 4-3 6 0" /> },
  { name: "vinilo", path: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.5" /><path d="M12 6.5a5.5 5.5 0 0 1 5.5 5.5" /></> },
  { name: "libro", path: <path d="M4 6c3-1.5 5-1.5 8 0v12c-3-1.5-5-1.5-8 0V6Zm8 0c3-1.5 5-1.5 8 0v12c-3-1.5-5-1.5-8 0" /> },
  { name: "avión", path: <path d="m3 13 7-1 4-7h2l-2 7 5 1 1-2h1l-1 4 1 4h-1l-1-2-5 1 2 7h-2l-4-7-7-1v-2Z" /> },
  { name: "estrella", path: <path d="m12 4 2.3 5 5.2.6-3.9 3.5 1.1 5.2L12 15.7l-4.7 2.6 1.1-5.2-3.9-3.5 5.2-.6L12 4Z" /> },
  { name: "pin", path: <><path d="M12 21s-6-6-6-11a6 6 0 1 1 12 0c0 5-6 11-6 11Z" /><circle cx="12" cy="10" r="2" /></> },
  { name: "moka", path: <path d="M8 5h8l-1 3H9L8 5Zm1 3h6l2 11H7L9 8Zm8 3c2 0 2.5 1.2 2.4 2.4-.1 1.3-1 2-2 2.1M11 3h2" /> },
];
const TILT = [-8, 5, -3, 9, -6, 4, -10, 7, -2];
const COLS = 5;

function slotPosition(index: number, total: number) {
  const row = Math.floor(index / COLS);
  const rows = Math.ceil(total / COLS);
  // Lectura natural: cada fila de izquierda a derecha; la ruta baja al inicio de la siguiente.
  const col = index % COLS;
  return { x: ((col + 0.5) / COLS) * 100, y: ((row + 0.5) / rows) * 100, rows };
}

export function PassportCard({
  stampsBalance,
  stampsRequired,
  rewardsAvailable,
  rewardDescription,
  sample,
  intro,
  highlightFrom,
  highlightReward,
  className,
  theme,
}: Props) {
  const progress = describeProgress({ stampsBalance, stampsRequired, rewardsAvailable });
  const total = stampsRequired + 1; // + la casilla de recompensa
  const { rows } = slotPosition(0, total);

  // Sellos que deben animarse: los nuevos respecto al render anterior
  // (patrón de React “ajustar estado cuando cambian las props”).
  const [seen, setSeen] = useState({ filled: progress.filled, rewards: rewardsAvailable });
  const [fresh, setFresh] = useState<{ from: number; reward: boolean; key: number }>({
    from: intro ? 0 : (highlightFrom ?? progress.filled),
    reward: Boolean(highlightReward),
    key: 0,
  });
  if (seen.filled !== progress.filled || seen.rewards !== rewardsAvailable) {
    if (rewardsAvailable > seen.rewards) setFresh({ from: stampsRequired, reward: true, key: fresh.key + 1 });
    else if (progress.filled > seen.filled) setFresh({ from: seen.filled, reward: false, key: fresh.key + 1 });
    setSeen({ filled: progress.filled, rewards: rewardsAvailable });
  }

  const route = Array.from({ length: total }, (_, i) => slotPosition(i, total));

  if (theme) return <figure aria-label={`Tarjeta de fidelidad de ${theme.businessName}: ${progress.label}`} className={`relative overflow-hidden rounded-[2rem] p-6 shadow-[0_25px_55px_-25px_rgba(15,23,42,.5)] sm:p-8 ${className ?? ""}`} style={{ backgroundColor: theme.background, color: theme.text }}>
    <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full opacity-20 blur-3xl" style={{ backgroundColor: theme.secondary }} />
    <div className="relative flex items-center gap-4">
      {theme.logoUrl ? <Image src={theme.logoUrl} width={64} height={64} alt={`Logo de ${theme.businessName}`} unoptimized className="h-16 w-16 shrink-0 rounded-2xl bg-white object-contain p-1.5" /> : <span aria-hidden="true" className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-3xl font-black" style={{ backgroundColor: theme.secondary, color: theme.background }}>{theme.businessName.slice(0, 1)}</span>}
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] opacity-75">Tarjeta de fidelidad</p><p className="mt-1 text-2xl font-bold leading-tight">{theme.businessName}</p></div>
    </div>
    <div aria-hidden="true" className="relative mt-8 grid grid-cols-5 gap-2 sm:gap-3">
      {Array.from({ length: stampsRequired }, (_, i) => {
        const done = i < progress.filled;
        return <span key={i} className="grid aspect-square place-items-center rounded-full border-2 text-sm font-bold sm:text-lg" style={{ backgroundColor: done ? theme.secondary : "transparent", borderColor: theme.secondary, color: done ? theme.background : theme.text }} aria-hidden="true">{done ? "✓" : i + 1}</span>;
      })}
    </div>
    <figcaption className="relative mt-7 flex flex-wrap items-end justify-between gap-3 border-t pt-5" style={{ borderColor: `${theme.text}55` }}>
      <span><strong className="block text-xl">{progress.hasReward ? "¡Recompensa disponible!" : `${progress.filled} de ${stampsRequired} sellos`}</strong><span className="mt-1 block text-sm opacity-80">{progress.hasReward ? rewardDescription : progress.remaining === 1 ? "Te falta 1 visita" : `Faltan ${progress.remaining} visitas`}</span></span>
      <span className="rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide" style={{ backgroundColor: theme.secondary, color: theme.background }}>{rewardsAvailable > 0 ? `${rewardsAvailable} por canjear` : "Sigue sumando"}</span>
    </figcaption>
  </figure>;

  return (
    <figure
      className={`papel-pasaporte relative overflow-hidden rounded-[2rem] p-5 text-tabaco shadow-[0_30px_60px_-30px_rgb(36_25_20/0.55),0_0_0_1px_rgb(61_44_36/0.06)] sm:p-6 ${className ?? ""}`}
      aria-label={`Tarjeta de fidelidad${sample ? " de ejemplo" : ""}: ${progress.label}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-2xl leading-tight">Bitácora del viajero</p>
          <p className="mt-0.5 text-sm text-tabaco/75">
            Café Nómada{sample ? <span className="ml-2 rounded-full border border-arcilla-texto/60 px-2 py-0.5 text-xs font-semibold text-arcilla-texto">Ejemplo</span> : null}
          </p>
        </div>
        <LogoMark className="h-11 w-11 shrink-0" />
      </div>

      <div className="relative mt-5" style={{ aspectRatio: `${COLS} / ${rows * 1.15}` }} aria-hidden="true">
        {/* Ruta del viaje */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          <polyline
            points={route.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.6"
            strokeDasharray="1.6 2.4"
            vectorEffect="non-scaling-stroke"
            className="text-tabaco/30"
            style={{ strokeWidth: 1.5 }}
          />
        </svg>

        {route.map((pos, i) => {
          const isReward = i === stampsRequired;
          const done = !isReward && i < progress.filled;
          const animate = done && i >= fresh.from;
          const delay = intro && !fresh.key ? 250 + i * 140 : (i - fresh.from) * 160;
          const glyph = GLYPHS[i % GLYPHS.length];
          return (
            <div
              key={`${i}-${animate ? fresh.key : "s"}`}
              className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center"
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${(100 / COLS) * 0.78}%`, aspectRatio: "1" }}
            >
              {isReward ? (
                <span
                  className={`grid h-full w-full place-items-center rounded-full bg-mostaza text-tabaco ${rewardsAvailable > 0 ? "[animation:brillo_2.4s_ease-in-out_infinite]" : ""} ${
                    fresh.reward ? "[animation:sello-cae_700ms_cubic-bezier(.2,.9,.3,1.2)_both,brillo_2.4s_ease-in-out_700ms_infinite]" : ""
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z" />
                    <path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16M8 3c0 1.5 1 1.5 1 3M12 3c0 1.5 1 1.5 1 3" />
                  </svg>
                </span>
              ) : done ? (
                <span className="relative grid h-full w-full place-items-center" style={{ ["--giro" as string]: `${TILT[i % TILT.length]}deg` }}>
                  {animate ? (
                    <span
                      className="absolute inset-0 rounded-full bg-arcilla/40"
                      style={{ animation: `tinta 600ms ease-out ${delay + 380}ms both` }}
                    />
                  ) : null}
                  <span
                    className="grid h-full w-full place-items-center rounded-full border-[2.5px] border-arcilla-texto bg-arcilla/[0.08] text-arcilla-texto mix-blend-multiply"
                    style={{
                      transform: `rotate(${TILT[i % TILT.length]}deg)`,
                      boxShadow: "inset 0 0 0 3px rgb(251 247 244), inset 0 0 0 4.5px rgb(138 73 53 / 0.85)",
                      animation: animate ? `sello-cae 620ms cubic-bezier(.2,.9,.3,1.25) ${delay}ms both` : undefined,
                    }}
                  >
                    <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {glyph.path}
                    </svg>
                  </span>
                </span>
              ) : (
                <span className="grid h-full w-full place-items-center rounded-full border-2 border-dashed border-tabaco/30 bg-papel/70 text-xs font-semibold text-tabaco/70">
                  {i + 1}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <figcaption className="mt-5 flex flex-wrap items-baseline justify-between gap-2 border-t border-dashed border-tabaco/25 pt-4">
        <span className="font-display text-xl">{progress.hasReward ? "¡Tu bebida te espera!" : `${progress.filled} de ${stampsRequired} sellos`}</span>
        <span className="text-sm text-tabaco/75">
          {progress.hasReward ? progress.label : progress.remaining === 1 ? "Te falta 1 para tu recompensa" : `Faltan ${progress.remaining} para ${rewardDescription.toLowerCase()}`}
        </span>
      </figcaption>
    </figure>
  );
}
