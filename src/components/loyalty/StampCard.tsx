import { LogoMark } from "@/components/brand/Logo";
import { describeProgress } from "@/domain/loyalty/campaign";

type StampCardProps = {
  stampsBalance: number;
  stampsRequired: number;
  rewardsAvailable: number;
  rewardDescription: string;
  /** Muestra una marca visible de “ejemplo” cuando la tarjeta no pertenece a un cliente real. */
  sample?: boolean;
  className?: string;
};

/**
 * Tarjeta de sellos tipo boleto de viaje. Presentacional: los números vienen del servidor.
 */
export function StampCard({ stampsBalance, stampsRequired, rewardsAvailable, rewardDescription, sample, className }: StampCardProps) {
  const progress = describeProgress({ stampsBalance, stampsRequired, rewardsAvailable });

  return (
    <figure
      className={`relative overflow-hidden rounded-[var(--radius-ticket)] bg-papel p-6 text-tabaco shadow-[0_24px_60px_-20px_rgb(36_25_20/0.55)] ${className ?? ""}`}
      aria-label={`Tarjeta de fidelidad${sample ? " de ejemplo" : ""}: ${progress.label}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="bitacora text-arcilla-texto">
            Bitácora del viajero
            {sample ? (
              <span className="ml-2 inline-block -rotate-3 rounded border border-arcilla-texto px-1.5 py-0.5 text-[0.6rem] font-bold">Ejemplo</span>
            ) : null}
          </p>
          <p className="mt-1 font-display text-2xl leading-tight">Café Nómada</p>
        </div>
        <LogoMark className="h-11 w-11" />
      </div>

      <ol className="mt-6 grid grid-cols-5 gap-2.5" aria-hidden="true">
        {Array.from({ length: stampsRequired }, (_, i) => {
          const done = i < progress.filled;
          return (
            <li
              key={i}
              className={`grid aspect-square place-items-center rounded-full border text-xs font-bold ${
                done ? "border-arcilla bg-arcilla text-crema" : "border-dashed border-tabaco/40 text-tabaco/75"
              }`}
            >
              {done ? <StampGlyph /> : i + 1}
            </li>
          );
        })}
        <li className="grid aspect-square place-items-center rounded-full bg-mostaza text-tabaco" title={rewardDescription}>
          <CupGlyph />
        </li>
      </ol>

      <div className="mt-6 border-t border-dashed border-tabaco/25 pt-4">
        <figcaption className="font-semibold">{progress.label}</figcaption>
        <p className="mt-1 text-sm text-tabaco/75">Recompensa: {rewardDescription.toLowerCase()}</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-tabaco/10" role="presentation">
          <div className="h-full rounded-full bg-mostaza" style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
        </div>
      </div>

    </figure>
  );
}

function StampGlyph() {
  return (
    <svg viewBox="0 0 20 20" className="h-1/2 w-1/2" fill="currentColor" aria-hidden="true">
      <path d="M10 1.5 12 8l6.5 2-6.5 2-2 6.5L8 12l-6.5-2L8 8l2-6.5Z" />
    </svg>
  );
}

function CupGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z" />
      <path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16M8 3c0 1.5 1 1.5 1 3M12 3c0 1.5 1 1.5 1 3" />
    </svg>
  );
}
