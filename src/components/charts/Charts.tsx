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
  // Los ids de React llevan símbolos que no sirven dentro de url(#…).
  const gradientId = `bars-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const max = Math.max(0, ...points.map((p) => p.value));
  const total = points.reduce((n, p) => n + p.value, 0);

  if (max === 0) return <EmptyChart text={emptyText} />;

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
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#7c5cff" />
              <stop offset="100%" stopColor="#2949da" />
            </linearGradient>
          </defs>
          {/* Línea base y referencias (recesivas) */}
          <line x1="0" x2={W} y1={H} y2={H} stroke="currentColor" className="text-slate-300" strokeWidth="1" />
          <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="currentColor" className="text-slate-200" strokeDasharray="4 4" />
          <line x1="0" x2={W} y1="0.5" y2="0.5" stroke="currentColor" className="text-slate-200" strokeDasharray="4 4" />
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
                    fill={active === i ? "#0b1220" : `url(#${gradientId})`}
                    opacity={active === null || active === i ? 1 : 0.55}
                    pointerEvents="none"
                  />
                ) : null}
              </g>
            );
          })}
          <text x="0" y={H + 16} className="fill-slate-500 text-[11px]">
            {dayLabel(points[0].day)}
          </text>
          <text x={W} y={H + 16} textAnchor="end" className="fill-slate-500 text-[11px]">
            {dayLabel(points[points.length - 1].day)}
          </text>
        </svg>
        {hovered ? (
          <div
            role="status"
            className="pointer-events-none absolute top-0 rounded-2xl bg-slate-950 px-3.5 py-2 text-sm text-white shadow-[0_14px_30px_-12px_rgb(11_18_32/.6)]"
            style={{ left: `${Math.min(80, ((active ?? 0) / points.length) * 100)}%` }}
          >
            <p className="font-semibold">{formatMxn(hovered.value)}</p>
            <p className="text-white/70">{dayLabel(hovered.day)}</p>
          </div>
        ) : null}
      </div>
      <details className="text-sm text-slate-600">
        <summary className="inline-flex min-h-9 cursor-pointer items-center rounded-full px-1 font-semibold text-[#2949da] hover:underline">Ver como tabla</summary>
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
              <tr key={p.day} className="border-t border-slate-100">
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
  if (items.length === 0 || max === 0) return <EmptyChart text={emptyText} />;
  return (
    <ol className="space-y-4">
      {items.map((item, i) => (
        <li key={`${item.label}-${i}`} title={`${item.label}: ${format(item.value)}${item.note ? ` · ${item.note}` : ""}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-900">
              <span aria-hidden="true" className="w-4 shrink-0 text-xs tabular-nums text-slate-400">{i + 1}</span>
              <span className="truncate">{item.label}</span>
              {item.tag ? <span className="shrink-0 rounded-full bg-[#7c5cff]/10 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-[#5b3fd6]">{item.tag}</span> : null}
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-slate-950">{format(item.value)}</span>
          </div>
          <div className="ml-6 mt-1.5 h-2 rounded-full bg-slate-100" aria-hidden="true">
            <div className="h-full rounded-full bg-gradient-to-r from-[#2949da] to-[#7c5cff]" style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }} />
          </div>
          {item.note ? <p className="ml-6 mt-1 text-xs text-slate-500">{item.note}</p> : null}
        </li>
      ))}
    </ol>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <p className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-sm text-slate-500">
      <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-full bg-white text-slate-400 shadow-sm">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 20V4M4 20h16M8 16v-3M12 16V9M16 16v-6" /></svg>
      </span>
      {text}
    </p>
  );
}
