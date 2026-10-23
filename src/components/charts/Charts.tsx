"use client";

import { useId, useState } from "react";
import { formatMxn } from "@/lib/format";

/**
 * Gráficas mínimas sin librería: una serie por gráfica, un solo color, valores en
 * tinta de texto (no en el color de la serie), tooltip al pasar el cursor o enfocar
 * con teclado y tabla alternativa para lectores de pantalla.
 */

export type DayPoint = { day: string; value: number };

const dayLabel = (iso: string) => new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

export function DailyBars({ points, title, emptyText }: { points: DayPoint[]; title: string; emptyText: string }) {
  const [active, setActive] = useState<number | null>(null);
  const tableId = useId();
  const max = Math.max(0, ...points.map((p) => p.value));
  const total = points.reduce((n, p) => n + p.value, 0);

  if (max === 0) return <p className="rounded-2xl border border-dashed border-tabaco/25 p-6 text-center text-tabaco/75">{emptyText}</p>;

  const W = 640;
  const H = 180;
  const gap = 2;
  const bw = Math.max(2, (W - gap * (points.length - 1)) / points.length);
  const hovered = active !== null ? points[active] : null;

  return (
    <figure className="space-y-2">
      <figcaption className="sr-only">
        {title}. Total {formatMxn(total)}. Tabla de datos disponible a continuación.
      </figcaption>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H + 20}`} className="h-auto w-full" role="img" aria-label={`${title}: total ${formatMxn(total)}`} aria-describedby={tableId}>
          {/* Línea base y referencia del máximo (recesivas) */}
          <line x1="0" x2={W} y1={H} y2={H} stroke="currentColor" className="text-tabaco/25" strokeWidth="1" />
          <line x1="0" x2={W} y1="0.5" y2="0.5" stroke="currentColor" className="text-tabaco/10" strokeDasharray="4 4" />
          {points.map((p, i) => {
            const h = max ? (p.value / max) * (H - 8) : 0;
            const x = i * (bw + gap);
            // Extremo de datos redondeado (4px o menos si la barra es angosta), anclado a la base.
            const r = Math.min(4, bw / 2, h);
            return (
              <g key={p.day}>
                {/* Zona de interacción más grande que la barra */}
                <rect
                  x={x - gap / 2}
                  y="0"
                  width={bw + gap}
                  height={H}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${dayLabel(p.day)}: ${formatMxn(p.value)}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="cursor-pointer outline-none"
                />
                {h > 0 ? (
                  <path
                    d={`M${x},${H} V${H - h + r} a${r},${r} 0 0 1 ${r},-${r} H${x + bw - r} a${r},${r} 0 0 1 ${r},${r} V${H} Z`}
                    className={active === i ? "fill-tabaco" : "fill-arcilla-texto"}
                    pointerEvents="none"
                  />
                ) : null}
              </g>
            );
          })}
          <text x="0" y={H + 16} className="fill-tabaco/75 text-[11px]">
            {dayLabel(points[0].day)}
          </text>
          <text x={W} y={H + 16} textAnchor="end" className="fill-tabaco/75 text-[11px]">
            {dayLabel(points[points.length - 1].day)}
          </text>
        </svg>
        {hovered ? (
          <div
            role="status"
            className="pointer-events-none absolute top-0 rounded-xl bg-tinta px-3 py-2 text-sm text-crema shadow-lg"
            style={{ left: `${Math.min(80, ((active ?? 0) / points.length) * 100)}%` }}
          >
            <p className="font-semibold">{formatMxn(hovered.value)}</p>
            <p className="text-crema/80">{dayLabel(hovered.day)}</p>
          </div>
        ) : null}
      </div>
      <details className="text-sm text-tabaco/80">
        <summary className="cursor-pointer">Ver como tabla</summary>
        <table id={tableId} className="mt-2 w-full max-w-sm text-left">
          <thead>
            <tr>
              <th scope="col" className="py-1 font-semibold">
                Día
              </th>
              <th scope="col" className="py-1 text-right font-semibold">
                Monto
              </th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.day} className="border-t border-tabaco/10">
                <td className="py-1">{dayLabel(p.day)}</td>
                <td className="py-1 text-right tabular-nums">{formatMxn(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

export type BarItem = { label: string; value: number; note?: string; tag?: string };

/** Ranking horizontal: etiqueta y valor en texto, barra como apoyo visual. */
export function RankBars({ items, emptyText, format = formatMxn }: { items: BarItem[]; emptyText: string; format?: (n: number) => string }) {
  const max = Math.max(0, ...items.map((i) => i.value));
  if (items.length === 0 || max === 0) return <p className="rounded-2xl border border-dashed border-tabaco/25 p-6 text-center text-tabaco/75">{emptyText}</p>;
  return (
    <ol className="space-y-3">
      {items.map((item, i) => (
        <li key={`${item.label}-${i}`} title={`${item.label}: ${format(item.value)}${item.note ? ` · ${item.note}` : ""}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-semibold text-tabaco">
              {item.label}
              {item.tag ? <span className="bitacora ml-2 rounded bg-mostaza px-1.5 py-0.5 text-[0.6rem]">{item.tag}</span> : null}
            </span>
            <span className="shrink-0 tabular-nums text-tabaco">{format(item.value)}</span>
          </div>
          <div className="mt-1 h-2.5 rounded-full bg-tabaco/[0.06]" aria-hidden="true">
            <div className="h-full rounded-full bg-arcilla-texto" style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }} />
          </div>
          {item.note ? <p className="mt-0.5 text-xs text-tabaco/75">{item.note}</p> : null}
        </li>
      ))}
    </ol>
  );
}
